// Sentinel — director. Scroll is time; the page is one flight from dawn to dawn.
import * as THREE from 'three';
import { createWorld } from './world.js';

const CONTACT_EMAIL = 'hello@sentinel-consulting.com'; // placeholder until the real address is confirmed

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, v) => ease(clamp((v - a) / (b - a)));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 820px)').matches || coarse;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function K(S, keys, linear = false) {
  if (S <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (S <= keys[i][0]) {
      const [s0, v0] = keys[i - 1], [s1, v1] = keys[i];
      const f = (S - s0) / Math.max(s1 - s0, 1e-6);
      return lerp(v0, v1, linear ? f : ease(f));
    }
  }
  return keys[keys.length - 1][1];
}

/* ---------------------------------------------------------------- story timeline */
const KEYS = {
  fence: [[2.02, 0], [2.42, 1], [9.9, 1], [10.3, .75]],
  fenceA: [[0, 1], [2.95, 1], [3.15, .45], [9.9, .45], [10.3, .3]],
  fenceGlow: [[2.04, 0], [2.3, 1], [2.92, 1], [3.08, 0]],
  wallRise: [[2.04, 0], [2.36, 1], [2.95, 1], [3.12, 0]],
  herdFence: [[2.1, 0], [2.46, 1]],
  alive: [[2.3, 1], [2.9, 0], [9.9, 0], [10.3, .55]],
  boost: [[2.6, 0], [2.85, 1], [3.15, 0]],
  herdVis: [[0, 1], [2.97, 1], [3.12, .35], [5.0, .35], [5.12, .8], [7.0, .8], [7.1, .4], [9.75, .4], [10.05, 1]],
  restore: [[9.95, 0], [10.35, 1]],
  water: [[10.15, 0], [10.4, 1]],
  ringA: [[4.95, 0], [5.06, 1], [6.02, 1], [6.14, 0]],
  ringDraw: [[5.02, 0], [5.2, 1]],
  rhinoShow: [[2.96, 0], [3.12, 1], [4.15, 1], [4.4, 0]],
  gone: [[3.33, 0], [3.72, 41], [3.81, 41], [3.95, 49]],
  show8: [[3.75, 0], [3.82, 1]],
  siteA: [[6.06, 0], [6.26, 1], [6.95, 1], [7.12, 0]],
  siteB: [[6.5, 0], [6.7, 1], [6.97, 1], [7.14, 0]],
  fov: [[0, 40], [3.9, 40], [4.1, 50], [4.85, 50], [5.0, 38], [6.0, 38], [6.12, 40], [7.0, 40], [7.12, 50], [7.92, 50], [8.06, 40]],
  eleGlow: [[2.6, 0], [2.85, 2.6], [3.15, 0]]
};

