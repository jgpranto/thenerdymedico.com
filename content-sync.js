(() => {
  const cfg = window.NERDY_SUPABASE;
  if (!cfg || !window.supabase) return;

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const safeUrl = value => {
    try {
      const u = new URL(value);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  };

  const setLink = (el, value) => {
    if (!el) return;
    const url = safeUrl(value);
    if (url) el.href = url;
  };

  const setImage = (img, src, alt = '') => {
    if (!img || !src) return;
    img.src = src;
    if (alt) img.alt = alt;
  };

  const publicUrl = path => {
    const { data } = client.storage.from('site-images').getPublicUrl(path);
    return data?.publicUrl || '';
  };

  async function loadContent() {
    try {
      const [{ data: siteRows, error: siteError }, { data: galleryRows, error: galleryError }] = await Promise.all([
        client.from('site_content').select('bio,youtube_url,instagram_url,facebook_url').limit(1),
        client.from('gallery').select('id,storage_path,caption,sort_order').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      ]);

      if (siteError) console.warn('[the nerdy medico] site content unavailable:', siteError.message);
      if (galleryError) console.warn('[the nerdy medico] gallery unavailable:', galleryError.message);

      const site = siteRows?.[0];
      const gallery = (galleryRows || []).map(row => ({
        ...row,
        url: publicUrl(row.storage_path),
        title: row.caption?.trim() || 'gallery image'
      })).filter(row => row.url);

      if (site) {
        const paragraphs = $('.bio-text');
        if (paragraphs && site.bio?.trim()) {
          const chunks = site.bio.trim().split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
          paragraphs.innerHTML = chunks.map(text => `<p>${text.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</p>`).join('');
        }

        const urls = [site.youtube_url, site.instagram_url, site.facebook_url];
        const heroLinks = $$('.hero-social');
        const connectLinks = $$('.connect-card');
        urls.forEach((url, i) => {
          setLink(heroLinks[i], url);
          setLink(connectLinks[i], url);
        });

        const usmleButton = $('.accent-button');
        setLink(usmleButton, site.youtube_url);
      }

      if (gallery.length) {
        window.NERDY_GALLERY_DATA = gallery.map(row => [row.url, row.title]);
        hydrateGalleryPage(gallery);
      }

      window.dispatchEvent(new CustomEvent('nerdy-content-ready', { detail: { site, gallery } }));
    } catch (error) {
      console.warn('[the nerdy medico] content sync failed:', error);
    }
  }


  function hydrateGalleryPage(gallery) {
    const orbit = $('.orbit');
    if (!orbit) return;

    const thumbs = $$('.orbit-thumb', orbit);
    const main = $('#orbitMain');
    const idx = $('#orbitIndex');
    const title = $('#orbitTitle');
    const orbitData = gallery.slice(0, Math.max(4, thumbs.length));

    thumbs.forEach((thumb, i) => {
      const row = orbitData[i];
      if (!row) {
        thumb.hidden = true;
        return;
      }
      thumb.hidden = false;
      thumb.dataset.index = String(i);
      thumb.setAttribute('aria-label', `Show gallery image ${i + 1}`);
      setImage($('img', thumb), row.url, row.title);
    });

    if (orbitData[0]) {
      setImage(main, orbitData[0].url, orbitData[0].title);
      if (idx) idx.textContent = '01';
      if (title) title.textContent = orbitData[0].title;
    }

    const cards = $$('.gallery-card');
    cards.forEach((card, i) => {
      const row = gallery[i];
      if (!row) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      const img = $('img', card);
      const cap = $('figcaption', card);
      setImage(img, row.url, row.title);
      if (cap) cap.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span> ${escapeHtml(row.title)}`;
    });
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  loadContent();
})();
