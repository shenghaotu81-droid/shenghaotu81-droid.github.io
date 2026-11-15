/* Content is shared by the reading room and spatial displays. No HTML from JSON is executed. */
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
  const safeURL = (value) => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
  let data, rawData, gallery, readerZone, ui, lang='zh',sceneState='loading';
  try { lang=localStorage.getItem('gallery-language')==='en'?'en':'zh'; } catch {}
  function localized() {
    const fields=['title','summary','body','status','tags','emptyMessage'];
    const walk=value=>{if(Array.isArray(value))return value.map(walk);if(value&&typeof value==='object'){const out={...value};Object.keys(out).forEach(k=>out[k]=walk(out[k]));if(lang==='en')fields.forEach(k=>{if(value[k+'En']!=null)out[k]=value[k+'En'];else if(['title','summary','body','status','emptyMessage'].includes(k)&&value[k])out[k]=rawData.ui.en.empty;});return out;}return value;};
    data=walk(rawData);ui=rawData.ui[lang];data.ui=ui;data.language=lang;
    if(lang==='en'){data.profile.name=data.profile.nameEn;data.profile.intro=data.profile.introEn;data.profile.focus=data.profile.focusEnList;data.profile.interest=data.profile.interestEn;}
  }
  function arrowButton(id,text){$(id).replaceChildren(document.createTextNode(text+' '),el('span','↗'));}
  function paintUI(){
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.title=ui.footer;
    document.querySelector('.identity b').textContent=data.profile.name;
    const headline=document.querySelector('.welcome h1');headline.replaceChildren();ui.headline.split('\n').forEach((line,i)=>{if(i)headline.append(el('br'));headline.append(document.createTextNode(line));});
    const copy=document.querySelector('.welcome-copy');copy.replaceChildren();ui.welcome.split('\n').forEach((line,i)=>{if(i)copy.append(el('br'));copy.append(document.createTextNode(line));});
    arrowButton('enter',ui.enter);arrowButton('welcome-read',ui.read);arrowButton('text-toggle',ui.text);arrowButton('resume-button',ui.resume);arrowButton('back-to-space',ui.back);
    $('open-label').textContent=ui.open;$('loading-status').textContent=sceneState==='unavailable'?ui.fallback:sceneState==='loading'?ui.loading:matchMedia('(pointer: coarse)').matches?ui.mobileHint:ui.desktopHint;
    document.querySelector('.location small').textContent=ui.controls;document.querySelector('.look-hint').textContent=ui.look;document.querySelector('#joystick i').textContent=ui.move;document.querySelector('#resume>span').textContent=matchMedia('(pointer: coarse)').matches?ui.mobileResumeHint:ui.resumeHint;
    document.querySelector('.space-caption>span:last-child').replaceChildren(document.createTextNode(ui.caption),el('br'),document.createTextNode('EXPLORING THE PHYSICAL WORLD'));
    $('close-reader').setAttribute('aria-label',ui.close);$('pause').setAttribute('aria-label',ui.pause);
    $('home-button').setAttribute('aria-label',ui.home);$('home-button').title='R · '+ui.home;$('jump-button').setAttribute('aria-label',ui.jump);$('jump-label').textContent=ui.jump;
    document.querySelector('.reader-bottom span').textContent=ui.slow;
    document.querySelector('footer>span').textContent=ui.footer;document.querySelector('footer>a').textContent=ui.credits+' ↗';
    document.querySelectorAll('[data-zone]').forEach((b,i)=>b.replaceChildren(el('small',String(i+1).padStart(2,'0')),document.createTextNode(' '+ui[b.dataset.zone==='work'?'workShort':b.dataset.zone])));
    document.querySelectorAll('[data-lang]').forEach(n=>n.classList.toggle('selected',n.dataset.lang===lang));
    $('readable').replaceChildren(...['about','work','notes','contact'].map(section));
    if($('reader').open&&readerZone)$('reader-content').replaceChildren(section(readerZone));
  }
  function toggleLanguage(){
    if(!rawData)return;lang=lang==='zh'?'en':'zh';localized();paintUI();gallery?.setLanguage(data);
    try{localStorage.setItem('gallery-language',lang);}catch{}
  }
  $('lang-toggle').addEventListener('click',toggleLanguage);
  $('reader-lang').addEventListener('click',toggleLanguage);
  function tags(values) { const row = el('div', null, 'tag-row'); (values || []).forEach(t => row.append(el('span', t))); return row; }
  function items(list, empty) {
    const out = el('div');
    if (!list?.length) { out.append(el('p', empty || ui.empty, 'empty')); return out; }
    list.forEach(item => {
      const a = el('article');
      if (item.status) a.append(el('span', item.status, 'item-status'));
      a.append(el('h3', item.title || ui.emptyTitle));
      a.append(el('p', item.summary || ui.emptySummary));
      if (item.body && item.body !== item.summary) a.append(el('p', item.body));
      a.append(tags(item.tags));
      const url = safeURL(item.url); if (url) { const link = el('a', ui.openEntry+' ↗', 'content-link'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; a.append(link); }
      out.append(a);
    });
    return out;
  }
  function section(id) {
    const s = el('section'); s.dataset.section = id;
    const p = data.profile;
    if (id === 'about') {
      s.append(el('h2', p.name), el('p', p.intro), el('p', ui.goals), tags(p.focus), el('p', p.focusEn), el('h3', ui.tools), tags(p.skills), el('p', `${ui.outside} · ${p.interest || ui.empty}`));
    } else if (id === 'work') {
      s.append(el('h2', ui.work), items(data.projects.items, ui.empty));
    } else if (id === 'notes') {
      s.append(el('h2', ui.notes), items(data.notes.items, data.notes.emptyMessage), el('h3', ui.papers), items(data.papers.items, data.papers.emptyMessage));
    } else if (id === 'contact') {
      s.append(el('h2', ui.connect), el('p', ui.contactIntro));
      p.contacts.forEach(c => { const url = safeURL(c.url); const a = el(url ? 'a' : 'div', null, 'content-link'); if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; } a.append(el('small', c.label), el('span', `${c.text}${url ? ' ↗' : ''}`)); s.append(a); });
    }
    return s;
  }
  const names = { about: '01 / ABOUT', work: '02 / IN PROGRESS', notes: '03 / FIELD NOTES', contact: '04 / CONNECT' };
  function readSection(id) {
    if(id==='language'){toggleLanguage();return;}
    if (!data) return showText();
    gallery?.pause();
    readerZone=id;
    $('reader-number').textContent = names[id];
    $('reader-content').replaceChildren(section(id));
    $('reader').showModal(); $('reader').scrollTop = 0;
  }
  function showText() {
    gallery?.pause();
    document.body.classList.add('reading');
    $('back-to-space').hidden = !gallery;
    $('text-content').focus(); window.scrollTo(0, 0);
  }
  $('text-toggle').addEventListener('click', showText);
  $('welcome-read').addEventListener('click', showText);
  $('close-reader').addEventListener('click', () => $('reader').close());
  $('reader').addEventListener('click', e => { if (e.target === $('reader')) { const r = $('reader').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('reader').close(); } });
  $('reader').addEventListener('close', () => gallery?.showResume());
  $('back-to-space').addEventListener('click', () => { document.body.classList.remove('reading'); window.scrollTo(0, 0); gallery?.showResume(); });
  document.querySelectorAll('[data-zone]').forEach(b => b.addEventListener('click', () => {
    if (gallery) { document.body.classList.remove('reading'); gallery.goTo(b.dataset.zone); }
    else if (data) readSection(b.dataset.zone);
    else { showText(); document.querySelector(`[data-section="${b.dataset.zone}"]`)?.scrollIntoView(); }
  }));
  async function start() {
    try {
      const files = ['profile', 'projects', 'notes', 'papers', 'exhibits', 'ui'];
      const values = await Promise.all(files.map(async name => { const r = await fetch(`content/${name}.json`, {cache:'no-cache'}); if (!r.ok) throw new Error(`内容读取失败：${name}`); return r.json(); }));
      rawData = Object.fromEntries(files.map((name, i) => [name, values[i]]));
      localized();paintUI();$('lang-toggle').hidden=false;
    } catch (e) { $('loading-status').textContent = '暂时无法读取最新内容，下面仍可阅读本站内容。'; console.warn(e); return; }
    try {
      const { createGallery } = await import('./gallery.js');
      gallery = await createGallery(data, readSection);
      sceneState='ready';
      document.body.classList.add('scene-ready');
      $('enter').disabled = false; arrowButton('enter',ui.enter);
      $('loading-status').textContent = matchMedia('(pointer: coarse)').matches ? ui.mobileHint : ui.desktopHint;
      $('enter').addEventListener('click', () => gallery.enter());
      $('resume-button').addEventListener('click', () => gallery.resume());
      $('pause').addEventListener('click', () => gallery.pause());
      $('nearby').addEventListener('click', () => gallery.readNearby());
    } catch(e) {
      sceneState='unavailable';
      document.body.classList.remove('scene-ready');
      $('world').replaceChildren();
      $('loading-status').textContent = ui.fallback;
      $('enter').hidden = true;
      console.warn('3D unavailable; reading room remains available.', e);
    }
  }
  start();
})();
