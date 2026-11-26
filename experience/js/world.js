// Sentinel — the world. A lit, living Namibian landscape rendered in real time.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSimplex(rand) {
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const grad = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return function (x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { g = (perm[ii + perm[jj]] & 7) * 2; tt *= tt; n += tt * tt * (grad[g] * x0 + grad[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; tt *= tt; n += tt * tt * (grad[g] * x1 + grad[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; tt *= tt; n += tt * tt * (grad[g] * x2 + grad[g + 1] * y2); }
    return 70 * n;
  };
}

function makePath(pts, n = 360) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = cum[cum.length - 1];
  const xs = new Float32Array(n), zs = new Float32Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * L;
    while (j < dense.length - 2 && cum[j + 1] < d) j++;
    const f = (d - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-6);
    xs[k] = lerp(dense[j][0], dense[j + 1][0], f);
    zs[k] = lerp(dense[j][1], dense[j + 1][1], f);
  }
  let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity;
  for (let k = 0; k < n; k++) { zmin = Math.min(zmin, zs[k]); zmax = Math.max(zmax, zs[k]); xmin = Math.min(xmin, xs[k]); xmax = Math.max(xmax, xs[k]); }
  return {
    L, n, xs, zs,
    atInto(t, o) {
      t = clamp(t);
      const f = t * (n - 1), i = Math.min(Math.floor(f), n - 2), fr = f - i;
      o.x = lerp(xs[i], xs[i + 1], fr); o.z = lerp(zs[i], zs[i + 1], fr);
      let tx = xs[i + 1] - xs[i], tz = zs[i + 1] - zs[i];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      o.tx = tx; o.tz = tz; o.nx = -tz; o.nz = tx;
      return o;
    },
    at(t) { return this.atInto(t, {}); },
    nearest(x, z) {
      const lo = Math.max(0, x - xmax, xmin - x, z - zmax, zmin - z);
      if (lo > 150) return [999, 0];
      let best = 1e12, bi = 0;
      for (let k = 0; k < n; k += 8) { const dx = xs[k] - x, dz = zs[k] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = k; } }
      const a = Math.max(0, bi - 8), b = Math.min(n - 1, bi + 8);
      for (let k = a; k <= b; k++) { const dx = xs[k] - x, dz = zs[k] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = k; } }
      return [Math.sqrt(best), bi / (n - 1)];
    }
  };
}

/* ================================================================ shaders */

