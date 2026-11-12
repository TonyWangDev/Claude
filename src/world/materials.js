import * as THREE from 'three';
import { FOG_FUNCS } from '../render/fog.js';

// Shared uniforms (same object references are handed to every material).
export const U = {
  uTime: { value: 0 },
  uWet: { value: 0.8 },
  uRain: { value: 0.3 },
  uReflTex: { value: null },
  uReflMatrix: { value: new THREE.Matrix4() },
  uReflOn: { value: 1 },
  uAtlas: { value: null },
  uHaze: { value: 1 },
};

const NOISE = /* glsl */ `
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// ---------------------------------------------------------------------------------------------
// City material: PBR (MeshStandardMaterial) with a procedural facade layer. Each face carries a
// facade style + seed, and the fragment shader draws windows, mullions, panel seams, interiors,
// blinds, shopfronts and grime, switching individual rooms on and off over time.
// ---------------------------------------------------------------------------------------------
const FACADE = /* glsl */ `
vec3 ncPal(float r) {
  if (r < 0.30) return vec3(1.0, 0.70, 0.40);
  if (r < 0.50) return vec3(1.0, 0.88, 0.72);
  if (r < 0.66) return vec3(0.62, 0.82, 1.0);
  if (r < 0.78) return vec3(0.25, 0.9, 1.0);
  if (r < 0.88) return vec3(1.0, 0.28, 0.62);
  if (r < 0.95) return vec3(0.62, 0.35, 1.0);
  return vec3(1.0, 0.45, 0.12);
}
`;

const FACADE_MAIN = /* glsl */ `
vec3 fcEmis = vec3(0.0);
float fcRough = 0.82;
float fcMetal = 0.0;
{
  float style = floor(vFacade.x + 0.5);
  float seed = vFacade.y;
  vec3 base = diffuseColor.rgb;
  float grime = fbm(vec2(vWPos.x + vWPos.z, vWPos.y * 0.22) * 0.35 + seed);
  float streak = vnoise(vec2((vWPos.x - vWPos.z) * 1.7, vWPos.y * 0.09));
  if (style < -0.5) {
    base *= 0.72 + 0.5 * grime;
    fcRough = 0.78 - 0.2 * streak;
    if (vGlow < -0.5) { fcMetal = 0.85; fcRough = 0.32 + 0.2 * grime; }
  } else {
    vec2 uv = vFUv;
    vec2 cell = floor(uv), f = fract(uv);
    vec2 fw = fwidth(uv) * 0.75 + 0.0015;
    float lod = smoothstep(0.3, 1.1, max(fw.x, fw.y));
    vec4 wr = vec4(0.18, 0.82, 0.25, 0.80); // x0 x1 y0 y1
    float prob = 0.42, gain = 1.0, colMix = 0.35, detail = 1.0;
    if (style == 1.0) { wr = vec4(0.05, 0.95, 0.14, 0.95); prob = 0.34; gain = 0.75; colMix = 0.12; }
    else if (style == 2.0) { wr = vec4(-0.1, 1.1, 0.36, 0.84); prob = 0.4; gain = 0.9; colMix = 0.15; }
    else if (style == 3.0) { wr = vec4(0.28, 0.72, -0.1, 1.1); prob = 0.36; gain = 0.9; colMix = 0.2; }
    else if (style == 4.0) { wr = vec4(0.03, 0.97, 0.05, 0.97); prob = 0.13; gain = 0.7; colMix = 0.1; }
    else if (style == 5.0) { wr = vec4(0.40, 0.60, 0.55, 0.70); prob = 0.06; gain = 1.6; colMix = 0.0; }
    else if (style == 6.0) { wr = vec4(0.04, 0.96, 0.05, 0.72); prob = 0.86; gain = 0.85; colMix = 1.0; }
    else if (style == 7.0) { wr = vec4(-0.1, 1.1, 0.1, 0.9); prob = 0.1; gain = 0.5; colMix = 0.0; }
    else if (style == 8.0) { wr = vec4(0.30, 0.70, 0.30, 0.74); prob = 0.36; gain = 1.1; colMix = 0.4; }

    float mx = smoothstep(wr.x - fw.x, wr.x + fw.x, f.x) * (1.0 - smoothstep(wr.y - fw.x, wr.y + fw.x, f.x));
    float my = smoothstep(wr.z - fw.y, wr.z + fw.y, f.y) * (1.0 - smoothstep(wr.w - fw.y, wr.w + fw.y, f.y));
    float win = mx * my;
    vec2 wf = clamp((f - wr.xz) / (wr.yw - wr.xz), 0.0, 1.0);

    float r1 = h21(cell + seed * 13.7);
    float r2 = h21(cell * 1.31 + seed * 5.1 + 11.0);
    float r3 = h21(cell * 0.77 + seed * 9.3 + 3.0);
    float r4 = h21(cell * 2.13 + seed * 2.9 + 7.0);
    // whole floors of offices tend to be lit or dark together
    float fl = h21(vec2(cell.y, seed * 3.3));
    float cluster = vnoise(vec2(cell.x * 0.35 + seed, cell.y * 0.6));
    if (style == 1.0 || style == 2.0 || style == 4.0) prob *= 0.35 + 1.5 * fl * (0.4 + cluster);
    // a few rooms change state every now and then
    float flip = floor(uTime * 0.07 + r2 * 40.0) * step(0.86, r4);
    float lit = step(1.0 - prob, h21(cell + seed * 13.7 + flip * 3.1));
    lit = mix(lit, prob, lod);

    vec3 bcol = ncPal(h11(seed * 7.7 + 0.3));
    vec3 wcol = mix(bcol, ncPal(r3), colMix);
    float inten = (0.35 + 1.25 * r2 * r2) * gain;

    // interior mapping: every lit window is a little room with real parallax. A ray is cast
    // from the eye through the glass into a box the size of the facade cell.
    vec3 room = vec3(0.72);
    if (style != 5.0 && style != 7.0 && lod < 0.97) {
      vec3 wN = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
      vec3 wT = normalize(cross(vec3(0.0, 1.0, 0.0), wN) + vec3(1e-5, 0.0, 0.0));
      vec3 rd = normalize(vWPos - cameraPosition);
      vec3 d = vec3(dot(rd, wT), rd.y, max(-dot(rd, wN), 1e-3));
      vec2 rs = vec2(vFacade.z, vFacade.w);
      float D = style == 6.0 ? 7.0 : 4.5;
      vec3 o = vec3(f * rs, 0.0);
      vec2 pos_ = step(0.0, d.xy);
      vec2 tw = (pos_ * rs - o.xy) * (pos_ * 2.0 - 1.0) / max(abs(d.xy), 1e-4);
      float tz = D / d.z;
      float tm = min(min(tw.x, tw.y), tz);
      vec3 hp = o + d * tm;
      if (tz <= tm + 1e-4) {
        vec2 b = hp.xy / rs;
        if (style == 6.0) {
          // shop back wall: shelves stacked with coloured goods
          vec2 it = floor(vec2(hp.x * 2.4, b.y * 6.0));
          float gap = step(0.14, fract(b.y * 6.0)) * step(0.1, fract(hp.x * 2.4));
          room = mix(vec3(0.5), ncPal(h21(it + cell * 3.1 + seed)), 0.7) * (0.45 + 0.75 * h21(it * 1.7 + seed)) * mix(0.25, 1.0, gap);
          room *= 0.6 + 0.6 * b.y;
        } else {
          room = vec3(0.8) * (0.72 + 0.28 * step(0.5, h21(floor(b * vec2(3.0, 2.0)) + cell + seed)));
          room *= 1.0 - 0.6 * step(b.y, 0.34 * h21(floor(vec2(b.x * 3.0, 1.0)) + cell + seed));
        }
      } else if (tw.y < tw.x) {
        // ceiling with light panels, or floor
        room = d.y > 0.0 ? vec3(1.3) * (0.7 + 0.3 * step(0.5, fract(hp.z * 0.7))) : vec3(0.26) * (style == 6.0 ? 1.6 : 1.0);
      } else room = vec3(0.55) * (0.8 + 0.2 * step(0.5, fract(hp.z * 0.5)));
      room *= 1.0 - 0.5 * hp.z / D;
      room = mix(room, vec3(0.72), lod);
    }
    float dt = 1.0;
    if (style == 6.0) {
      // counter silhouettes close to the glass and thin mullions
      float sil = 1.0 - 0.8 * step(wf.y, 0.16 + 0.2 * h21(floor(vec2(wf.x * 5.0, 2.0)) + cell * 1.7 + seed)) * step(0.45, h21(floor(vec2(wf.x * 5.0, 5.0)) + cell + seed));
      float mull = smoothstep(0.0, 0.01, abs(fract(wf.x * 3.0 + 0.5) - 0.5) - 0.006);
      dt = mix(1.0, sil * mull, 1.0 - lod);
      if (lit < 0.5) dt = 0.0;
      wcol = mix(ncPal(r3), vec3(1.0, 0.92, 0.8), 0.45 + 0.3 * r1);
    } else if (style == 7.0) {
      dt = 0.4 + 0.6 * step(0.5, fract(f.y * 6.0));
      wcol = vec3(1.0, 0.3, 0.08);
    } else if (style != 5.0) {
      float blinds = mix(1.0, 0.4 + 0.6 * step(0.45, fract(wf.y * 9.0)), step(0.66, r1));
      float curtain = mix(1.0, 0.35, step(wf.x, r4 * 0.8) * step(0.72, r3));
      dt = mix(blinds * curtain, 0.85, lod);
      // televisions
      if (style == 0.0 && r4 > 0.9) { wcol = vec3(0.4, 0.6, 1.0); dt *= 0.5 + 0.6 * vnoise(vec2(uTime * 7.0 + r1 * 90.0, r2 * 10.0)); }
    }
    vec3 em = wcol * inten * dt * room * lit * (style == 6.0 ? 1.0 : 1.25) * (1.0 + 1.3 * lod);

    vec3 glassDark = vec3(0.012, 0.016, 0.024);

    // wall surface
    float seamx = 1.0 - smoothstep(0.0, fw.x * 1.5 + 0.012, min(f.x, 1.0 - f.x));
    float seamy = 1.0 - smoothstep(0.0, fw.y * 1.5 + 0.02, min(f.y, 1.0 - f.y));
    float seam = max(seamx, seamy) * (1.0 - lod);
    vec3 wall = base * (0.62 + 0.55 * grime) * (1.0 - 0.45 * seam);
    wall *= 0.8 + 0.3 * h21(cell + seed);
    wall *= 1.0 - 0.35 * streak * smoothstep(0.3, 1.0, f.y);
    if (style == 5.0) wall *= 0.8 + 0.2 * step(0.5, fract(uv.x * 5.0)) * (1.0 - lod);
    float wRough = 0.8 - 0.25 * streak;
    float wMetal = 0.0;
    if (style == 4.0 || style == 1.0) { wMetal = 0.6; wRough = 0.4; }
    if (style == 5.0 || style == 7.0) { wMetal = 0.5; wRough = 0.55; }
    if (style == 6.0) {
      // fascia light box above the shop window
      float band = smoothstep(0.78, 0.79, f.y) * (1.0 - smoothstep(0.93, 0.94, f.y)) * step(0.03, f.x) * step(f.x, 0.97);
      float glyph = step(0.42, h21(floor(vec2(f.x * 16.0, 1.0)) + cell * 5.0 + seed)) * step(0.15, fract(f.x * 16.0)) * step(abs(f.y - 0.855), 0.04);
      vec3 sc = ncPal(fract(r3 + 0.37));
      float on = step(0.12, r1);
      fcEmis += band * on * (sc * 0.22 + glyph * sc * 1.8) * (1.0 - lod * 0.5);
      wall = mix(wall, vec3(0.02), band);
      // shutter when closed
      if (lit < 0.5) { glassDark = vec3(0.05, 0.055, 0.06) * (0.6 + 0.4 * step(0.5, fract(wf.y * 22.0))); }
    }
    float glassRough = lit > 0.5 ? 0.35 : 0.1;
    base = mix(wall, glassDark, win);
    fcRough = mix(wRough, (style == 6.0 && lit < 0.5) ? 0.6 : glassRough, win);
    fcMetal = mix(wMetal, (style == 6.0 && lit < 0.5) ? 0.7 : 0.92, win);
    fcEmis += em * win;
    // soft contact shadow at the foot of every facade
    base *= mix(0.55, 1.0, smoothstep(0.0, 7.0, vWPos.y));
  }
  // emissive geometry (neon tubes, strips, beacons)
  if (vGlow > 0.0) {
    float g = vGlow;
    if (g >= 100.0) { g = (g - 100.0) * step(0.55, fract(uTime * 0.55 + h11(floor(vWPos.x * 0.5) + floor(vWPos.z * 0.5)))); }
    else if (g >= 50.0) {
      float s = h11(floor(vWPos.x * 0.21) * 7.0 + floor(vWPos.z * 0.21));
      float bad = step(0.72, s);
      float fk = step(0.25, h11(floor(uTime * 14.0) + s * 91.0));
      fk = mix(1.0, fk, step(0.6, h11(floor(uTime * 0.6 + s * 10.0) + s)));
      g = (g - 50.0) * mix(1.0, fk, bad) * (0.93 + 0.07 * sin(uTime * 50.0 + s * 60.0));
    }
    fcEmis += vColor.rgb * g;
    base *= 0.2;
  }
  diffuseColor.rgb = base;
}
`;

export function makeCityMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aFacade; attribute float aGlow; attribute vec2 aUv;
flat varying vec4 vFacade; flat varying float vGlow; varying vec2 vFUv; varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vFacade = aFacade; vGlow = aGlow; vFUv = aUv; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
flat varying vec4 vFacade; flat varying float vGlow; varying vec2 vFUv; varying vec3 vWPos;
${NOISE}${FACADE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FACADE_MAIN}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = fcRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = fcMetal;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += fcEmis;`);
  };
  m.customProgramCacheKey = () => 'nc-city';
  return m;
}