/* ---------------------------------------------------------------- light */
const A = (o) => o;
const ATM = {
  dawn:    A({ sun: [.42, .095, -.9], sunC: ['#ffc58e', 3.6], sky: ['#6f84a3', .42], bounce: ['#a06f52', .22], fog: '#a98a72', ins: ['#ffc98c', 1.5], hor: '#e9ad74', zen: '#33506f', disc: 1, stars: 0, night: 0, exp: 1.05, fs: 160, fr: 620, cloud: .3, bloom: .6 }),
  day:     A({ sun: [.5, .55, .4], sunC: ['#fff0d8', 3.2], sky: ['#8aa4c2', .42], bounce: ['#a8875f', .22], fog: '#b9b6ad', ins: ['#fff0d8', 1.05], hor: '#d4d2ca', zen: '#5a82b0', disc: 1, stars: 0, night: 0, exp: .78, fs: 220, fr: 700, cloud: .5, bloom: .3 }),
  day2:    A({ sun: [-.55, .5, .4], sunC: ['#ffeccf', 3.2], sky: ['#8aa4c2', .42], bounce: ['#a8875f', .22], fog: '#bcb5a8', ins: ['#ffeccf', 1.05], hor: '#d6d0c4', zen: '#5d84b0', disc: 1, stars: 0, night: 0, exp: .8, fs: 220, fr: 700, cloud: .5, bloom: .3 }),
  dusk:    A({ sun: [-.86, .08, -.3], sunC: ['#ff9852', 3.0], sky: ['#5a6680', .42], bounce: ['#8a573d', .25], fog: '#8a6a58', ins: ['#ffa465', 1.3], hor: '#ef955a', zen: '#2a3550', disc: 1, stars: .05, night: .15, exp: 1.05, fs: 110, fr: 420, cloud: .3, bloom: .6 }),
  night:   A({ sun: [-.3, .6, -.6], sunC: ['#a6bad6', .34], sky: ['#1c2a3e', .24], bounce: ['#131a20', .08], fog: '#0b121a', ins: ['#24324a', 1], hor: '#131e2c', zen: '#02050b', disc: .45, stars: 1, night: 1, exp: 1.75, fs: 100, fr: 460, cloud: 0, bloom: .7 }),
  blue:    A({ sun: [.4, .62, -.6], sunC: ['#b3c6df', .6], sky: ['#2a3b55', .38], bounce: ['#1a2026', .1], fog: '#17212d', ins: ['#3a4b64', 1], hor: '#22324a', zen: '#050a14', disc: .4, stars: .6, night: .8, exp: 1.55, fs: 380, fr: 900, cloud: 0, bloom: .45 }),
  predawn: A({ sun: [.9, .035, -.3], sunC: ['#ffb07a', .9], sky: ['#3c4d68', .44], bounce: ['#3a2f2c', .12], fog: '#343c4a', ins: ['#d6936c', 1], hor: '#c88a6a', zen: '#121e31', disc: .8, stars: .25, night: .55, exp: 1.4, fs: 170, fr: 600, cloud: 0, bloom: .75 }),
  canyon:  A({ sun: [.7, .35, .35], sunC: ['#ffd09c', 3.4], sky: ['#8aa0bb', .55], bounce: ['#b0683f', .5], fog: '#c9a283', ins: ['#ffd5a2', 1.1], hor: '#f0c69c', zen: '#55799f', disc: 1, stars: 0, night: 0, exp: .95, fs: 90, fr: 380, cloud: .25, bloom: .5 }),
  sunrise: A({ sun: [.93, .055, .3], sunC: ['#ffbd7c', 3.6], sky: ['#7b8ca6', .5], bounce: ['#a06b4a', .3], fog: '#c49e80', ins: ['#ffc98c', 1.3], hor: '#f2b478', zen: '#3f5a7a', disc: 1, stars: 0, night: 0, exp: 1.0, fs: 120, fr: 440, cloud: .3, bloom: .65 })
};
const CH_ATM = ['dawn', 'day', 'dusk', 'night', 'night', 'blue', 'predawn', 'canyon', 'day', 'day2', 'sunrise'];
const CH_SHIFT = [0, 30, 36, 26, 0, 72, 46, 0, 40, 0, 0];
const CH_BLEND = [.3, .36, .3, .3, .25, .16, .14, .3, .3, .3, .3];
const COLS = { sunC: 1, sky: 1, bounce: 1, ins: 1, fog: 0, hor: 0, zen: 0 };
const NUMS = ['disc', 'stars', 'night', 'exp', 'fs', 'fr', 'cloud', 'bloom'];
const ATMC = {};
for (const [k, a] of Object.entries(ATM)) {
  const o = { sun: new THREE.Vector3(...a.sun).normalize() };
  for (const c of Object.keys(COLS)) o[c] = Array.isArray(a[c]) ? new THREE.Color(a[c][0]).multiplyScalar(a[c][1]) : new THREE.Color(a[c]);
  NUMS.forEach((n) => { o[n] = a[n]; });
  ATMC[k] = o;
}
const cur = { sun: new THREE.Vector3() };
Object.keys(COLS).forEach((c) => { cur[c] = new THREE.Color(); });
function atmosphere(S) {
  const u = S - 0.5;
  const i = clamp(Math.floor(u), 0, CH_ATM.length - 1), j = clamp(i + 1, 0, CH_ATM.length - 1);
  const f = u < 0 ? 0 : sstep(0.3, 0.7, u - i);
  const a = ATMC[CH_ATM[i]], b = ATMC[CH_ATM[j]];
  Object.keys(COLS).forEach((c) => cur[c].copy(a[c]).lerp(b[c], f));
  NUMS.forEach((n) => { cur[n] = lerp(a[n], b[n], f); });
  cur.sun.copy(a.sun).lerp(b.sun, f).normalize();
  return cur;
}