const COMMON = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSkyCol, uBounceCol, uFogCol, uInscatter;
uniform float uFogStart, uFogRange, uTime, uNight;
uniform sampler2D uHeight; uniform float uSize, uRes;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3. - 2.*f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s/.875; }
float fbm5(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s/.96875; }
float Hm(vec2 xz){ vec2 uv = ((xz + uSize*.5)/uSize*(uRes - 1.) + .5)/uRes; return texture2D(uHeight, uv).r; }
vec3 applyFog(vec3 col, vec3 wp){
  vec3 V = wp - cameraPosition; float dist = length(V); vec3 vd = V/max(dist, 1e-3);
  float x = max(dist - uFogStart, 0.)/uFogRange;
  float hf = .55 + .45*exp(-max(wp.y + 6., 0.)*.03);
  float f = 1. - exp(-x*x*hf);
  float mu = max(dot(vd, normalize(uSunDir)), 0.);
  vec3 fc = mix(uFogCol, uInscatter, pow(mu, 7.)*.85);
  return mix(col, fc, clamp(f, 0., 1.));
}
`;

const TERRAIN_VS = /* glsl */`
attribute vec4 aInfo;
varying vec3 vPos; varying vec3 vN; varying vec4 vInfo;
void main(){ vPos = position; vN = normal; vInfo = aInfo; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`;

const TERRAIN_FS = /* glsl */`
${COMMON}
uniform vec3 uSand, uGravel, uRock, uBasalt, uDune, uBed, uVeg, uFenceCol, uSiteCol;
uniform float uFence, uFenceA, uFenceGlow, uRestore, uTrails, uCloud, uShadow, uReveal;
uniform vec4 uSiteA, uSiteB; uniform vec2 uSiteAmt;
uniform vec4 uRing; uniform float uRingDraw, uQuad, uQuadAmt; uniform vec4 uFocus[3]; uniform vec3 uLineCol;
varying vec3 vPos; varying vec3 vN; varying vec4 vInfo;
float aaLine(float d, float w){ float fw = max(fwidth(d), 1e-4); float ww = max(w, fw*.8); return (1. - smoothstep(ww - fw*.6, ww + fw*.6, abs(d)))*min(1., w/ww); }

float softShadow(vec3 p, vec3 L){
  if (L.y < -.02 || uShadow < .01) return 1.;
  float res = 1., t = 1.6;
  for (int i = 0; i < 26; i++){
    vec3 q = p + L*t;
    if (q.y > 70.) break;
    float d = q.y - Hm(q.xz);
    res = min(res, 8.*d/t);
    if (res < 0.) break;
    t += max(2.2, t*.19);
  }
  return mix(1., clamp(res, 0., 1.), uShadow);
}

void main(){
  vec3 Ng = normalize(vN);
  vec2 p = vPos.xz;
  float h = vPos.y;
  float rd = vInfo.x, rt = vInfo.y, cd = vInfo.z, mask = vInfo.w;
  float dist = length(vPos - cameraPosition);
  float near = 1. - smoothstep(160., 520., dist);

  // micro relief
  float e = .7;
  float n0 = fbm3(p*.32), nx = fbm3((p + vec2(e, 0.))*.32), nz = fbm3((p + vec2(0., e))*.32);
  vec3 N = normalize(Ng + vec3(n0 - nx, 0., n0 - nz)*2.2*near);
  float slope = 1. - Ng.y;

  float large = fbm3(p*.011), mid = fbm3(p*.075), fine = vnoise(p*1.3);
  // ground materials
  vec3 plains = mix(uGravel, uSand, smoothstep(.38, .66, large));
  plains *= .86 + mid*.28;
  float west = smoothstep(-120., -330., p.x);
  float ripple = .5 + .5*sin(p.x*1.1 + p.y*.35 + mid*5.);
  vec3 dunes = uDune*(.88 + .16*ripple)*(.9 + large*.2);
  vec3 base = mix(plains, dunes, west);
  float strata = .5 + .5*sin(h*1.35 + mid*3.2 + large*4.);
  vec3 rock = mix(uRock, uBasalt, smoothstep(.35, .7, fbm3(p*.018 + 4.)))*(.78 + .38*strata);
  float rockAmt = clamp(smoothstep(.14, .42, slope) + mask*smoothstep(9., 28., h)*.55, 0., 1.);
  base = mix(base, rock, rockAmt);
  float canyon = exp(-pow(cd/26., 2.));
  base = mix(base, mix(uRock, uBasalt, .25)*(.7 + .45*strata), canyon*smoothstep(.08, .3, slope));
  float bed = exp(-pow(rd/8.5, 2.));
  base = mix(base, uBed*(.92 + fine*.12), bed*.9);
  float bank = exp(-pow(rd/20., 2.))*(1. - bed*.7);
  float veg = bank*smoothstep(.38, .82, fbm3(p*.16));
  veg += uRestore*exp(-pow(rd/34., 2.))*smoothstep(.45, .7, fbm3(p*.3))*.6;

  // secured ground recovers
  float sA = (1. - smoothstep(-3., 3., length(p - uSiteA.xy) - uSiteA.z*uSiteAmt.x))*uSiteAmt.x;
  float sB = (1. - smoothstep(-3., 3., length(p - uSiteB.xy) - uSiteB.z*uSiteAmt.y))*uSiteAmt.y;
  float secured = max(sA, sB);
  veg += secured*smoothstep(.35, .8, fbm3(p*.18))*.6;
  base = mix(base, uVeg*(.9 + fine*.12), clamp(veg, 0., 1.)*.42);
  base *= .93 + fine*.14;

  // the cut: irregular farm parcels and fence tracks, as seen from the air
  vec2 q = (p + 22.*vec2(vnoise(p*.008), vnoise(p*.008 + 17.)))/72.;
  vec2 gi = floor(q), gf = fract(q);
  float f1 = 8., f2 = 8.; vec2 cid = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 r = o + vec2(hash(gi + o), hash(gi + o + 31.7))*.85 - gf;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; cid = gi + o; } else if (d < f2) { f2 = d; }
  }
  float dEdge = (sqrt(f2) - sqrt(f1))*72.*.5;
  float rnd = hash(cid);
  float cleared = uRestore*(1. - smoothstep(22., 48., rd));
  float on = smoothstep(rnd, rnd + .05, uFence*1.08)*(1. - cleared);
  float sel = hash(cid + 3.);
  base = mix(base, base*vec3(1.06, 1.02, .94), on*step(.5, sel)*.7);
  base = mix(base, base*vec3(.84, .86, .82), on*step(.84, sel)*.7);
  float fw = max(fwidth(dEdge), .002);
  float track = (1. - smoothstep(.22 - fw, .22 + fw*1.5, dEdge))*on*(1. - smoothstep(260., 620., dist));
  base = mix(base, uBed*1.05, track*.38*uFenceA);

  // old game trails beside the river
  float tw = rd + (vnoise(p*.045) - .5)*12.;
  float twf = max(fwidth(tw), .002)*1.5;
  float trail = (1. - smoothstep(.2, .2 + twf, abs(tw - 15.))) + (1. - smoothstep(.2, .2 + twf, abs(tw - 31.)));
  trail *= smoothstep(.35, .55, vnoise(vec2(rt*70., 3.)))*(1. - on)*near;
  base = mix(base, uBed*1.06, trail*.5*uTrails);

  // light
  vec3 L = normalize(uSunDir);
  float sh = softShadow(vPos + Ng*.4, L);
  float cloud = 1. - uCloud*smoothstep(.52, .8, fbm3(p*.0042 + uTime*vec2(.006, .0025)));
  float ndl = max(dot(N, L), 0.);
  float avg = (Hm(p + vec2(7., 0.)) + Hm(p - vec2(7., 0.)) + Hm(p + vec2(0., 7.)) + Hm(p - vec2(0., 7.)))*.25;
  float ao = clamp(1. - (avg - h)*.06, .42, 1.);
  vec3 amb = mix(uBounceCol, uSkyCol, N.y*.5 + .5)*ao;
  vec3 col = base*(uSunCol*ndl*sh*cloud + amb);

  // emissive story marks
  col += uFenceCol*track*uFenceGlow*uFenceA*.16;

  col = applyFog(col, vPos);
  vec3 E = vec3(0.);
  if (uRing.w > .001){
    vec2 rp = p - uRing.xy; float rr = length(rp), R = uRing.z;
    float an = fract(atan(rp.x, -rp.y)/6.2831853 + 1.);
    float drawn = smoothstep(an - .002, an + .004, uRingDraw);
    float qf = an*4., qi = floor(qf), qe = abs(fract(qf) - .5);
    float gap = 1. - smoothstep(.478, .488, qe);
    float act = mix(.45, 1. - smoothstep(0., 1., abs(qi - uQuad)), uQuadAmt);
    float arc = aaLine(rr - R, mix(.3, .75, act))*gap;
    float glow = exp(-abs(rr - R)/mix(1.6, 5., act))*mix(.08, .55, act)*gap;
    float tw = abs(fract(an*96. + .5) - .5)*6.2831853*rr/96.;
    float tick = aaLine(tw, .14)*step(R + 3., rr)*step(rr, R + 7.);
    float mw = abs(fract(an*12. + .5) - .5)*6.2831853*rr/12.;
    float tickM = aaLine(mw, .24)*step(R + 3., rr)*step(rr, R + 12.);
    float inner = aaLine(rr - R*.6, .16)*.55 + aaLine(rr - R*.08, .2)*.8;
    float dq = abs(fract(an - (uQuad + .5)/4. + .5) - .5);
    float pulse = exp(-pow(dq*34., 2.))*uQuadAmt*aaLine(rr - R, 1.6);
    float sect = act*uQuadAmt*(1. - smoothstep(R - 3., R, rr))*smoothstep(R*.08, R*.2, rr);
    E += uLineCol*(arc*1.05 + glow + (tick*.5 + tickM)*(.45 + .55*act) + inner*.6 + pulse*1.4 + sect*.05)*drawn*uRing.w;
  }
  for (int k = 0; k < 2; k++){
    vec4 st = k == 0 ? uSiteA : uSiteB; float amt = k == 0 ? uSiteAmt.x : uSiteAmt.y;
    if (amt < .001) continue;
    vec2 d = p - st.xy; float r = length(d);
    float an = fract(atan(d.x, -d.y)/6.2831853 + 1.);
    float drawn = smoothstep(an - .002, an + .004, amt*1.02);
    E += uLineCol*((aaLine(r - st.z, .4)*1.1 + exp(-abs(r - st.z)/3.)*.4)*drawn + (aaLine(r - st.w, .2)*.5 + exp(-abs(r - st.w)/2.)*.08)*smoothstep(.5, 1., amt) + (1. - smoothstep(st.z - 2., st.z, r))*.05*amt);
  }
  for (int k = 0; k < 3; k++){
    if (uFocus[k].w < .001) continue;
    float d = length(p - uFocus[k].xy), r = uFocus[k].z;
    float ph = fract(uTime*.28 + float(k)*.33);
    E += uLineCol*(aaLine(d - r, .22) + exp(-abs(d - r)/1.4)*.25 + aaLine(d - r*(1. + ph*1.3), .18)*(1. - ph)*.7 + exp(-d/(r*.35))*.16)*uFocus[k].w;
  }
  col += E;
  float r0 = length(p);
  col = mix(uFogCol*.0, col, smoothstep(uReveal, uReveal - 260., r0));
  gl_FragColor = vec4(col, 1.);
}`;

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position, 1.); gl_Position = p.xyww; }`;