// ---------------------------------------------------------------------------------------------
// Ground: asphalt / paving with procedural lane markings, puddles driven by the weather system,
// rain ripples, and a planar reflection that is blurred and vertically streaked by roughness.
// aKind: 0 = street level (road markings from world position), 1 = paved slab.
// ---------------------------------------------------------------------------------------------
const GROUND_MAIN = /* glsl */ `
vec3 gEmis = vec3(0.0);
float gRough = 0.9;
{
  vec2 wp = vWPos.xz;
  float nLarge = fbm(wp * 0.055 + 3.7);
  float nMid = fbm(wp * 0.45);
  float nFine = vnoise(wp * 9.0);
  float nGrit = h21(floor(wp * 42.0));
  vec3 alb;
  float puddleBias = 0.0;
  if (vKind < 0.5) {
    alb = vec3(0.030, 0.031, 0.034) * (0.65 + 0.5 * nMid + 0.25 * nFine) + 0.012 * nGrit;
    // patched repairs and cracks
    alb *= 1.0 - 0.3 * smoothstep(0.55, 0.6, fbm(wp * 0.16 + 40.0));
    float crack = smoothstep(0.035, 0.0, abs(fbm(wp * 0.6 + 9.0) - 0.5));
    alb *= 1.0 - 0.5 * crack;
    // street grid: streets every 90 m, wide ones through the origin
    vec2 sc = floor(wp / 90.0 + 0.5);
    vec2 so = wp - sc * 90.0;                    // offset from nearest street centre line (x: N-S street, y: E-W street)
    vec2 half_ = vec2(sc.x == 0.0 ? 7.5 : 4.0, sc.y == 0.0 ? 6.5 : 4.0);
    vec2 cor = vec2(sc.x == 0.0 ? 12.0 : 7.0, sc.y == 0.0 ? 10.0 : 7.0);
    bool inX = abs(so.x) < half_.x, inZ = abs(so.y) < half_.y;
    float mark = 0.0; vec3 mcol = vec3(0.55, 0.56, 0.58);
    float wear = 0.35 + 0.65 * smoothstep(0.25, 0.7, nMid + 0.3 * nFine);
    if (inX && !inZ) {
      float dz = abs(so.y) - cor.y;               // distance to the intersection corridor
      float lane = sc.x == 0.0 ? 3.6 : 0.0;
      float cl = smoothstep(0.09, 0.06, abs(abs(so.x) - 0.16));
      float dash = lane > 0.0 ? smoothstep(0.08, 0.05, abs(abs(so.x) - lane)) * step(0.5, fract(wp.y / 7.0)) : 0.0;
      float edge = smoothstep(0.08, 0.05, abs(abs(so.x) - (half_.x - 0.45)));
      float body = step(4.5, dz);
      mark = max(max(cl, dash), edge * 0.6) * body;
      if (cl > 0.5) mcol = vec3(0.75, 0.52, 0.12);
      // zebra crossing + stop line
      float zeb = step(0.6, dz) * step(dz, 3.4) * step(0.5, fract(so.x / 1.3)) * step(abs(so.x), half_.x - 0.5);
      float stop_ = step(3.9, dz) * step(dz, 4.3) * step(abs(so.x), half_.x - 0.5);
      mark = max(mark, max(zeb, stop_));
    } else if (inZ && !inX) {
      float dx = abs(so.x) - cor.x;
      float lane = sc.y == 0.0 ? 3.2 : 0.0;
      float cl = smoothstep(0.09, 0.06, abs(abs(so.y) - 0.16));
      float dash = lane > 0.0 ? smoothstep(0.08, 0.05, abs(abs(so.y) - lane)) * step(0.5, fract(wp.x / 7.0)) : 0.0;
      float edge = smoothstep(0.08, 0.05, abs(abs(so.y) - (half_.y - 0.45)));
      float body = step(4.5, dx);
      mark = max(max(cl, dash), edge * 0.6) * body;
      if (cl > 0.5) mcol = vec3(0.75, 0.52, 0.12);
      float zeb = step(0.6, dx) * step(dx, 3.4) * step(0.5, fract(so.y / 1.3)) * step(abs(so.y), half_.y - 0.5);
      float stop_ = step(3.9, dx) * step(dx, 4.3) * step(abs(so.y), half_.y - 0.5);
      mark = max(mark, max(zeb, stop_));
    }
    alb = mix(alb, mcol * 0.5, mark * wear);
    // tyre-polished wheel tracks hold more water
    puddleBias = 0.06;
  } else {
    // paving slabs
    vec2 t = wp / 1.2; vec2 tf = fract(t); vec2 ti = floor(t);
    float seam = 1.0 - smoothstep(0.0, 0.03, min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)));
    alb = vec3(0.060, 0.060, 0.066) * (0.7 + 0.35 * h21(ti) + 0.3 * nMid) * (1.0 - 0.6 * seam);
    // tactile strip / kerb edge highlight handled by geometry colour
    alb *= vColor.rgb * 4.0;
    puddleBias = -0.05;
  }
  float wet = uWet;
  float pn = nLarge * 0.65 + nMid * 0.35 + puddleBias;
  float puddle = smoothstep(0.69 - 0.22 * wet, 0.75 - 0.18 * wet, pn) * smoothstep(0.15, 0.5, wet);
  float damp = clamp(wet * 1.15, 0.0, 1.0);
  alb *= mix(1.0, 0.5, damp);
  alb = mix(alb, alb * 0.45, puddle);
  gRough = mix(mix(0.93, 0.42 + 0.25 * nFine, damp), 0.03, puddle);

  // surface normal: asphalt micro bumps + rain ripples in standing water
  vec2 e = vec2(0.035, 0.0);
  vec2 bump = vec2(vnoise((wp + e.xy) * 9.0) - vnoise((wp - e.xy) * 9.0), vnoise((wp + e.yx) * 9.0) - vnoise((wp - e.yx) * 9.0));
  bump += (vec2(vnoise((wp + e.xy) * 31.0) - vnoise((wp - e.xy) * 31.0), vnoise((wp + e.yx) * 31.0) - vnoise((wp - e.yx) * 31.0))) * 0.6;
  float gDist = length(cameraPosition - vWPos);
  vec2 nrm = bump * mix(vKind < 0.5 ? 0.34 : 0.16, 0.035, puddle) / (1.0 + gDist * 0.045);
  if (uRain > 0.01) {
    vec2 rip = vec2(0.0);
    for (int i = 0; i < 2; i++) {
      vec2 rp = wp * (1.6 + float(i) * 0.9) + float(i) * 13.1;
      vec2 ci = floor(rp), cf = fract(rp) - 0.5;
      vec2 o = h22(ci + float(i) * 7.0) - 0.5;
      float ph = fract(uTime * (0.9 + 0.5 * h21(ci)) + h21(ci * 1.7));
      vec2 d = cf - o * 0.5; float l = length(d);
      float ring = sin((l - ph * 0.45) * 60.0) * smoothstep(0.06, 0.0, abs(l - ph * 0.45)) * (1.0 - ph);
      rip += normalize(d + 1e-4) * ring * step(h21(ci + 3.3), uRain * 1.4);
    }
    nrm += rip * 0.35 * mix(0.25, 1.0, puddle);
  }
  gNrm = nrm;

  // planar reflection
  vec3 V = normalize(cameraPosition - vWPos);
  float ndv = clamp(V.y, 0.0, 1.0);
  float fres = 0.045 + 0.955 * pow(1.0 - ndv, 4.2);
  if (uReflOn > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w;
    float dist = length(cameraPosition - vWPos);
    vec2 dis = nrm * (0.9 / (1.0 + dist * 0.05));
    float streak = mix(0.004, 0.055, gRough) / (0.6 + ndv * 3.0);
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float jit = h21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5;
    for (int i = 0; i < 7; i++) {
      float k = (float(i) + jit) / 3.0 - 1.0;
      float w = 1.0 - 0.55 * abs(k);
      vec2 q = ruv + dis + vec2(dis.y * 0.3, k * streak);
      acc += texture2D(uReflTex, clamp(q, 0.002, 0.998)).rgb * w; wsum += w;
    }
    vec3 refl = acc / wsum;
    float strength = mix(0.0, mix(0.42, 1.0, puddle), damp) * (1.0 - 0.6 * gRough);
    gEmis += refl * fres * strength * 1.15;
  }
  diffuseColor.rgb = alb;
}
`;

