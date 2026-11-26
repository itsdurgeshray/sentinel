// Sentinel v8 — the name opens onto the land; numbers, the gap and the founder's route play as pinned sequences.
(() => {
  const CONTACT_EMAIL = 'hello@sentinel-consulting.com'; // placeholder until the real address is confirmed
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth <= 860;
  const ROMAN = ['I', 'II', 'III', 'IV'];
  document.documentElement.classList.add('js');

  /* smooth scroll */
  let lenis = null;
  if (!reduce && window.Lenis) lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  const scrollToY = (y) => { if (lenis) lenis.scrollTo(y, { duration: 1.8 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    setDrawer(false);
    let y = el.getBoundingClientRect().top + window.scrollY;
    if (id === 'story') y = $('#story').offsetTop;
    if (id === 'top') y = 0;
    scrollToY(y);
  });
  $('#toTop').addEventListener('click', () => scrollToY(0));

  /* reveal on scroll, staggered among siblings */
  const groups = new Map();
  $$('.r').forEach((el) => { const p = el.parentElement, i = groups.get(p) || 0; el.style.setProperty('--d', i); groups.set(p, i + 1); });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.r').forEach((el) => io.observe(el));

  /* mobile drawer */
  const nav = $('#nav'), drawer = $('#drawer'), menuBtn = $('#menuBtn');
  function setDrawer(on) {
    drawer.classList.toggle('open', on);
    drawer.setAttribute('aria-hidden', String(!on));
    menuBtn.setAttribute('aria-expanded', String(on));
  }
  menuBtn.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

  /* ---------------------------------------------------------------- hero: the name as a window */
  const hero = $('#hero'), heroPin = $('.hero-pin'), mask = $('#heroMask'), word = $('#cutWord'), copy = $('.hero-copy');
  const H = { W: 1, Hh: 1, ox: 0, oy: 0 };
  function layoutHero() {
    const W = heroPin.clientWidth, Hh = heroPin.clientHeight;
    H.W = W; H.Hh = Hh;
    mask.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    ['cutBg', 'cutFill'].forEach((id) => { const r = document.getElementById(id); r.setAttribute('width', W); r.setAttribute('height', Hh); });
    word.setAttribute('font-size', 100);
    word.setAttribute('x', W / 2); word.setAttribute('y', Hh / 2);
    const L = word.getComputedTextLength() || 600;
    const f = 100 * (W * (narrow() ? 0.9 : 0.88)) / L;
    const cap = f * 0.68;
    word.setAttribute('font-size', f.toFixed(2));
    word.setAttribute('y', (Hh / 2 + cap / 2).toFixed(2));
    heroPin.style.setProperty('--wh', `${cap}px`);
    let ox = W / 2;
    try { const ex = word.getExtentOfChar(4); ox = ex.x + ex.width / 2; } catch (e) { /* keep centre */ }
    H.ox = ox; H.oy = Hh / 2;
  }

  /* ---------------------------------------------------------------- pinned helpers */
  const prog = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const setV = (el, k, v) => el.style.setProperty(k, v);

  /* stakes */
  const stakes = $('#stakes'), skSlides = $$('.sk-slide'), skNums = $$('.sk-num'), skProg = $$('.sk-prog li'), skCount = $('.sk-count b');
  let skI = 0;
  /* gap */
  const gap = $('#gap'), gapPin = $('.gap-pin'), gs1 = $('.gs-1'), gs2 = $('.gs-2');
  /* founder */
  const founder = $('#founder'), fdPin = $('.fd-pin'), fdTrack = $('#fdTrack'), fdRoute = $('.fd-route'), fdStages = $$('.fd-stages li');
  let fdW = 0;
  function layoutFounder() {
    if (narrow()) { founder.style.removeProperty('--fdh'); fdW = 0; return; }
    fdW = fdTrack.scrollWidth;
    founder.style.setProperty('--fdh', `${fdW - innerWidth + innerHeight}px`);
  }
  /* close + footer */
  const closeSec = $('#contact'), foot = $('.foot'), footWord = $('#footWord');
  const toned = $$('[data-tone]').filter((el) => el !== nav);

  let lastY = 0;
  function frame() {
    const y = window.scrollY;

    // hero
    const hp = prog(hero);
    const z = clamp(hp / 0.62);
    const ze = easeIO(z);
    if (z < 1) {
      mask.style.display = '';
      const s = Math.exp(ze * Math.log(80));
      const vx = H.ox - H.ox / s, vy = H.oy - H.oy / s;
      mask.setAttribute('viewBox', `${vx.toFixed(2)} ${vy.toFixed(2)} ${(H.W / s).toFixed(2)} ${(H.Hh / s).toFixed(2)}`);
    } else mask.style.display = 'none';
    setV(heroPin, '--hz', (1.2 - 0.17 * ze - 0.03 * clamp((hp - 0.62) / 0.38)).toFixed(4));
    setV(heroPin, '--hp', (1 - clamp(hp / 0.1)).toFixed(3));
    setV(heroPin, '--hs', clamp((hp - 0.4) / 0.25).toFixed(3));
    const hc = ease(clamp((hp - 0.58) / 0.22));
    setV(heroPin, '--hc', hc.toFixed(3));
    copy.classList.toggle('live', hc > 0.5);
    hero.dataset.tone = z > 0.55 ? 'dark' : 'light';

    // stakes: one number at a time
    const sp = prog(stakes);
    const si = Math.min(3, Math.floor(sp * 4 + 0.0001));
    if (si !== skI) {
      skI = si;
      skSlides.forEach((el, i) => el.classList.toggle('is-on', i <= si));
      skNums.forEach((el, i) => el.classList.toggle('is-on', i === si));
      skProg.forEach((el, i) => el.classList.toggle('is-on', i === si));
      skCount.textContent = ROMAN[si];
    }
    skProg.forEach((el, i) => el.querySelector('i').style.setProperty('--f', clamp(sp * 4 - i).toFixed(3)));

    // gap: the frame opens into the image
    const gp = prog(gap);
    const ge = easeIO(clamp(gp / 0.42));
    const gw = gapPin.clientWidth, gh = gapPin.clientHeight;
    setV(gapPin, '--gt', `${((1 - ge) * gh * (narrow() ? 0.24 : 0.2)).toFixed(1)}px`);
    setV(gapPin, '--gs', `${((1 - ge) * gw * (narrow() ? 0.1 : 0.31)).toFixed(1)}px`);
    setV(gapPin, '--gr', `${((1 - ge) * 22).toFixed(1)}px`);
    setV(gapPin, '--gz', (1.34 - 0.24 * ge - 0.1 * clamp((gp - 0.42) / 0.58)).toFixed(4));
    setV(gapPin, '--gd', clamp((gp - 0.24) / 0.2).toFixed(3));
    setV(gapPin, '--ge', (1 - clamp(gp / 0.14)).toFixed(3));
    gs1.classList.toggle('is-on', gp >= 0.36 && gp < 0.66);
    gs2.classList.toggle('is-on', gp >= 0.69);
    gap.dataset.tone = ge > 0.45 ? 'dark' : 'light';

    // founder: the route runs sideways
    if (fdW) {
      const fp = prog(founder);
      const travel = fdW - innerWidth;
      const tx = -fp * travel;
      setV(fdPin, '--ftx', `${tx.toFixed(1)}px`);
      setV(fdPin, '--fbx', `${(-fp * innerWidth * 0.6).toFixed(1)}px`);
      const rw = fdRoute.offsetWidth, rx = fdRoute.offsetLeft;
      const seen = clamp((-tx + innerWidth * 0.62 - rx) / rw);
      setV(fdPin, '--fdl', (1 - seen).toFixed(4));
      fdStages.forEach((li, i) => li.classList.toggle('is-on', seen >= (i + 0.08) / 6));
    }

    // close: a slow settle as it arrives
    const cr = closeSec.getBoundingClientRect();
    setV(closeSec, '--cz', (1 + 0.12 * clamp(cr.top / innerHeight)).toFixed(4));
    // footer word: the ridgelines drift inside the letters
    const fr = foot.getBoundingClientRect();
    setV(footWord, '--fwy', `${(20 + 50 * clamp(1 - fr.top / innerHeight)).toFixed(1)}%`);

    // nav: tone follows the section beneath it, and it steps aside while you read down
    let tone = 'light';
    for (const el of toned) { const r = el.getBoundingClientRect(); if (r.top <= 40 && r.bottom > 40) { tone = el.dataset.tone; break; } }
    if (nav.dataset.tone !== tone) nav.dataset.tone = tone;
    const hide = y > innerHeight * 2 && y > lastY + 3 && !drawer.classList.contains('open');
    if (hide) nav.classList.add('is-hidden'); else if (y < lastY - 3 || y < innerHeight * 2) nav.classList.remove('is-hidden');
    lastY = y;
  }

  /* ---------------------------------------------------------------- method: b-roll between four shots */
  const acc = $$('#acc li'), shots = $$('.m-shot'), media = $('.method-media'), arcs = $('.ring-arcs'), mIdx = $('.m-idx'), mName = $('.m-name');
  const RR = 44, C = 60;
  for (let i = 0; i < 4; i++) {
    const a0 = (i * 90 + 7) * Math.PI / 180, a1 = ((i + 1) * 90 - 7) * Math.PI / 180;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${C + Math.sin(a0) * RR} ${C - Math.cos(a0) * RR}A${RR} ${RR} 0 0 1 ${C + Math.sin(a1) * RR} ${C - Math.cos(a1) * RR}`);
    arcs.appendChild(p);
  }
  const arcEls = $$('path', arcs);
  const NAMES = ['Security', 'Land', 'Corridor', 'Coexistence'];
  let active = -1, mp = 0, inView = false, hover = false, lastT = 0;
  const DUR = 7000;
  function setActive(i) {
    i = (i + 4) % 4;
    if (i === active) return;
    active = i; mp = 0;
    acc.forEach((li, k) => { li.classList.toggle('is-on', k === i); $('button', li).setAttribute('aria-expanded', String(k === i)); });
    shots.forEach((m, k) => m.classList.toggle('is-on', k === i));
    arcEls.forEach((p, k) => p.classList.toggle('is-on', k === i));
    mIdx.textContent = `${ROMAN[i]} / IV`; mName.textContent = NAMES[i];
    media.classList.remove('flash'); void media.offsetWidth; media.classList.add('flash');
  }
  acc.forEach((li, k) => {
    $('button', li).addEventListener('click', () => setActive(k));
    li.addEventListener('mouseenter', () => { hover = true; });
    li.addEventListener('mouseleave', () => { hover = false; });
  });
  setActive(0);
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; }, { threshold: 0.3 }).observe($('.method'));

  /* ---------------------------------------------------------------- offers: a preview follows the pointer */
  const offers = $('#offers'), float = $('#offerFloat'), fImg = $('img', float);
  const fp = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  $$('.offer').forEach((li) => li.addEventListener('mouseenter', () => {
    if (narrow()) return;
    const src = li.dataset.img;
    if (!fImg.src.endsWith(src)) { fImg.src = src; fImg.style.transform = 'scale(1.12)'; requestAnimationFrame(() => { fImg.style.transform = ''; }); }
    float.classList.add('on'); fp.on = true;
  }));
  offers.addEventListener('mouseleave', () => { float.classList.remove('on'); fp.on = false; });
  offers.addEventListener('mousemove', (e) => { fp.tx = e.clientX + 36; fp.ty = e.clientY - float.offsetHeight / 2; if (!fp.x) { fp.x = fp.tx; fp.y = fp.ty; } });

  /* ---------------------------------------------------------------- the loop */
  function loop(t) {
    if (lenis) lenis.raf(t);
    frame();
    const dt = Math.min(t - lastT, 100); lastT = t;
    if (inView && !hover && !reduce) { mp += dt / DUR; if (mp >= 1) setActive(active + 1); }
    $('.acc-bar', acc[active]).style.transform = `scaleX(${mp.toFixed(4)})`;
    fp.x = lerp(fp.x, fp.tx, 0.14); fp.y = lerp(fp.y, fp.ty, 0.14);
    if (fp.on) float.style.transform = `translate3d(${fp.x.toFixed(1)}px, ${fp.y.toFixed(1)}px, 0) rotate(${clamp((fp.tx - fp.x) * 0.04, -6, 6).toFixed(2)}deg)`;
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- the letter */
  $('#letter').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const name = (d.get('name') || '').toString().trim();
    const subject = encodeURIComponent(`A first conversation about ${d.get('what')}`);
    const body = encodeURIComponent(`Dear Tinus,\n\nI am ${d.get('who')}, and I would like to talk about ${d.get('what')}.${name ? `\n\nMy name is ${name}.` : ''}\n\n`);
    location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });

  /* ---------------------------------------------------------------- footer: contours and the hour in Namibia */
  function drawTopo() {
    const svg = $('#topo'), w = foot.clientWidth, h = foot.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let d = '';
    const centres = [[w * 0.82, h * 0.18, 0], [w * 0.12, h * 0.7, 2.1]];
    centres.forEach(([cx, cy, ph]) => {
      for (let k = 1; k <= 22; k++) {
        const r = k * Math.max(w, h) * 0.028;
        for (let i = 0; i <= 140; i++) {
          const a = (i / 140) * Math.PI * 2;
          const rr = r * (1 + 0.16 * Math.sin(3 * a + k * 0.35 + ph) + 0.08 * Math.sin(5 * a - k * 0.6) + 0.04 * Math.sin(9 * a + k + ph));
          d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr * 0.8).toFixed(1)}`;
        }
        d += 'Z';
      }
    });
    svg.innerHTML = `<path d="${d}"/>`;
  }
  const clock = $('#clock');
  const tick = () => { try { clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Windhoek' }).format(new Date()); } catch (e) { clock.textContent = ''; } };
  tick(); setInterval(tick, 15000);

  /* ---------------------------------------------------------------- boot */
  function layout() { layoutHero(); layoutFounder(); drawTopo(); frame(); }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { layout(); });
  layout();
  requestAnimationFrame(loop);
  window.__s = { frame, layout };
})();