const SKY_FS = /* glsl */`
uniform vec3 uSunDir, uSunCol, uFogCol, uInscatter, uZenith, uHorizon;
uniform float uSunDisc, uStars, uTime, uNight;
varying vec3 vDir;
float h3(vec3 p){ p = fract(p*.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir); vec3 L = normalize(uSunDir);
  float mu = max(dot(d, L), 0.);
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0., 1.), .5));
  vec3 fc = mix(uFogCol, uInscatter, pow(mu, 7.)*.85);
  col = mix(fc, col, smoothstep(-.015, .14, y));
  col += uInscatter*(pow(mu, 5.)*.22 + pow(mu, 48.)*.55)*(1. - uNight*.6);
  col += uSunCol*smoothstep(.99955, .99988, mu)*9.*uSunDisc;
  vec3 sp = d*300.; vec3 c = floor(sp); float hs = h3(c);
  vec3 off = vec3(h3(c + 3.1), h3(c + 7.7), h3(c + 1.3)) - .5;
  float st = step(.975, hs)*(1. - smoothstep(.02, .09, length(fract(sp) - .5 - off*.6)));
  float tw = .6 + .4*sin(uTime*(1.2 + hs*3.) + hs*60.);
  float band = exp(-pow(dot(d, normalize(vec3(.3, .55, -.78)))/.18, 2.));
  col += (vec3(1., .96, .9)*st*tw*2.4 + vec3(.5, .55, .6)*band*.04)*uStars*smoothstep(.02, .3, y);
  gl_FragColor = vec4(col, 1.);
}`;

const TREE_VS = /* glsl */`
${COMMON}
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSh;
void main(){
  float r = fract(sin(float(gl_InstanceID)*12.9898)*43758.5453);
  vec3 p = position;
  p.xz += vec2(sin(uTime*.7 + r*20.), cos(uTime*.6 + r*13.))*.05*max(p.y - 1.4, 0.);
  vec4 w = modelMatrix*instanceMatrix*vec4(p, 1.);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix*instanceMatrix)*normal);
  vC = color*(.78 + .44*r);
  // terrain shadow at the trunk
  vec3 L = normalize(uSunDir); float res = 1., t = 2.;
  vec3 b = (modelMatrix*instanceMatrix*vec4(0., 1., 0., 1.)).xyz;
  for (int i = 0; i < 10; i++){ vec3 q = b + L*t; res = min(res, 6.*(q.y - Hm(q.xz))/t); t += max(3., t*.35); }
  vSh = L.y < 0. ? 1. : clamp(res, 0., 1.);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const SOLID_FS = /* glsl */`