export function makeGroundMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.12 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWet: U.uWet, uRain: U.uRain, uReflTex: U.uReflTex, uReflMatrix: U.uReflMatrix, uReflOn: U.uReflOn });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aGlow; uniform mat4 uReflMatrix;
varying float vKind; varying vec3 vWPos; varying vec4 vRefl;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vKind = aGlow; vec4 ncW = modelMatrix * vec4(position, 1.0); vWPos = ncW.xyz; vRefl = uReflMatrix * vec4(ncW.x, 0.0, ncW.z, 1.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime, uWet, uRain, uReflOn; uniform sampler2D uReflTex;
varying float vKind; varying vec3 vWPos; varying vec4 vRefl;
vec2 gNrm;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${GROUND_MAIN}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = gRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (inverseTransformDirection(normal, viewMatrix).y > 0.9) { vec3 ncWn = normalize(vec3(-gNrm.x, 1.0, -gNrm.y)); normal = normalize((viewMatrix * vec4(ncWn, 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmis;`);
  };
  m.customProgramCacheKey = () => 'nc-ground';
  return m;
}

// ---------------------------------------------------------------------------------------------
// LED screens, neon signs and holograms. One atlas, per-quad animation mode:
// 0 static, 1 horizontal ticker, 2 alternating between two ads with a wipe, 3 vertical scroll, 4 neon tube sign
// ---------------------------------------------------------------------------------------------
export function makeScreenMaterial(holo = false) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.uTime, uAtlas: U.uAtlas },
    fog: true,
    defines: holo ? { NC_HOLO: 1, NC_ADDITIVE: 1 } : {},
    transparent: holo, depthWrite: !holo, blending: holo ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: holo ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */ `
attribute vec2 aUv; attribute vec4 aRect; attribute vec4 aRect2; attribute vec4 aAnim; attribute vec2 aSize;
varying vec2 vUv; flat varying vec4 vRect; flat varying vec4 vRect2; flat varying vec4 vAnim; flat varying vec2 vSize;
#include <fog_pars_vertex>
void main() {
  vUv = aUv; vRect = aRect; vRect2 = aRect2; vAnim = aAnim; vSize = aSize;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform sampler2D uAtlas;
varying vec2 vUv; flat varying vec4 vRect; flat varying vec4 vRect2; flat varying vec4 vAnim; flat varying vec2 vSize;
#include <fog_pars_fragment>
${NOISE}
vec3 samp(vec4 r, vec2 uv) {
  vec2 q = r.xy + clamp(uv, 0.012, 0.988) * r.zw;
  return texture2D(uAtlas, q).rgb;
}
void main() {
  float mode = floor(vAnim.x + 0.5), seed = vAnim.y, speed = vAnim.z, bright = vAnim.w;
  float t = uTime * speed + seed * 37.0;
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec3 col;
  if (mode == 4.0) {
    col = samp(vRect, uv);
    float s = h11(seed * 3.1);
    float fk = step(0.3, h11(floor(uTime * 16.0) + seed * 91.0));
    fk = mix(1.0, fk, step(0.55, h11(floor(uTime * 0.5 + seed * 10.0) + seed)) * step(0.6, s));
    col *= fk * (0.92 + 0.08 * sin(uTime * 55.0 + seed * 60.0));
  } else {
    // digital glitch bursts
    float burst = step(0.975, h11(floor(t * 2.0) + seed));
    uv.x += burst * (h21(vec2(floor(uv.y * 24.0), floor(t * 24.0))) - 0.5) * 0.12;
    if (mode == 1.0) uv.x = fract(uv.x + t * 0.035);
    if (mode == 3.0) uv.y = fract(uv.y + t * 0.02);
    col = samp(vRect, uv);
    if (mode == 2.0) {
      float ph = fract(t * 0.045);
      float edge = smoothstep(0.42, 0.5, ph) - smoothstep(0.92, 1.0, ph);
      float wipe = step(uv.y + (h11(floor(uv.x * 40.0)) - 0.5) * 0.08, edge * 1.1 - 0.05);
      vec3 b = samp(vRect2, uv);
      col = mix(col, b, wipe);
      float line = smoothstep(0.03, 0.0, abs(uv.y - (edge * 1.1 - 0.05))) * step(0.01, edge) * step(edge, 0.99);
      col += vec3(0.6, 0.9, 1.0) * line;
    }
    // slow breathing sweep of light across the panel
    col *= 0.9 + 0.2 * sin(uv.y * 3.0 - t * 0.6);
    // LED pixel structure up close
    vec2 led = uv * vSize / 0.07;
    vec2 lf = abs(fract(led) - 0.5);
    float lw = max(fwidth(led.x), fwidth(led.y));
    float dotm = smoothstep(0.48, 0.30, max(lf.x, lf.y));
    col *= mix(dotm * 1.45, 1.0, smoothstep(0.25, 0.9, lw));
    col *= 1.0 + 0.05 * sin(uv.y * vSize.y * 9.0 - uTime * 5.0);
    col *= 0.96 + 0.04 * h11(floor(uTime * 30.0) + seed);
  }
  col *= bright;
  #ifdef NC_HOLO
    float scan = 0.55 + 0.45 * sin(uv.y * vSize.y * 14.0 + uTime * 6.0);
    float roll = smoothstep(0.0, 0.08, abs(fract(uv.y * 0.6 - uTime * 0.11) - 0.5));
    float flick = 0.8 + 0.2 * h11(floor(uTime * 24.0) + seed);
    col *= scan * mix(1.9, 1.0, roll) * flick;
    vec2 ed = min(uv, 1.0 - uv);
    col *= smoothstep(0.0, 0.06, min(ed.x, ed.y));
    gl_FragColor = vec4(col, 1.0);
  #else
    gl_FragColor = vec4(col + vec3(0.004, 0.005, 0.008), 1.0);
  #endif
  #include <fog_fragment>
}`,
  });
}

// ---------------------------------------------------------------------------------------------
// Additive "light in fog" geometry: soft glow cards in front of screens and volumetric cones
// under lamps / searchlights. aFacade.x: 0 = card (radial falloff), 1 = cone (falloff along v, fresnel-soft edges)
// ---------------------------------------------------------------------------------------------
export function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.uTime, uHaze: U.uHaze },
    fog: true, defines: { NC_ADDITIVE: 1 },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute vec2 aUv; attribute vec4 aFacade; attribute vec3 color;
varying vec2 vUv; varying float vType; varying vec3 vCol; varying vec3 vN; varying vec3 vV; varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vUv = aUv; vType = aFacade.x; vSeed = aFacade.y; vCol = color;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
uniform float uTime, uHaze;
varying vec2 vUv; varying float vType; varying vec3 vCol; varying vec3 vN; varying vec3 vV; varying float vSeed;
#include <fog_pars_fragment>
${NOISE}
void main() {
  float a;
  float dist = length(vV);
  if (vType < 0.5) {
    vec2 d = vUv * 2.0 - 1.0;
    a = pow(clamp(1.0 - length(d), 0.0, 1.0), 2.2);
    a *= smoothstep(0.0, 0.35, abs(dot(normalize(vN), normalize(vV))));
    a *= smoothstep(1.5, 14.0, dist);
  } else {
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
    a = pow(1.0 - clamp(vUv.y, 0.0, 1.0), 1.7) * edge;
    a *= 0.7 + 0.3 * vnoise(vec2(vUv.x * 2.0 + uTime * 0.05, vUv.y * 6.0 - uTime * 0.25 + vSeed));
    a *= smoothstep(0.6, 6.0, dist);
  }
  gl_FragColor = vec4(vCol * a * uHaze, 1.0);
  #include <fog_fragment>
}`,
  });
}

// ---------------------------------------------------------------------------------------------
// Sky dome: uses the fog colour function so the horizon matches the haze exactly, plus slowly
// drifting cloud cover lit from below by the city.
// ---------------------------------------------------------------------------------------------
export function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.uTime },
    fog: true, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
uniform vec3 fogColor; uniform float fogDensity; uniform float uTime;
varying vec3 vDir;
${FOG_FUNCS}
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  vec3 c = ncFogColor(d, fogColor);
  float up = max(d.y, 0.0);
  vec2 cp = d.xz / (up + 0.18) * 1.4 + uTime * 0.004;
  float cl = fbm(cp) * 0.7 + fbm(cp * 2.7 + 5.0) * 0.3;
  float m = smoothstep(0.38, 0.75, cl) * smoothstep(0.02, 0.5, up);
  vec3 lit = mix(vec3(0.20, 0.07, 0.22), vec3(0.07, 0.13, 0.24), vnoise(cp * 0.6 + 9.0));
  c += lit * m * 0.16 * (fogColor.b * 9.0);
  gl_FragColor = vec4(c, 1.0);
}`,
  });
}