/* ---------------------------------------------------------------- boot */
const canvas = $('#world');
const chapters = $$('.ch');
const NCH = chapters.length;
let tops = [], hs = [], maxScroll = 1;
function measure() {
  chapters.forEach((c, i) => { tops[i] = c.offsetTop; hs[i] = c.offsetHeight; });
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
}
function computeS(y) {
  for (let i = NCH - 1; i >= 0; i--) {
    if (y >= tops[i] - 0.5) {
      const last = i === NCH - 1;
      const span = last ? Math.max(1, hs[i] - innerHeight) : hs[i];
      return i + clamp((y - tops[i]) / span, 0, last ? 1 : 0.99999);
    }
  }
  return 0;
}
function yForS(S) {
  const i = clamp(Math.floor(S), 0, NCH - 1), p = S - i;
  const span = i === NCH - 1 ? Math.max(1, hs[i] - innerHeight) : hs[i];
  return tops[i] + p * span;
}

let world = null;
const lenis = new Lenis({ lerp: reduce ? 1 : 0.07, smoothWheel: !reduce, wheelMultiplier: 0.85, touchMultiplier: 1.4 });
lenis.stop();
window.scrollTo(0, 0);

const ldBar = $('.ld-bar i'), ldMark = $('.ld-mark circle');
const ld = { v: 0 };
const paintLd = () => { ldBar.style.transform = `scaleX(${ld.v})`; ldMark.style.strokeDashoffset = 1 - ld.v; };
const ldTween = gsap.to(ld, { v: 0.82, duration: 2.4, ease: 'power2.out', onUpdate: paintLd });
gsap.from('.ld-word', { opacity: 0, y: 12, duration: 1.4, ease: 'power3.out' });

async function boot() {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try { world = createWorld(canvas, { mobile }); }
  catch (e) { console.warn('WebGL unavailable, falling back', e); document.body.classList.add('no-gl'); }
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
  measure();
  setupBeats();
  setupChrome();
  setupTags();
  setupPointer();
  setupSound();
  setupForm();
  requestAnimationFrame(tick);
  ldTween.kill();
  gsap.to(ld, { v: 1, duration: .6, ease: 'power1.inOut', onUpdate: paintLd, onComplete: intro });
}

/* ---------------------------------------------------------------- intro */
const introS = { k: 0, reveal: 0 };
let ready = false;
function intro() {
  const tl = gsap.timeline();
  tl.to('.loader > *', { opacity: 0, y: -10, duration: .7, stagger: .06, ease: 'power2.in' })
    .to('#loader', { opacity: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => $('#loader').remove() }, '-=.2')
    .to(introS, { reveal: 1400, duration: 4.2, ease: 'power2.inOut' }, '-=1.1')
    .to(introS, { k: 1, duration: 5, ease: 'power3.inOut' }, '<')
    .add(() => { ready = true; }, '<1.6')
    .from('.top, .bar', { opacity: 0, duration: 1.6, ease: 'power2.out' }, '<.8')
    .from('.cue', { opacity: 0, duration: 1.2 }, '<.6')
    .add(() => { lenis.start(); }, '<');
}

/* ---------------------------------------------------------------- camera */
const pose = { p: new THREE.Vector3(), t: new THREE.Vector3() };
const poseB = { p: new THREE.Vector3(), t: new THREE.Vector3() };
const introPose = { p: new THREE.Vector3(0, 520, 640), t: new THREE.Vector3(0, 0, -60) };
const pt = {};
const portrait = () => innerWidth < innerHeight * 0.9;
const Hh = (x, z) => (world ? world.heightAt(x, z) : 0);

