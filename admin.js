(() => {
  const cfg = window.NERDY_SUPABASE;
  if (!cfg || !window.supabase) throw new Error('Supabase configuration is missing.');
  const client = window.supabase.createClient(cfg.url, cfg.publishableKey);

  const $ = id => document.getElementById(id);
  const loginView = $('loginView'), appView = $('appView');
  const loginMessage = $('loginMessage'), profileMessage = $('profileMessage'), galleryMessage = $('galleryMessage');
  let gallery = [];

  const setMsg = (el, text, error = false) => { el.textContent = text || ''; el.style.color = error ? 'var(--danger)' : ''; };
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const imageUrl = path => client.storage.from('site-images').getPublicUrl(path).data.publicUrl;

  async function isAdmin() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    return !error && !!data;
  }

  async function loadApp() {
    const admin = await isAdmin();
    if (!admin) { await client.auth.signOut(); showLogin(); return; }
    showApp();
    await Promise.all([loadProfile(), loadGallery()]);
  }

  function showLogin() { loginView.classList.remove('hidden'); appView.classList.add('hidden'); }
  function showApp() { loginView.classList.add('hidden'); appView.classList.remove('hidden'); }

  async function loadProfile() {
    const { data, error } = await client.from('site_content').select('bio,youtube_url,instagram_url,facebook_url').limit(1).maybeSingle();
    if (error) { setMsg(profileMessage, error.message, true); return; }
    if (!data) return;
    $('bio').value = data.bio || '';
    $('youtubeUrl').value = data.youtube_url || '';
    $('instagramUrl').value = data.instagram_url || '';
    $('facebookUrl').value = data.facebook_url || '';
  }

  async function saveProfile() {
    setMsg(profileMessage, 'saving…');
    const payload = {
      bio: $('bio').value.trim(),
      youtube_url: $('youtubeUrl').value.trim(),
      instagram_url: $('instagramUrl').value.trim(),
      facebook_url: $('facebookUrl').value.trim(),
      updated_at: new Date().toISOString()
    };
    const { data: existing, error: readError } = await client.from('site_content').select('id').limit(1).maybeSingle();
    if (readError) { setMsg(profileMessage, readError.message, true); return; }
    const result = existing?.id
      ? await client.from('site_content').update(payload).eq('id', existing.id)
      : await client.from('site_content').insert(payload);
    if (result.error) setMsg(profileMessage, result.error.message, true);
    else setMsg(profileMessage, 'saved.');
  }

  async function loadGallery() {
    setMsg(galleryMessage, 'loading…');
    const { data, error } = await client.from('gallery').select('id,storage_path,caption,sort_order,created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) { setMsg(galleryMessage, error.message, true); return; }
    gallery = data || [];
    renderGallery();
    setMsg(galleryMessage, gallery.length ? '' : 'No gallery photos yet.');
  }

  function renderGallery() {
    const list = $('galleryList');
    list.innerHTML = '';
    gallery.forEach((row, index) => {
      const el = document.createElement('article');
      el.className = 'gallery-row';
      el.draggable = true;
      el.dataset.id = row.id;
      el.innerHTML = `
        <div class="drag" title="Drag to reorder">⋮⋮</div>
        <div class="thumb"><img src="${escapeHtml(imageUrl(row.storage_path))}" alt=""></div>
        <input class="caption-input" aria-label="Caption" value="${escapeHtml(row.caption || '')}" placeholder="optional caption">
        <div class="row-actions"><button type="button" data-action="save">save</button><button type="button" class="delete" data-action="delete">delete</button></div>`;
      el.querySelector('[data-action="save"]').addEventListener('click', () => updateCaption(row.id, el.querySelector('.caption-input').value));
      el.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRow(row.id));
      el.addEventListener('dragstart', () => el.classList.add('dragging'));
      el.addEventListener('dragend', async () => { el.classList.remove('dragging'); await persistOrderFromDOM(); });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        const current = list.querySelector('.dragging');
        if (!current || current === el) return;
        const rect = el.getBoundingClientRect();
        list.insertBefore(current, e.clientY < rect.top + rect.height / 2 ? el : el.nextSibling);
      });
      list.appendChild(el);
    });
  }

  async function persistOrderFromDOM() {
    const ids = [...document.querySelectorAll('.gallery-row')].map(row => row.dataset.id);
    const byId = new Map(gallery.map(row => [row.id, row]));
    try {
      for (let i = 0; i < ids.length; i++) {
        const { error } = await client.from('gallery').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', ids[i]);
        if (error) throw error;
      }
      gallery = ids.map(id => ({ ...byId.get(id), sort_order: ids.indexOf(id) }));
      setMsg(galleryMessage, 'order saved.');
    } catch (error) { setMsg(galleryMessage, error.message, true); }
  }

  async function updateCaption(id, caption) {
    const { error } = await client.from('gallery').update({ caption: caption.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) setMsg(galleryMessage, error.message, true);
    else { const row = gallery.find(x => x.id === id); if (row) row.caption = caption.trim(); setMsg(galleryMessage, 'caption saved.'); }
  }

  async function deleteRow(id) {
    const row = gallery.find(x => x.id === id);
    if (!row || !confirm('Delete this gallery photo? This also removes the stored image file.')) return;
    setMsg(galleryMessage, 'deleting…');
    const { error: storageError } = await client.storage.from('site-images').remove([row.storage_path]);
    if (storageError) { setMsg(galleryMessage, storageError.message, true); return; }
    const { error: dbError } = await client.from('gallery').delete().eq('id', id);
    if (dbError) { setMsg(galleryMessage, dbError.message, true); return; }
    gallery = gallery.filter(x => x.id !== id);
    renderGallery();
    await persistOrderFromDOM();
  }

  async function uploadFiles(files) {
    const items = [...files];
    if (!items.length) return;
    setMsg(galleryMessage, `uploading ${items.length} photo${items.length > 1 ? 's' : ''}…`);
    for (const file of items) {
      if (!file.type.startsWith('image/')) { setMsg(galleryMessage, `${file.name} is not an image.`, true); continue; }
      if (file.size > 20 * 1024 * 1024) { setMsg(galleryMessage, `${file.name} is larger than 20 MB.`, true); continue; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `gallery/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await client.storage.from('site-images').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { setMsg(galleryMessage, uploadError.message, true); continue; }
      const nextOrder = gallery.length ? Math.max(...gallery.map(x => Number(x.sort_order) || 0)) + 1 : 0;
      const { data: inserted, error: dbError } = await client.from('gallery').insert({ storage_path: path, caption: '', sort_order: nextOrder, updated_at: new Date().toISOString() }).select('id,storage_path,caption,sort_order,created_at').single();
      if (dbError) {
        await client.storage.from('site-images').remove([path]);
        setMsg(galleryMessage, dbError.message, true);
        continue;
      }
      gallery.push(inserted);
    }
    renderGallery();
    setMsg(galleryMessage, 'upload complete.');
    $('fileInput').value = '';
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    setMsg(loginMessage, 'signing in…');
    const { error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) setMsg(loginMessage, error.message, true);
    else { $('password').value = ''; await loadApp(); }
  });
  $('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); showLogin(); });
  $('saveProfileBtn').addEventListener('click', saveProfile);
  $('fileInput').addEventListener('change', e => uploadFiles(e.target.files));
  client.auth.onAuthStateChange((_event, session) => { if (session) loadApp(); });

  client.auth.getSession().then(({ data: { session } }) => { if (session) loadApp(); else showLogin(); });
})();