${COMMON}
uniform float uShadow;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSh;
void main(){
  vec3 N = normalize(vN + vec3(0., 1e-5, 0.)); vec3 L = normalize(uSunDir);
  float ndl = max(dot(N, L)*.75 + .25, 0.);
  float leaf = .72 + .5*vnoise(vW.xz*4.1 + vW.y*3.)*vnoise(vW.xz*1.3);
  vec3 col = vC*leaf*(uSunCol*ndl*mix(1., vSh, uShadow)*.9 + mix(uBounceCol, uSkyCol, N.y*.5 + .5));
  gl_FragColor = vec4(applyFog(col, vW), 1.);
}`;

const ELE_VS = /* glsl */`
${COMMON}
attribute vec4 aP; attribute vec4 aH;
uniform vec3 uEleCol;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSh; varying float vVis; varying float vGlow; varying float vRim;
void main(){
  float c = cos(aH.x), s = sin(aH.x);
  vec3 p = position*aP.w;
  float stepY = abs(sin(uTime*3.2 + aH.w*40.))*.06*aP.w;
  p = vec3(p.x*c - p.z*s, p.y + stepY, p.x*s + p.z*c);
  vec3 w = p + aP.xyz;
  vec3 n = vec3(normal.x*c - normal.z*s, normal.y, normal.x*s + normal.z*c);
  vW = w; vN = n;
  vC = uEleCol*(.86 + .26*aH.w);
  vVis = aH.z; vGlow = aH.y;
  vec3 V = normalize(cameraPosition - w);
  vRim = pow(1. - max(dot(n, V), 0.), 2.);
  vec3 L = normalize(uSunDir); float res = 1., t = 2.;
  for (int i = 0; i < 8; i++){ vec3 q = aP.xyz + vec3(0., 1.5, 0.) + L*t; res = min(res, 6.*(q.y - Hm(q.xz))/t); t += max(3., t*.4); }
  vSh = L.y < 0. ? 1. : clamp(res, 0., 1.);
  gl_Position = projectionMatrix*viewMatrix*vec4(w, 1.);
}`;

const ELE_FS = /* glsl */`
${COMMON}
uniform float uShadow; uniform vec3 uGlowCol;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSh; varying float vVis; varying float vGlow; varying float vRim;
void main(){
  if (vVis < .999 && hash(gl_FragCoord.xy) > vVis) discard;
  vec3 N = normalize(vN); vec3 L = normalize(uSunDir);
  float ndl = max(dot(N, L)*.8 + .2, 0.);
  vec3 col = vC*(uSunCol*ndl*mix(1., vSh, uShadow) + mix(uBounceCol, uSkyCol, N.y*.5 + .5));
  col += uGlowCol*vGlow*(.35 + vRim*2.2);
  gl_FragColor = vec4(applyFog(col, vW), 1.);
}`;

// contact + cast shadows for trees and animals, stretched away from the sun
const SHADOW_VS = /* glsl */`
${COMMON}
attribute vec4 aP; attribute vec4 aH;
uniform float uLen, uWid, uIsTree;
varying vec2 vUv; varying float vA;
void main(){
  vec3 L = normalize(uSunDir);
  float elev = max(L.y, .07);
  vec2 dir = -normalize(L.xz + vec2(1e-4));
  float size = aP.w;
  float len = min(uLen*size/elev*.5, uLen*size*7.);
  vec2 c = aP.xz + dir*len*.42;
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 lp = position.xy;
  vec2 xz = c + dir*lp.x*(len*.58 + uWid*size*.6) + perp*lp.y*uWid*size;
  float y = Hm(xz) + .22;
  vUv = lp;
  vA = (uIsTree > .5 ? 1. : aH.z)*smoothstep(-.02, .1, L.y)*(1. - uNight*.8);
  gl_Position = projectionMatrix*viewMatrix*vec4(xz.x, y, xz.y, 1.);
}`;

const SHADOW_FS = /* glsl */`
uniform float uOpacity;
varying vec2 vUv; varying float vA;
void main(){
  float d = length(vUv);
  float a = smoothstep(1., .25, d)*uOpacity*vA;
  if (a < .004) discard;
  gl_FragColor = vec4(0., 0., 0., a);
}`;

const GLOW_VS = /* glsl */`
attribute float aIdx;
uniform float uScale, uGone, uShow, uShow8, uTime;
varying float vA; varying float vEmber;
void main(){
  float gone = clamp(uGone - aIdx, 0., 1.);
  float vis = aIdx < 40.5 ? uShow : uShow8;
  vec3 p = position;
  p.y += 1.2 + gone*16.;
  vec4 mv = modelViewMatrix*vec4(p, 1.);
  float breathe = .75 + .25*sin(uTime*1.4 + aIdx*1.7);
  gl_PointSize = max((5. + sin(gone*3.14159)*5.)*uScale/ -mv.z, 4.);
  gl_Position = projectionMatrix*mv;
  vA = vis*((1. - gone)*breathe + sin(gone*3.14159)*.8);
  vEmber = max(step(40.5, aIdx), gone);
}`;

const GLOW_FS = /* glsl */`
uniform vec3 uCol, uEmber;
varying float vA; varying float vEmber;
void main(){
  vec2 p = gl_PointCoord - .5; float d = length(p);
  float a = (exp(-d*d*60.) + exp(-d*d*10.)*.25)*vA;
  if (a < .003) discard;
  gl_FragColor = vec4(mix(uCol, uEmber, vEmber)*a, a);
}`;

const RIBBON_VS = /* glsl */`
attribute float aA; attribute float aV;
uniform float uH;
varying float vA; varying float vV;
void main(){ vec3 p = position; p.y += aV*uH; vA = aA; vV = aV; gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.); }`;

const RIBBON_FS = /* glsl */`
uniform vec3 uCol; uniform float uDraw, uAlpha, uQuad, uGap, uDash;
varying float vA; varying float vV;
void main(){
  float drawn = smoothstep(vA - .004, vA, uDraw);
  float q = abs(fract(vA*4. + .5) - .5)/4.;
  float gap = mix(1., smoothstep(.003, .007, q), uGap);
  float dash = mix(1., step(.45, fract(vA*110.)), uDash);
  float qi = floor(vA*4.);
  float act = uQuad < -.5 ? 1. : (abs(qi - uQuad) < .5 ? 1.7 : .35);
  float line = exp(-vV*26.);
  float curtain = pow(1. - vV, 3.)*.28;
  float a = (line + curtain)*drawn*gap*dash*uAlpha*act;
  if (a < .002) discard;
  gl_FragColor = vec4(uCol*a, a);
}`;

const POST_FS = /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA; uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
void main(){
  vec2 c = vUv - .5;
  float k = uCA*dot(c, c);
  vec3 col = vec3(texture2D(tDiffuse, vUv - c*k).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + c*k).b);
  float v = smoothstep(.95, .2, length(c*vec2(1.05, 1.18)));
  col *= mix(1., v, uVignette);
  col += (h(vUv*uRes + fract(uTime*7.)*91.) - .5)*uGrain;
  gl_FragColor = vec4(col, 1.);
}`;

/* ================================================================ geometry helpers */