function chapterPose(i, p, o) {
  const W = world;
  switch (i) {
    case 0: o.p.set(0, 112 - 26 * p, 300 - 72 * p); o.t.set(0, 16, -160); break;
    case 1: {
      const t0 = 0.2 + 0.2 * p;
      W.corridor.atInto(t0, pt); const ax = pt.x, az = pt.z;
      W.corridor.atInto(t0 + 0.1, pt);
      o.p.set(ax - 30, 105, az + 125); o.t.set(pt.x, 0, pt.z); break;
    }
    case 2: o.p.set(lerp(-20, 10, p), lerp(110, 230, ease(p)), lerp(160, 252, ease(p))); o.t.set(0, 0, -10); break;
    case 3: o.p.set(30 + 25 * p, 120 - 15 * p, 26 + 6 * p); o.t.set(118, 0, -100); break;
    case 4: o.p.set(70, 50, -28); o.t.set(150, 110 + 90 * p, -260); break;
    case 5: o.p.set(0, (portrait() ? 560 : 480) - 40 * p, 70); o.t.set(0, 0, 0); break;
    case 6: {
      const A = W.sites.gondwana, B = W.sites.huab, f = sstep(0.44, 0.56, p);
      o.p.set(lerp(A.x + 10 + p * 30, B.x + 10 + (p - .5) * 30, f), lerp(118, 112, f), lerp(A.z + 116, B.z + 110, f));
      o.t.set(lerp(A.x, B.x, f), 0, lerp(A.z, B.z, f)); break;
    }
    case 7: {
      const t0 = 0.1 + 0.66 * p;
      W.canyon.atInto(t0, pt); const ax = pt.x - pt.tx * 40 - pt.nx * 70, az = pt.z - pt.tz * 40 - pt.nz * 70;
      W.canyon.atInto(t0 + 0.07, pt);
      o.p.set(ax, 118, az); o.t.set(pt.x, Hh(pt.x, pt.z) + 6, pt.z); break;
    }
    case 8: { const a = -0.9 + 0.5 * p; o.p.set(Math.sin(a) * 250, 120, Math.cos(a) * 250); o.t.set(0, 20, 0); break; }
    case 9: { const a = -0.4 + 0.45 * p; o.p.set(Math.sin(a) * 240, 105, Math.cos(a) * 240); o.t.set(0, 40, 0); break; }
    default: o.p.set(-225 + 50 * p, 52 + 6 * p, 78 - 8 * p); o.t.set(60, 4, 10);
  }
  const amt = CH_SHIFT[Math.min(i, CH_SHIFT.length - 1)];
  if (amt) {
    let fx = o.t.x - o.p.x, fz = o.t.z - o.p.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const dx = portrait() ? -fx * amt * 0.8 : fz * amt, dz = portrait() ? -fz * amt * 0.8 : -fx * amt;
    o.t.x += dx; o.t.z += dz; o.p.x += dx; o.p.z += dz;
  }
  return o;
}
function camAt(S) {
  const i = clamp(Math.floor(S), 0, NCH - 1), p = clamp(S - i);
  chapterPose(i, p, pose);
  const bw = CH_BLEND[i];
  if (i > 0 && p < bw) {
    chapterPose(i - 1, 1, poseB);
    const b = ease(clamp(p / bw));
    pose.p.lerpVectors(poseB.p, pose.p, b);
    pose.t.lerpVectors(poseB.t, pose.t, b);
  }
  return pose;
}

/* ---------------------------------------------------------------- director */
const pointer = { nx: 0, ny: 0 };
const par = { x: 0, y: 0 };
let S = 0, Sd = 0, lastT = 0, rhinoCount = 0;
const counters = {};
const glowCol = new THREE.Color('#ffc27a');

