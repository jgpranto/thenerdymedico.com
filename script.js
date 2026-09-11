(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  // Desktop custom cursor
  if(matchMedia('(pointer:fine)').matches){
    const dot=$('.cursor-dot'), ring=$('.cursor-ring');
    document.body.classList.add('has-pointer');
    let mx=-100,my=-100,rx=-100,ry=-100;
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px';});
    const loop=()=>{rx+=(mx-rx)*.16;ry+=(my-ry)*.16;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(loop)}; loop();
    $$('a,button').forEach(el=>{el.addEventListener('mouseenter',()=>document.body.classList.add('cursor-hover'));el.addEventListener('mouseleave',()=>document.body.classList.remove('cursor-hover'))});
  }

  // Hero background parallax
  const heroImg=$('.hero-bg img');
  if(heroImg)addEventListener('scroll',()=>{heroImg.style.transform=`translateY(${Math.min(scrollY,innerHeight)*.08}px) scale(1.045)`},{passive:true});

  // Small visual interlude: scroll the photo/text upward quickly,
  // then continue naturally into the bio. No pinned blank stage.
  const stackTransition=$('.stack-transition');
  const stackBase=$('.stack-transition-base');
  const stackCopy=$('.stack-transition-copy');
  if(stackTransition&&stackBase){
    const updateStack=()=>{
      const r=stackTransition.getBoundingClientRect();
      const progress=Math.max(0,Math.min(1,-r.top/Math.max(1,stackTransition.offsetHeight*.72)));
      const eased=progress*progress*(3-2*progress);
      stackBase.style.transform=`translateY(${-eased*45}px)`;
      if(stackCopy){
        stackCopy.style.transform=`translateY(${-eased*24}px)`;
        stackCopy.style.opacity=String(1-eased*.68);
      }
    };
    addEventListener('scroll',updateStack,{passive:true});
    addEventListener('resize',updateStack);
    updateStack();
  }

  // Bio photography: complete bio remains readable; imagery changes automatically.
  const bioPhotos=$$('.bio-photo'), bioCount=$('#bioCount');
  let bi=0;
  if(bioPhotos.length){
    const setBio=n=>{bi=(n+bioPhotos.length)%bioPhotos.length;bioPhotos.forEach((p,i)=>p.classList.toggle('active',i===bi));if(bioCount)bioCount.textContent=String(bi+1).padStart(2,'0')};
    setInterval(()=>setBio(bi+1),3200);
  }

  // USMLE small -> large, fast.
  const us=$('.usmle-scene'), card=$('.usmle-card');
  if(us&&card){
    const update=()=>{
      const r=us.getBoundingClientRect();
      const p=Math.max(0,Math.min(1,-r.top/Math.max(1,us.offsetHeight-innerHeight)));
      const eased=Math.min(1,p/.45);
      card.style.transform=`scale(${.72+.28*eased})`;
    };
    addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
  }

  // Gentle life image drift.
  const life=$('.life-scene'), lifeImgs=$$('.life-img');
  if(life&&lifeImgs.length)addEventListener('scroll',()=>{
    const r=life.getBoundingClientRect(), p=Math.max(0,Math.min(1,1-Math.abs(r.top-innerHeight*.55)/innerHeight));
    lifeImgs.forEach((el,i)=>el.style.translate=`0 ${(p-.5)*(i+1)*9}px`);
  },{passive:true});

  // Gallery orbit
  const orbit=$('.orbit');
  if(orbit){
    const thumbs=$$('.orbit-thumb',orbit), main=$('#orbitMain'), idx=$('#orbitIndex'), title=$('#orbitTitle');
    let data=Array.isArray(window.NERDY_GALLERY_DATA)&&window.NERDY_GALLERY_DATA.length ? window.NERDY_GALLERY_DATA.slice(0, thumbs.length) : [
      ['assets/life-01.jpg','the person behind the page'],
      ['assets/life-02.jpg','quiet hours / waterfront'],
      ['assets/life-03.jpg','places that become memories'],
      ['assets/life-04.jpg','off-duty / on the move']
    ];
    let current=0;
    const select=n=>{
      if(!data.length)return;
      current=(n+data.length)%data.length;
      thumbs.forEach((t,i)=>t.classList.toggle('active',i===current));
      main.style.opacity='0';
      setTimeout(()=>{main.src=data[current][0];main.alt=data[current][1];main.style.opacity='1'},120);
      if(idx)idx.textContent=String(current+1).padStart(2,'0');
      if(title)title.textContent=data[current][1];
    };
    thumbs.forEach(t=>t.addEventListener('click',()=>select(Number(t.dataset.index)||0)));
    addEventListener('nerdy-content-ready',e=>{
      const incoming=e.detail?.gallery?.map(row=>[row.url,row.title]).filter(row=>row[0]).slice(0,thumbs.length);
      if(!incoming?.length)return;
      data=incoming;
      current=0;
      select(0);
    });
    let sx=null;
    orbit.addEventListener('pointerdown',e=>sx=e.clientX);
    orbit.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx;if(Math.abs(dx)>40)select(current+(dx<0?1:-1));sx=null});
  }

  // Reveal gallery/social cards.
  if('IntersectionObserver' in window){
    const items=$$('.connect-card,.gallery-card,.gallery-button,.accent-button');
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(!e.isIntersecting)return;
      e.target.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
      io.unobserve(e.target);
    }),{threshold:.08});
    items.forEach(el=>{el.style.opacity='0';io.observe(el)});
  }
})();