function treeGeometry(lo) {
  const parts = [];
  const tint = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const trunk = new THREE.CylinderGeometry(0.09, 0.15, 1.8, 5); trunk.translate(0, 0.9, 0);
  parts.push(tint(trunk, '#3a2e24'));
  const canopy = new THREE.IcosahedronGeometry(1, lo ? 0 : 1); canopy.scale(1.6, 0.45, 1.45); canopy.translate(0.12, 1.95, 0);
  parts.push(tint(canopy, '#3d4627'));
  if (!lo) { const c2 = new THREE.IcosahedronGeometry(1, 1); c2.scale(1.0, 0.38, 0.95); c2.translate(-0.7, 1.75, 0.4); parts.push(tint(c2, '#374024')); }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function elephantGeometry(lo) {
  const seg = lo ? [7, 5] : [12, 8];
  const parts = [];
  const add = (g) => { g.deleteAttribute('uv'); parts.push(g.index ? g.toNonIndexed() : g); };
  let g;
  g = new THREE.SphereGeometry(1, seg[0], seg[1]); g.scale(1.32, 0.95, 0.84); g.translate(0, 1.68, 0); add(g);
  g = new THREE.SphereGeometry(0.62, seg[0], seg[1]); g.scale(1, 1.05, 0.95); g.translate(1.36, 1.92, 0); add(g);
  for (const s of [-1, 1]) { g = new THREE.SphereGeometry(0.6, 7, 5); g.scale(0.12, 0.95, 0.78); g.translate(1.08, 1.92, s * 0.62); add(g); }
  g = new THREE.CylinderGeometry(0.1, 0.2, 1.5, 6); g.rotateZ(-0.22); g.translate(1.84, 1.12, 0); add(g);
  for (const [x, z] of [[0.75, 0.42], [0.75, -0.42], [-0.72, 0.42], [-0.72, -0.42]]) { g = new THREE.CylinderGeometry(0.25, 0.21, 1.3, 7); g.translate(x, 0.65, z); add(g); }
  g = new THREE.CylinderGeometry(0.03, 0.05, 0.8, 4); g.rotateZ(0.9); g.translate(-1.55, 1.5, 0); add(g);
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  return m;
}

/* ================================================================ world */

export function createWorld(canvas, opts = {}) {
  const mobile = !!opts.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);

  const rand = mulberry32(20260418);
  const noise = makeSimplex(rand);
  const fbm = (x, z, o) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f, z * f); n += a; a *= 0.5; f *= 2.02; } return s / n; };

  const corridor = makePath([[-330, 26], [-250, 38], [-170, 10], [-110, 42], [-50, 6], [10, 30], [70, -8], [130, 20], [190, -12], [250, 8], [330, -6]]);
  const canyon = makePath([[-340, 160], [-250, 150], [-170, 180], [-110, 140], [-50, 172], [10, 146], [70, 186], [130, 150], [200, 174], [260, 150], [340, 166]]);

  /* --- heights */
  const SIZE = 1100, RES = mobile ? 250 : 420, STEP = SIZE / RES, V = RES + 1;
  const H = new Float32Array(V * V), INFO = new Float32Array(V * V * 4);
  for (let r = 0; r < V; r++) {
    const z = -SIZE / 2 + r * STEP;
    for (let c = 0; c < V; c++) {
      const x = -SIZE / 2 + c * STEP;
      const [rd, rt] = corridor.nearest(x, z);
      const [cd] = canyon.nearest(x, z);
      const n = fbm(x * 0.0045, z * 0.0045, 5);
      const mask = sstep(-0.15, 0.55, noise(x * 0.0022 + 11.3, z * 0.0022 - 4.1));
      const rn = noise(x * 0.0055 + 3.1, z * 0.0055 - 7.7);
      const rg = 1 - Math.sqrt(rn * rn + 0.012);
      let h = 4 + n * 7 + mask * (rg * rg * rg * 36 + n * 10);
      const isl = Math.max(0, noise(x * 0.0062 - 5, z * 0.0062 + 2.2) - 0.5);
      const cap = 13 + n * 4;
      h += cap * (1 - Math.exp(-(isl * isl * 110) / cap)) * (1 - mask * 0.5);
      const west = sstep(-120, -330, x);
      const dune = Math.sin(x * 0.07 + z * 0.02 + noise(x * 0.01, z * 0.01) * 3) * 0.5 + 0.5;
      h = lerp(h, 3 + dune * dune * 11 + n * 4, west * 0.85);
      const kr = Math.exp(-((rd / 20) ** 2)); h = h * (1 - 0.78 * kr) - 3 * kr;
      const kc = Math.exp(-((cd / 17) ** 2)), kc2 = Math.exp(-((cd / 40) ** 2));
      h += kc2 * 16 * (0.6 + 0.4 * n);
      h -= kc * 34 + kc2 * 6;
      const st = 4.5, k = h / st, fl = Math.floor(k), fr = k - fl;
      h = lerp(h, (fl + sstep(0.2, 0.8, fr)) * st, 0.55 * sstep(0.05, 0.5, kc2));
      const i = r * V + c;
      H[i] = h; INFO[i * 4] = rd; INFO[i * 4 + 1] = rt; INFO[i * 4 + 2] = cd; INFO[i * 4 + 3] = mask;
    }
  }
  function heightAt(x, z) {
    const fx = clamp((x + SIZE / 2) / STEP, 0, RES - 0.001), fz = clamp((z + SIZE / 2) / STEP, 0, RES - 0.001);
    const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r;
    const i = r * V + c;
    return lerp(lerp(H[i], H[i + 1], u), lerp(H[i + V], H[i + V + 1], u), v);
  }
  const infoAt = (x, z) => {
    const c = clamp(Math.round((x + SIZE / 2) / STEP), 0, RES), r = clamp(Math.round((z + SIZE / 2) / STEP), 0, RES);
    const i = (r * V + c) * 4;
    return [INFO[i], INFO[i + 1], INFO[i + 2], INFO[i + 3]];
  };

  const half = new Uint16Array(V * V);
  for (let i = 0; i < V * V; i++) half[i] = THREE.DataUtils.toHalfFloat(H[i]);
  const hTex = new THREE.DataTexture(half, V, V, THREE.RedFormat, THREE.HalfFloatType);
  hTex.magFilter = hTex.minFilter = THREE.LinearFilter;
  hTex.needsUpdate = true;

  /* --- shared uniforms (lighting + atmosphere) */
  const C = (h) => new THREE.Color(h);
  const U = {
    uSunDir: { value: new THREE.Vector3(0.8, 0.12, -0.5) }, uSunCol: { value: C('#ffc690') }, uSkyCol: { value: C('#7f8ea0') },
    uBounceCol: { value: C('#a0755a') }, uFogCol: { value: C('#c7a688') }, uInscatter: { value: C('#ffcf98') },
    uFogStart: { value: 120 }, uFogRange: { value: 420 }, uTime: { value: 0 }, uNight: { value: 0 },
    uHeight: { value: hTex }, uSize: { value: SIZE }, uRes: { value: V }, uShadow: { value: 1 }
  };

  /* --- terrain */
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const aInfo = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const c = Math.round((pos.getX(i) + SIZE / 2) / STEP), r = Math.round((pos.getZ(i) + SIZE / 2) / STEP);
    const k = r * V + c;
    pos.setY(i, H[k]);
    aInfo.set(INFO.subarray(k * 4, k * 4 + 4), i * 4);
  }
  geo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 4));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();

  const TU = {
    ...U,
    uSand: { value: C('#cda47a') }, uGravel: { value: C('#b8a389') }, uRock: { value: C('#8b5a3c') }, uBasalt: { value: C('#4a3e35') },
    uDune: { value: C('#c46f3c') }, uBed: { value: C('#e4d6b8') }, uVeg: { value: C('#5c6640') },
    uFenceCol: { value: C('#ffb469').multiplyScalar(2.2) }, uSiteCol: { value: C('#ffe6b8') },
    uFence: { value: 0 }, uFenceA: { value: 1 }, uFenceGlow: { value: 0 }, uRestore: { value: 0 }, uTrails: { value: 1 },
    uCloud: { value: 0.35 }, uReveal: { value: 0 },
    uSiteA: { value: new THREE.Vector4() }, uSiteB: { value: new THREE.Vector4() }, uSiteAmt: { value: new THREE.Vector2() },
    uRing: { value: new THREE.Vector4(0, 0, 120, 0) }, uRingDraw: { value: 0 }, uQuad: { value: 0 }, uQuadAmt: { value: 0 },
    uFocus: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uLineCol: { value: C('#ffe8c6').multiplyScalar(1.5) }
  };
  const terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: TU, vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS }));
  scene.add(terrain);

  /* --- sky */
  const SU = { ...U, uZenith: { value: C('#4d6a86') }, uHorizon: { value: C('#f0bc86') }, uSunDisc: { value: 1 }, uStars: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), new THREE.ShaderMaterial({
    uniforms: SU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  /* --- sites */
  const huabC = corridor.at(0.34);
  const sites = { gondwana: { x: -24, z: 100, r: 30, outer: 67 }, huab: { x: huabC.x, z: huabC.z, r: 29, outer: 39 } };
  TU.uSiteA.value.set(sites.gondwana.x, sites.gondwana.z, sites.gondwana.r, sites.gondwana.outer);
  TU.uSiteB.value.set(sites.huab.x, sites.huab.z, sites.huab.r, sites.huab.outer);

  /* --- shadows decal material factory */
  const quad = new THREE.PlaneGeometry(2, 2);
  function shadowMesh(count, aP, aH, isTree, len, wid, opacity) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.attributes.position);
    g.setAttribute('aP', aP); g.setAttribute('aH', aH);
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      uniforms: { ...U, uLen: { value: len }, uWid: { value: wid }, uIsTree: { value: isTree ? 1 : 0 }, uOpacity: { value: opacity } },
      vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    return mesh;
  }

  /* --- acacias */
  const TN = mobile ? 1600 : 3600;
  const treeGeo = treeGeometry(mobile);
  const treeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: TREE_VS, fragmentShader: SOLID_FS, vertexColors: true });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, TN);
  const tP = new Float32Array(TN * 4), tH = new Float32Array(TN * 4);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  let placed = 0, guard = 0;
  while (placed < TN && guard++ < TN * 60) {
    const x = (rand() - 0.5) * 760, z = (rand() - 0.5) * 620;
    const [rd, , cd, mask] = infoAt(x, z);
    const h = heightAt(x, z);
    const slope = Math.abs(heightAt(x + 3, z) - heightAt(x - 3, z)) + Math.abs(heightAt(x, z + 3) - heightAt(x, z - 3));
    if (slope > 3.2) continue;
    let p = 0.006;
    if (rd < 26) p = 0.3 * Math.exp(-((rd / 12) ** 2)) + 0.03;
    if (cd < 40) p = 0;
    if (x < -150) p *= 0.15;
    p *= 1 - mask * 0.6;
    if (rand() > p) continue;
    const s = 0.65 + rand() * 0.75;
    q4.setFromAxisAngle(yAxis, rand() * Math.PI * 2);
    m4.compose(p3.set(x, h - 0.15, z), q4, s3.set(s, s * (0.85 + rand() * 0.3), s));
    trees.setMatrixAt(placed, m4);
    tP.set([x, h, z, s * 1.6], placed * 4);
    tH.set([0, 0, 1, rand()], placed * 4);
    placed++;
  }
  trees.count = placed;
  trees.frustumCulled = false;
  scene.add(trees);
  const treeShadows = shadowMesh(placed, new THREE.InstancedBufferAttribute(tP, 4), new THREE.InstancedBufferAttribute(tH, 4), true, 1.25, 1.0, 0.42);
  scene.add(treeShadows);

  /* --- elephants: every one of them */
  const N = mobile ? 1200 : 3000;
  const FENCES = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const segLo = [0, ...FENCES], segHi = [...FENCES, 1];
  const HERDS = Math.ceil(N / 22) + 2;
  const hHome = new Float32Array(HERDS), hLane = new Float32Array(HERDS), hSpeed = new Float32Array(HERDS), hPhase = new Float32Array(HERDS), hSeg = new Uint8Array(HERDS);
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  for (let g = 0; g < HERDS; g++) { hHome[g] = rand(); hLane[g] = gauss() * 44; hSpeed[g] = 0.0028 + rand() * 0.0032; hPhase[g] = rand() * 6.283; }
  hHome[0] = 0.44; hLane[0] = 5; hHome[1] = 0.65; hLane[1] = -7;
  for (let g = 0; g < HERDS; g++) { let s = 0; while (s < FENCES.length && hHome[g] > FENCES[s]) s++; hSeg[g] = s; }
  const pHerd = new Uint16Array(N), pDt = new Float32Array(N), pDl = new Float32Array(N), pSeed = new Float32Array(N), pRank = new Float32Array(N), pSize = new Float32Array(N), pHead = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pHerd[i] = i < 12 ? 0 : i < 21 ? 1 : 2 + ((i - 21) % (HERDS - 2));
    pDt[i] = gauss() * 0.006; pDl[i] = gauss() * 5; pSeed[i] = rand();
    pRank[i] = i < 21 ? -1 : rand();
    pSize[i] = rand() < 0.18 ? 0.55 + rand() * 0.15 : 0.85 + rand() * 0.25;
    pHead[i] = 0;
  }
  const eP = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const eH = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const eGeoBase = elephantGeometry(mobile);
  const eGeo = new THREE.InstancedBufferGeometry();
  eGeo.setAttribute('position', eGeoBase.attributes.position);
  eGeo.setAttribute('normal', eGeoBase.attributes.normal);
  eGeo.setAttribute('aP', eP); eGeo.setAttribute('aH', eH);
  eGeo.instanceCount = N;
  const EU = { ...U, uEleCol: { value: C('#5f5a54') }, uGlowCol: { value: C('#ffc27a').multiplyScalar(0) } };
  const elephants = new THREE.Mesh(eGeo, new THREE.ShaderMaterial({ uniforms: EU, vertexShader: ELE_VS, fragmentShader: ELE_FS }));
  elephants.frustumCulled = false;
  scene.add(elephants);
  const eleShadows = shadowMesh(N, eP, eH, false, 1.0, 1.1, 0.5);
  scene.add(eleShadows);
  const tmp = {};

  /* --- fences across the corridor: posts and wire */
  const WALL_LEN = 150, POST_GAP = 3.2;
  const posts = [], wireSegs = [];
  FENCES.forEach((ft, k) => {
    const c = corridor.at(ft);
    const n = Math.floor(WALL_LEN / POST_GAP);
    for (let s = 0; s <= n; s++) {
      const off = (s / n - 0.5) * WALL_LEN;
      const x = c.x + c.nx * off, z = c.z + c.nz * off;
      posts.push({ x, z, y: heightAt(x, z), k });
      if (s < n) {
        const off2 = ((s + 1) / n - 0.5) * WALL_LEN;
        const x2 = c.x + c.nx * off2, z2 = c.z + c.nz * off2;
        wireSegs.push({ x, z, y: heightAt(x, z), x2, z2, y2: heightAt(x2, z2), k });
      }
    }
  });
  const postGeo = new THREE.BoxGeometry(0.16, 1, 0.16); postGeo.translate(0, 0.5, 0);
  const postMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: TREE_VS, fragmentShader: SOLID_FS, vertexColors: true });
  const pc = new Float32Array(postGeo.attributes.position.count * 3).fill(0.12);
  postGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  postMesh.frustumCulled = false;
  scene.add(postMesh);
  const WIRES = 3;
  const wPos = new Float32Array(wireSegs.length * WIRES * 6);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3).setUsage(THREE.DynamicDrawUsage));
  const wireMat = new THREE.LineBasicMaterial({ color: C('#ffd29a').multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false });
  const wires = new THREE.LineSegments(wireGeo, wireMat);
  wires.frustumCulled = false;
  scene.add(wires);
  const walls = FENCES.map((ft) => { const c = corridor.at(ft); return { x: c.x, z: c.z, y: heightAt(c.x, c.z) }; });
  let lastRise = -1;
  function updateFences(rise, restore) {
    const key = rise * 1000 + restore;
    if (Math.abs(key - lastRise) < 1e-4) return;
    lastRise = key;
    const rk = (k) => sstep(0, 1, clamp(rise * 7 - k * 0.85)) * (1 - restore);
    posts.forEach((p, i) => {
      const r = rk(p.k);
      m4.compose(p3.set(p.x, p.y - (r > 0.001 ? 0.2 : 4), p.z), q4.identity(), s3.set(1, Math.max(2.1 * r, 0.002), 1));
      postMesh.setMatrixAt(i, m4);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    let o = 0;
    wireSegs.forEach((w) => {
      const r = rk(w.k);
      for (let j = 0; j < WIRES; j++) {
        const hgt = (0.55 + j * 0.62) * r * (r > 0.001 ? 1 : 0);
        const sag = 0;
        wPos[o++] = w.x; wPos[o++] = w.y - 0.2 + hgt; wPos[o++] = w.z;
        wPos[o++] = w.x2; wPos[o++] = w.y2 - 0.2 + hgt - sag; wPos[o++] = w.z2;
      }
    });
    wireGeo.attributes.position.needsUpdate = true;
    wires.visible = postMesh.visible = rise * (1 - restore) > 0.001;
  }

  /* --- rhinos: forty-one lights, then eight more */
  const RC = { x: 115, z: -100, r: 62 };
  const RH = 49, rp = [];
  while (rp.length < RH) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * RC.r * 0.92;
    const x = RC.x + Math.cos(a) * d, z = RC.z + Math.sin(a) * d * 0.85;
    if (corridor.nearest(x, z)[0] < 30) continue;
    rp.push([x, heightAt(x, z), z]);
  }
  const bp = new Float32Array(RH * 3), bi = new Float32Array(RH);
  rp.forEach((p, i) => { bp.set(p, i * 3); bi[i] = i; });
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bGeo.setAttribute('aIdx', new THREE.BufferAttribute(bi, 1));
  const GU = { uScale: { value: 400 }, uGone: { value: 0 }, uShow: { value: 0 }, uShow8: { value: 0 }, uTime: U.uTime, uCol: { value: C('#ffe2b0').multiplyScalar(5) }, uEmber: { value: C('#ff7a3d').multiplyScalar(5) } };
  const beacons = new THREE.Points(bGeo, new THREE.ShaderMaterial({ uniforms: GU, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beacons.frustumCulled = false;
  scene.add(beacons);

  /* --- rings of light: the Range Circle and secured ground */
  function ribbon(cx, cz, R, segs, height, col, fixedY) {
    const p = new Float32Array((segs + 1) * 2 * 3), aa = new Float32Array((segs + 1) * 2), av = new Float32Array((segs + 1) * 2);
    for (let s = 0; s <= segs; s++) {
      const a = s / segs, x = cx + Math.sin(a * Math.PI * 2) * R, z = cz - Math.cos(a * Math.PI * 2) * R;
      let y = -Infinity;
      for (let k = -2; k <= 2; k++) { const b = (s + k) / segs; y = Math.max(y, heightAt(cx + Math.sin(b * Math.PI * 2) * R, cz - Math.cos(b * Math.PI * 2) * R)); }
      if (fixedY !== undefined) y = fixedY;
      for (let v = 0; v < 2; v++) { const j = s * 2 + v; p[j * 3] = x; p[j * 3 + 1] = y + 0.6; p[j * 3 + 2] = z; aa[j] = a; av[j] = v; }
    }
    const idx = [];
    for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(aa, 1));
    g.setAttribute('aV', new THREE.BufferAttribute(av, 1));
    g.setIndex(idx);
    const u = { uCol: { value: C(col).multiplyScalar(3) }, uDraw: { value: 0 }, uAlpha: { value: 0 }, uQuad: { value: -1 }, uGap: { value: 0 }, uDash: { value: 0 }, uH: { value: height } };
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    return u;
  }
  const ring = ribbon(0, 0, 120, 720, 16, '#ffe3b5', 42); ring.uGap.value = 1;
  const ringInner = ribbon(0, 0, 14, 120, 4, '#ffe3b5', 42);
  const siteA = ribbon(sites.gondwana.x, sites.gondwana.z, sites.gondwana.r, 260, 9, '#ffe3b5');
  const siteAo = ribbon(sites.gondwana.x, sites.gondwana.z, sites.gondwana.outer, 400, 4, '#ffe3b5'); siteAo.uDash.value = 1;
  const siteB = ribbon(sites.huab.x, sites.huab.z, sites.huab.r, 260, 9, '#ffe3b5');
  const siteBo = ribbon(sites.huab.x, sites.huab.z, sites.huab.outer, 300, 4, '#ffe3b5'); siteBo.uDash.value = 1;

  /* --- water points */
  const WT = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75];
  const wpos = new Float32Array(WT.length * 3), wi = new Float32Array(WT.length);
  WT.forEach((t, i) => { const c = corridor.at(t), off = (i % 2 ? 1 : -1) * 18; const x = c.x + c.nx * off, z = c.z + c.nz * off; wpos.set([x, heightAt(x, z), z], i * 3); wi[i] = i; });
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  wGeo.setAttribute('aIdx', new THREE.BufferAttribute(wi, 1));
  const WU = { uScale: GU.uScale, uGone: { value: 0 }, uShow: { value: 0 }, uShow8: { value: 0 }, uTime: U.uTime, uCol: { value: C('#cfe6ff').multiplyScalar(4) }, uEmber: { value: C('#cfe6ff').multiplyScalar(4) } };
  const water = new THREE.Points(wGeo, new THREE.ShaderMaterial({ uniforms: WU, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  water.frustumCulled = false;
  scene.add(water);

  /* --- post */
  const size = new THREE.Vector2();
  const rtt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rtt);
  composer.addPass(new RenderPass(scene, camera));
  const sanitize = new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.); gl_FragColor = vec4(clamp(c, 0., 48.), 1.); }'
  });
  composer.addPass(sanitize);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.75, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const post = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.045 }, uCA: { value: 0.012 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
    fragmentShader: POST_FS
  });
  composer.addPass(post);

  const P = {
    cam: new THREE.Vector3(0, 300, 320), tgt: new THREE.Vector3(), fov: 40,
    herdFence: 0, alive: 1, herdVis: 1, boost: 0, restore: 0, wallRise: 0
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(size);
    post.uniforms.uRes.value.copy(size);
    GU.uScale.value = h * pixelRatio * 0.5;
  }
  resize();

  function updateHerds(t) {
    const fence = P.herdFence, alive = P.alive, a = eP.array, b = eH.array;
    for (let i = 0; i < N; i++) {
      const g = pHerd[i], v = hSpeed[g];
      let tf = hHome[g] + t * v + pDt[i];
      tf -= Math.floor(tf);
      const s = hSeg[g], lo = segLo[s], hi = segHi[s];
      const tp = lo + (hi - lo) * (0.5 + 0.36 * Math.sin(t * v * 9 + hPhase[g])) + pDt[i] * 0.5;
      const tt = tf + (tp - tf) * fence;
      corridor.atInto(tt, tmp);
      const lane = hLane[g] * (1 - fence * 0.4) + pDl[i] + Math.sin(t * 0.5 + pSeed[i] * 30) * 0.7;
      const x = tmp.x + tmp.nx * lane, z = tmp.z + tmp.nz * lane;
      const px = a[i * 4], pz = a[i * 4 + 2];
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz > 1e-5 && dx * dx + dz * dz < 4) {
        const target = Math.atan2(dz, dx);
        let d = target - pHead[i]; d = Math.atan2(Math.sin(d), Math.cos(d));
        pHead[i] += d * 0.08;
      } else if (dx * dx + dz * dz >= 4) pHead[i] = Math.atan2(tmp.tz, tmp.tx);
      a[i * 4] = x; a[i * 4 + 1] = heightAt(x, z) - 0.05; a[i * 4 + 2] = z;
      const edge = lerp(sstep(0, 0.05, tf) * sstep(1, 0.95, tf), 1, fence);
      const r = pRank[i];
      const vis = (r < 0 ? 1 : sstep(r, r + 0.015, alive)) * edge * P.herdVis;
      a[i * 4 + 3] = pSize[i] * (vis > 0.001 ? 1 : 0);
      b[i * 4] = pHead[i]; b[i * 4 + 1] = r < 0 ? P.boost : 0; b[i * 4 + 2] = vis; b[i * 4 + 3] = pSeed[i];
    }
    eP.needsUpdate = true; eH.needsUpdate = true;
  }

  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  function pick(nx, ny) {
    v2.set(nx, ny); ray.setFromCamera(v2, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    for (let s = 1; s < 1600; s += s < 300 ? 1.5 : 4) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if (Math.abs(x) > SIZE / 2 || Math.abs(z) > SIZE / 2) continue;
      if (y < heightAt(x, z)) return { x, y, z };
    }
    return null;
  }
  const pv = new THREE.Vector3();
  function project(x, y, z, out) {
    pv.set(x, y, z).project(camera);
    out.x = (pv.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-pv.y * 0.5 + 0.5) * window.innerHeight;
    out.on = pv.z < 1 && pv.z > -1;
    return out;
  }

  // adaptive resolution keeps the flight smooth on slower machines
  let acc = 0, frames = 0, lastT = 0;
  function adapt(t) {
    const dt = t - lastT; lastT = t;
    if (dt <= 0 || dt > 0.5) return;
    acc += dt; frames++;
    if (frames >= 50) {
      const avg = acc / frames; acc = 0; frames = 0;
      if (avg > 0.024 && pixelRatio > 0.8) { pixelRatio = Math.max(0.8, pixelRatio - 0.15); resize(); }
    }
  }

  function frame(t) {
    adapt(t);
    U.uTime.value = t;
    post.uniforms.uTime.value = t;
    camera.position.copy(P.cam);
    camera.lookAt(P.tgt);
    if (camera.fov !== P.fov) { camera.fov = P.fov; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
    updateHerds(t);
    updateFences(P.wallRise, P.restore);
    composer.render();
  }

  return {
    renderer, camera, scene, composer, U, TU, SU, EU, GU, WU, P, bloom, post, ring, ringInner, siteA, siteAo, siteB, siteBo, wireMat,
    corridor, canyon, sites, walls, rhino: RC, heightAt, pick, project, frame, resize, N, SIZE
  };
}