function direct(Sv, t, dt) {
  if (!world) return;
  const W = world, P = W.P, U = W.U, T = W.TU;
  const a = atmosphere(Sv);

  camAt(Sv);
  const k = ease(introS.k);
  const cp = P.cam.lerpVectors(introPose.p, pose.p, k);
  const ct = P.tgt.lerpVectors(introPose.t, pose.t, k);
  par.x += (pointer.nx - par.x) * (1 - Math.exp(-dt * 2));
  par.y += (pointer.ny - par.y) * (1 - Math.exp(-dt * 2));
  let fx = ct.x - cp.x, fz = ct.z - cp.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const sway = Math.sin(t * 0.11) * 2.6 + par.x * 5;
  cp.x += -fz * sway; cp.z += fx * sway;
  cp.y += -par.y * 3 + Math.sin(t * 0.19) * 0.9;
  cp.y = Math.max(cp.y, W.heightAt(cp.x, cp.z) + 8);
  let fov = K(Sv, KEYS.fov);
  if (portrait()) fov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * Math.max(1, (innerHeight / innerWidth) * 0.72)) * 180 / Math.PI;
  P.fov = fov;

  U.uSunDir.value.copy(a.sun);
  U.uSunCol.value.copy(a.sunC); U.uSkyCol.value.copy(a.sky); U.uBounceCol.value.copy(a.bounce);
  U.uFogCol.value.copy(a.fog); U.uInscatter.value.copy(a.ins);
  U.uFogStart.value = a.fs; U.uFogRange.value = a.fr; U.uNight.value = a.night;
  W.SU.uZenith.value.copy(a.zen); W.SU.uHorizon.value.copy(a.hor); W.SU.uSunDisc.value = a.disc; W.SU.uStars.value = a.stars;
  W.renderer.toneMappingExposure = a.exp;
  W.bloom.strength = a.bloom;
  T.uCloud.value = a.cloud;

  T.uReveal.value = introS.reveal;
  T.uFence.value = K(Sv, KEYS.fence);
  T.uFenceA.value = K(Sv, KEYS.fenceA);
  T.uFenceGlow.value = K(Sv, KEYS.fenceGlow);
  T.uRestore.value = K(Sv, KEYS.restore);
  T.uSiteAmt.value.set(K(Sv, KEYS.siteA), K(Sv, KEYS.siteB));
  P.herdFence = K(Sv, KEYS.herdFence) * (1 - K(Sv, KEYS.restore));
  P.alive = K(Sv, KEYS.alive);
  P.boost = K(Sv, KEYS.boost);
  P.herdVis = K(Sv, KEYS.herdVis);
  P.wallRise = K(Sv, KEYS.wallRise);
  P.restore = K(Sv, KEYS.restore);
  W.EU.uGlowCol.value.copy(glowCol).multiplyScalar(K(Sv, KEYS.eleGlow));
  W.wireMat.opacity = 0.35 + 0.5 * K(Sv, KEYS.fenceGlow);

  const ringA = K(Sv, KEYS.ringA), ringD = K(Sv, KEYS.ringDraw, true);
  W.ring.uAlpha.value = ringA; W.ring.uDraw.value = ringD;
  W.ring.uQuad.value = Sv >= 5.2 && Sv < 6.0 ? Math.min(3, Math.floor((Sv - 5.2) / 0.2)) : -1;
  W.ringInner.uAlpha.value = ringA * 0.35; W.ringInner.uDraw.value = ringD;
  T.uRing.value.w = ringA; T.uRingDraw.value = ringD;
  T.uQuad.value = K(Sv, [[5.2, 0], [5.37, 0], [5.43, 1], [5.57, 1], [5.63, 2], [5.77, 2], [5.83, 3]]);
  T.uQuadAmt.value = K(Sv, [[5.17, 0], [5.23, 1], [5.99, 1], [6.06, 0]]);
  const sa = K(Sv, KEYS.siteA), sb = K(Sv, KEYS.siteB);
  W.siteA.uAlpha.value = sa; W.siteA.uDraw.value = sa; W.siteAo.uAlpha.value = sa * 0.7; W.siteAo.uDraw.value = sa;
  W.siteB.uAlpha.value = sb; W.siteB.uDraw.value = sb; W.siteBo.uAlpha.value = sb * 0.7; W.siteBo.uDraw.value = sb;

  const gone = K(Sv, KEYS.gone, true);
  W.GU.uGone.value = gone; W.GU.uShow.value = K(Sv, KEYS.rhinoShow); W.GU.uShow8.value = K(Sv, KEYS.show8) * K(Sv, KEYS.rhinoShow);
  W.WU.uShow.value = K(Sv, [[10.15, 0], [10.4, 1]]);

  const g = Math.floor(gone);
  if (g !== rhinoCount) { if (g > rhinoCount && g <= 49) sound.thump(g > 41); rhinoCount = g; }
  counters.ele = fmt(K(Sv, [[1.5, 0], [1.66, 3000]]));
  counters.ele2 = fmt(21 + P.alive * 2979);
  counters.rhino = String(Math.min(41, g));
  counters.rhino8 = String(clamp(g - 41, 0, 8));
  counters.haA = fmt(Math.round(K(Sv, [[6.18, 0], [6.34, 40000]]) / 100) * 100);
  counters.haB = fmt(Math.round(K(Sv, [[6.57, 0], [6.73, 35000]]) / 100) * 100);
  counters.km = Math.round(clamp((Sv - 7) / 0.95) * 100);
  sound.setNight(a.night);
}

/* ---------------------------------------------------------------- beats */
const beats = [];
let counterEls = [];
let shade = '';
function setupBeats() {
  $$('.beat').forEach((el) => {
    const b = { el, s: parseFloat(el.dataset.s), e: parseFloat(el.dataset.e), state: '' };
    b.shade = el.classList.contains('pos-c') ? 'c' : el.classList.contains('pos-w') ? 'w' : el.classList.contains('frame') ? '' : 'l';
    let order = 0;
    $$('.split, .rv', el).forEach((n) => {
      if (n.classList.contains('split')) {
        n.style.setProperty('--dl', `${order * 120}ms`);
        SplitText.create(n, { type: 'lines', mask: 'lines', linesClass: 'ln', autoSplit: true, onSplit(self) { self.lines.forEach((l, i) => l.style.setProperty('--i', i)); } });
      } else n.style.setProperty('--d', order * 120);
      order++;
    });
    beats.push(b);
  });
  counterEls = $$('[data-k]').map((el) => ({ el, k: el.dataset.k, v: '' }));
}
function updateBeats(Sv) {
  let want = '';
  for (const b of beats) {
    const st = !ready ? '' : Sv < b.s ? '' : Sv <= b.e ? 'on' : 'out';
    if (st === 'on' && b.shade) want = b.shade;
    if (st !== b.state) {
      b.el.classList.toggle('on', st === 'on');
      b.el.classList.toggle('out', st === 'out');
      b.state = st;
    }
  }
  if (!ready) want = 'b';
  if (want && want !== shade) { document.body.dataset.shade = want; shade = want; }
  for (const c of counterEls) {
    const v = counters[c.k];
    if (v !== undefined && v !== c.v) { c.el.textContent = v; c.v = v; }
  }
}

/* ---------------------------------------------------------------- chrome */
const ui = {};
let lastCh = -1;
function setupChrome() {
  ui.num = $('.bar-num'); ui.name = $('.bar-name'); ui.fill = $('.bar-fill'); ui.cue = $('#cue');
  const ticks = $('.bar-ticks'), ix = $('.ix-list');
  chapters.forEach((c, i) => {
    const n = String(i).padStart(2, '0');
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-go="${i}" aria-label="Chapter ${n}: ${c.dataset.name}"><span>${n} · ${c.dataset.name}</span></button>`;
    ticks.appendChild(li);
    const il = document.createElement('li');
    il.style.setProperty('--i', i);
    il.innerHTML = `<button type="button" data-go="${i}"><b>${n}</b><span>${c.dataset.name}</span></button>`;
    ix.appendChild(il);
  });
  ui.ticks = $$('li', ticks); ui.ix = $$('li', ix);
  placeTicks();
  const index = $('#index'), openB = $('#openIndex');
  const setIndex = (on) => {
    index.classList.toggle('open', on); index.setAttribute('aria-hidden', String(!on)); openB.setAttribute('aria-expanded', String(on));
    if (on) { lenis.stop(); setTimeout(() => $('.ix-list li.is-on button, .ix-list button')?.focus({ preventScroll: true }), 300); } else lenis.start();
  };
  openB.addEventListener('click', () => setIndex(!index.classList.contains('open')));
  $('#closeIndex').addEventListener('click', () => setIndex(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setIndex(false); });
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go) return;
    e.preventDefault();
    const i = parseInt(go.dataset.go, 10);
    setIndex(false);
    const target = i === 10 && go.classList.contains('btn-solid') ? 10.6 : i + (i ? 0.06 : 0);
    const dist = Math.abs(target - S);
    lenis.scrollTo(yForS(target), { duration: clamp(1.4 + dist * 0.4, 1.4, 5), easing: (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) });
  });
}
function placeTicks() { ui.ticks.forEach((li, i) => { li.style.left = `${(tops[i] / maxScroll) * 100}%`; }); }
function updateChrome(Sv, y) {
  const ch = clamp(Math.floor(Sv), 0, NCH - 1);
  if (ch !== lastCh) {
    lastCh = ch;
    const name = chapters[ch].dataset.name, num = String(ch).padStart(2, '0');
    gsap.to([ui.num, ui.name], {
      yPercent: -80, opacity: 0, duration: .25, ease: 'power2.in', onComplete() {
        ui.num.textContent = num; ui.name.textContent = name;
        gsap.fromTo([ui.num, ui.name], { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: 'power3.out', stagger: .05 });
      }
    });
    ui.ticks.forEach((li, i) => { li.classList.toggle('is-on', i === ch); li.classList.toggle('done', i < ch); });
    ui.ix.forEach((li, i) => li.classList.toggle('is-on', i === ch));
  }
  ui.fill.style.transform = `scaleX(${clamp(y / maxScroll)})`;
  ui.cue.style.opacity = ready && Sv < 0.12 ? 1 : 0;
}

/* ---------------------------------------------------------------- labels in the world */
const tags = [];
function setupTags() {
  if (!world) return;
  const W = world, layer = $('#tags');
  const mk = (label, sub, get, keys, cls = '', lh = 40, slot, fr = 5) => {
    const el = document.createElement('div');
    el.className = `tag ${cls}`;
    el.style.setProperty('--lh', `${lh}px`);
    el.innerHTML = `<i class="tg-dot"></i><i class="tg-line"></i><span>${label}${sub ? `<b>${sub}</b>` : ''}</span>`;
    layer.appendChild(el);
    const t = { el, get, keys, o: {}, sub: el.querySelector('b'), slot, fr };
    tags.push(t);
    return t;
  };
  const onPath = (path, t, lift = 2, off = 0) => { const p = path.at(t); const x = p.x + p.nx * off, z = p.z + p.nz * off; return () => [x, W.heightAt(x, z) + lift, z]; };
  mk('Huab River', 'Dry riverbed', onPath(W.corridor, 0.36, 3), [[1.06, 0], [1.16, 1], [1.92, 1], [2.04, 0]], '', 54, 0, 7);
  mk('New fence line', 'Farm boundary', () => { const w = W.walls[2]; return [w.x, w.y + 4, w.z]; }, [[2.16, 0], [2.24, 1], [2.6, 1], [2.68, 0]], '', 46, 1, 5);
  mk('Black rhino', 'Protected range', () => [W.rhino.x - 40, W.heightAt(W.rhino.x - 40, W.rhino.z + 50) + 2, W.rhino.z + 50], [[3.08, 0], [3.18, 1], [3.95, 1], [4.05, 0]], '', 46, 2, 9);
  const R = 120;
  ['Security', 'Land', 'Corridor', 'Coexistence'].forEach((n, q) => {
    const a = ((q + 0.5) / 4) * Math.PI * 2;
    const x = Math.sin(a) * (R + 26), z = -Math.cos(a) * (R + 26);
    const t = mk(`0${q + 1}`, n, () => [x, 0, z], [[5.06, 0], [5.16, 1], [5.98, 1], [6.06, 0]], q < 2 ? 't-flat t-left' : 't-flat');
    t.quad = q;
  });
  mk('Centre', 'Secured, living ground', () => [0, 0, 0], [[5.06, 0], [5.16, 1], [5.98, 1], [6.06, 0]], 't-flat t-center');
  const A = W.sites.gondwana, B = W.sites.huab;
  mk('Gondwana ERP', '40,000 ha secured', () => [A.x + A.r * .7, W.heightAt(A.x, A.z) + 4, A.z - A.r * .7], [[6.2, 0], [6.28, 1], [6.46, 1], [6.54, 0]], '', 60);
  mk('Huab corridor', '35,000 ha secured', () => [B.x + B.r * .7, W.heightAt(B.x, B.z) + 4, B.z - B.r * .7], [[6.6, 0], [6.68, 1], [6.97, 1], [7.03, 0]], '', 60);
  const km = mk('Fish River Canyon Ultra', 'Kilometre 0', () => {
    const p = clamp((Sd - 7) / 0.95); const c = W.canyon.at(0.14 + 0.68 * p + 0.11);
    return [c.x, W.heightAt(c.x, c.z) + 3, c.z];
  }, [[7.04, 0], [7.12, 1], [7.86, 1], [7.92, 0]], '', 34);
  km.isKm = true;
}
function updateTags(Sv) {
  const F = world.TU.uFocus.value; F.forEach((f) => { f.w = 0; });
  for (const t of tags) {
    let vis = K(Sv, t.keys) * introS.k;
    if (vis < 0.01) { if (t.el.style.opacity !== '0') t.el.style.opacity = '0'; continue; }
    const [x, y, z] = t.get();
    world.project(x, y, z, t.o);
    if (t.slot !== undefined) F[t.slot].set(x, z, t.fr, vis);
    if (!t.o.on) vis = 0;
    if (t.quad !== undefined) { const q = world.TU.uQuad.value, qa = world.TU.uQuadAmt.value; vis *= lerp(0.8, Math.max(0.32, 1 - Math.abs(q - t.quad)), qa); }
    if (t.isKm && t.sub) t.sub.textContent = `Kilometre ${counters.km}`;
    t.el.style.opacity = vis.toFixed(3);
    t.el.style.transform = `translate3d(${t.o.x.toFixed(1)}px, ${t.o.y.toFixed(1)}px, 0)`;
  }
}

/* ---------------------------------------------------------------- pointer: gentle parallax only */
function setupPointer() {
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });
}

/* ---------------------------------------------------------------- sound */
const sound = { on: false, ctx: null, thump() {}, setNight() {} };
function setupSound() {
  const btn = $('#sound');
  btn.addEventListener('click', () => {
    if (!sound.ctx) build();
    sound.on = !sound.on;
    btn.setAttribute('aria-pressed', String(sound.on));
    btn.querySelector('span').textContent = sound.on ? 'Sound on' : 'Sound';
    const now = sound.ctx.currentTime;
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setTargetAtTime(sound.on ? 0.9 : 0, now, 0.6);
    if (sound.on) sound.ctx.resume();
  });
  function build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.45;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 220;
    lfo.connect(lg); lg.connect(bp.frequency);
    src.connect(bp); bp.connect(wg); wg.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.3;
    const dg = ctx.createGain(); dg.gain.value = 0.05;
    [55, 82.41, 110.3, 164.8].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i > 1 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; const g = ctx.createGain(); g.gain.value = i > 1 ? 0.35 : 1; o.connect(g); g.connect(lp); o.start(); });
    lp.connect(dg); dg.connect(master);
    src.start(); lfo.start();
    Object.assign(sound, {
      ctx, master,
      setNight(n) { if (!sound.on) return; lp.frequency.setTargetAtTime(260 + (1 - n) * 520, ctx.currentTime, 0.8); bp.frequency.setTargetAtTime(380 + (1 - n) * 160, ctx.currentTime, 1.5); },
      thump(ember) {
        if (!sound.on) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(ember ? 92 : 74, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.4);
      }
    });
  }
}

/* ---------------------------------------------------------------- form */
function setupForm() {
  $('#starter').addEventListener('submit', (e) => {
    e.preventDefault();
    const who = new FormData(e.target).get('who') || 'interested';
    const subject = encodeURIComponent('A first conversation with Sentinel');
    const body = encodeURIComponent(`Hello Tinus,\n\nI am ${who}, and I would like to talk about a piece of land, a corridor question or a funding proposal.\n\n`);
    location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });
}

/* ---------------------------------------------------------------- loop */
function tick(now, manual) {
  const t = Math.max(now / 1000, lastT);
  const dt = clamp(t - lastT, 0.001, 0.05);
  lastT = Math.max(lastT, t);
  lenis.raf(now);
  const y = lenis.scroll;
  S = computeS(y);
  Sd += (S - Sd) * (1 - Math.exp(-dt * (reduce ? 30 : 6)));
  if (Math.abs(S - Sd) < 1e-4) Sd = S;
  direct(Sd, t, dt);
  updateBeats(Sd);
  updateChrome(Sd, y);
  if (world) { updateTags(Sd); world.frame(t); }
  if (!manual) requestAnimationFrame(tick);
}

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (world) world.resize(); measure(); if (ui.ticks) placeTicks(); }, 120);
});

// verification helpers: advance time by hand when the tab is throttled
let fakeNow = 0, gt = null;
function step(n = 60, ms = 16.7) {
  if (!fakeNow) fakeNow = performance.now();
  if (gt === null) gt = gsap.ticker.time;
  for (let i = 0; i < n; i++) { fakeNow += ms; gt += ms / 1000; gsap.updateRoot(gt); tick(fakeNow, true); }
}
function go(s, n = 200) { lenis.scrollTo(yForS(s), { immediate: true, force: true }); step(n); setTimeout(() => step(4), 900); setTimeout(() => step(4), 1800); }
window.__sentinel = { get world() { return world; }, get S() { return Sd; }, lenis, yForS, step, go };
boot();
