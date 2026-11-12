import * as THREE from 'three';
import { frame, fpt } from './geo.js';
import { NEON, NEON_KEYS, WALLS } from '../config.js';

// Building generators. A building is assembled from a podium with shopfronts, one of several
// shaft typologies, a roof kit, and dressing (billboards, blade signs, neon trim, beacons).

const METAL = { color: [0.09, 0.095, 0.105], glow: -1 };
const DARK = { color: [0.035, 0.037, 0.042] };
const tmpC = new THREE.Color();
export const hexLin = (hex, k = 1) => { tmpC.set(hex); return [tmpC.r * k, tmpC.g * k, tmpC.b * k]; };
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

export function addCollider(C, x0, y0, z0, x1, y1, z1) { C.colliders.push([x0, y0, z0, x1, y1, z1]); }
export function addLight(C, x, y, z, color, intensity, range = 46) { C.lights.push({ x, y, z, r: color[0], g: color[1], b: color[2], i: intensity, range }); }

// ---- dressing -------------------------------------------------------------------------------

export function neonBox(g, x0, y0, z0, x1, y1, z1, color, glow = 3) {
  g.box(x0, y0, z0, x1, y1, z1, { color, glow, bottom: true });
}

// Large LED screen on a wall, with frame, fog glow and a pooled light.
export function billboard(C, g, f, u0, u1, y0, y1, o = {}) {
  const r = C.rng, w = u1 - u0, h = y1 - y0, out = o.out ?? 0.7;
  const ad = o.ad || C.atlas.pickBig(r, w / h);
  const ad2 = C.atlas.pickBig(r, w / h);
  const mode = o.mode ?? (r.chance(0.55) ? 2 : 0);
  const bright = o.bright ?? r.range(1.5, 2.3);
  // frame + brackets
  g.wall(f, u0 - 0.35, u1 + 0.35, y0 - 0.35, y1 + 0.35, out - 0.06, DARK);
  const a = fpt(f, u0 - 0.35, 0), b = fpt(f, u1 + 0.35, out - 0.06);
  g.box(Math.min(a[0], b[0]), y0 - 0.35, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y1 + 0.35, Math.max(a[1], b[1]), { ...METAL, bottom: true });
  (o.holo ? C.holo : C.screens).wall(f, u0, u1, y0, y1, out, ad.rect, ad2.rect, [mode, r.range(0, 100), r.range(0.7, 1.3), bright]);
  const col = hexLin(ad.color);
  if (!o.noGlow) {
    const m = Math.min(w, h) * 0.9;
    C.glow.wall(f, u0 - m, u1 + m, y0 - m, y1 + m, out + 1.2, { color: mul(col, 0.075 * (o.glowK ?? 1)), style: 0 }, [0, 0, 1, 1]);
  }
  const c = fpt(f, (u0 + u1) / 2, out + Math.min(9, 3 + w * 0.25));
  if (y0 < 70) addLight(C, c[0], Math.min((y0 + y1) / 2, y0 + 14), c[1], col, Math.min(1, (w * h) / 500) * 1.0 + 0.35, 40 + Math.min(40, w));
  return ad;
}

// Vertical neon sign projecting from a wall (double sided).
export function bladeSign(C, g, f, u, y0, h, o = {}) {
  const r = C.rng;
  const pool = C.atlas.neon.filter((n) => (o.horizontal ? n.a > 1 : n.a < 1));
  const sg = r.pick(pool);
  const w = h * sg.a, t = 0.14, o0 = 0.35, o1 = o0 + w;
  const col = hexLin(sg.color);
  const anim = [4, r.range(0, 100), 1, r.range(1.8, 2.6)];
  // casing + brackets
  const pa = fpt(f, u - t, o0 - 0.05), pb = fpt(f, u + t, o1 + 0.05);
  g.box(Math.min(pa[0], pb[0]), y0 - 0.06, Math.min(pa[1], pb[1]), Math.max(pa[0], pb[0]), y0 + h + 0.06, Math.max(pa[1], pb[1]), { ...DARK, bottom: true });
  for (const by of [y0 + h * 0.15, y0 + h * 0.85]) {
    const q0 = fpt(f, u, 0), q1 = fpt(f, u, o0);
    g.tube([q0[0], by, q0[1]], [q1[0], by, q1[1]], 0.04, 4, METAL);
  }
  const A = fpt(f, u + t + 0.01, o1), B = fpt(f, u + t + 0.01, o0), Cc = fpt(f, u - t - 0.01, o0), D = fpt(f, u - t - 0.01, o1);
  C.screens.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y0 + h, B[1]], [A[0], y0 + h, A[1]], sg.rect, null, anim, w, h);
  C.screens.quad([Cc[0], y0, Cc[1]], [D[0], y0, D[1]], [D[0], y0 + h, D[1]], [Cc[0], y0 + h, Cc[1]], sg.rect, null, anim, w, h);
  if (o.light !== false && y0 < 30) { const c = fpt(f, u, o1 + 0.8); addLight(C, c[0], y0 + h * 0.4, c[1], col, 0.55, 26); }
}

// Horizontal neon shop sign flat on the wall.
export function wallSign(C, g, f, u, y, w, o = {}) {
  const r = C.rng;
  const sg = r.pick(C.atlas.neon.filter((n) => n.a > 1));
  const h = w / sg.a;
  g.wall(f, u - 0.1, u + w + 0.1, y - 0.1, y + h + 0.1, 0.2, DARK);
  C.screens.wall(f, u, u + w, y, y + h, 0.26, sg.rect, null, [4, r.range(0, 100), 1, r.range(1.8, 2.5)]);
  if (o.light) { const c = fpt(f, u + w / 2, 2.2); addLight(C, c[0], y, c[1], hexLin(sg.color), 0.5, 24); }
}

export function antenna(g, x, y, z, h, r) {
  g.tube([x, y, z], [x, y + h, z], 0.12 + h * 0.004, 5, METAL);
  for (let i = 0; i < 3; i++) {
    const yy = y + h * (0.45 + i * 0.16), l = (3 - i) * 0.5 + 0.4;
    g.tube([x - l, yy, z], [x + l, yy, z], 0.04, 4, METAL);
    if (r.chance(0.5)) g.tube([x, yy + 0.4, z - l], [x, yy + 0.4, z + l], 0.04, 4, METAL);
  }
  g.cbox(x, y + h + 0.25, z, 0.5, 0.5, 0.5, { color: NEON.red, glow: 108, bottom: true });
}

function dish(g, x, y, z, s, rot) {
  g.tube([x, y, z], [x, y + s * 0.9, z], s * 0.08, 5, METAL);
  g.prism(x, z, y + s * 0.9, y + s * 1.35, s * 0.12, s * 0.8, 10, { color: [0.2, 0.2, 0.21], rot, top: false, smooth: true });
  g.prism(x, z, y + s * 1.34, y + s * 1.36, s * 0.8, s * 0.1, 10, { color: [0.12, 0.12, 0.13], rot, top: false });
}

export function roofKit(C, g, x0, z0, x1, z1, y, lod, o = {}) {
  const r = C.rng, w = x1 - x0, d = z1 - z0;
  if (w < 5 || d < 5) { antenna(g, (x0 + x1) / 2, y, (z0 + z1) / 2, r.range(8, 22), r); return; }
  if (lod) {
    if (r.chance(0.7)) g.box(x0 + w * 0.25, y, z0 + d * 0.25, x0 + w * 0.7, y + r.range(2, 6), z0 + d * 0.65, DARK);
    if (r.chance(0.75)) antenna(g, x0 + w * r.range(0.2, 0.8), y, z0 + d * r.range(0.2, 0.8), r.range(10, 40), r);
    return;
  }
  // parapet
  const p = 0.9, t = 0.3;
  if (!o.noParapet) {
    g.box(x0, y, z0, x1, y + p, z0 + t, DARK); g.box(x0, y, z1 - t, x1, y + p, z1, DARK);
    g.box(x0, y, z0 + t, x0 + t, y + p, z1 - t, DARK); g.box(x1 - t, y, z0 + t, x1, y + p, z1 - t, DARK);
  }
  const n = Math.min(7, Math.floor((w * d) / 110) + 2);
  for (let i = 0; i < n; i++) {
    const cx = x0 + w * r.range(0.15, 0.85), cz = z0 + d * r.range(0.15, 0.85);
    const k = r.int(0, 4);
    if (k === 0) { // HVAC block with fan
      const sx = r.range(2, 4.5), sz = r.range(2, 4), h = r.range(1.4, 2.6);
      g.cbox(cx, y + h / 2, cz, sx, h, sz, { color: [0.13, 0.135, 0.14], glow: -1 });
      g.prism(cx, cz, y + h, y + h + 0.3, Math.min(sx, sz) * 0.4, Math.min(sx, sz) * 0.4, 10, { color: [0.03, 0.03, 0.03], smooth: true });
    } else if (k === 1) { // water / coolant tank
      const rad = r.range(1.2, 2.4), h = r.range(2.5, 5);
      g.prism(cx, cz, y + 1, y + 1 + h, rad, rad, 12, { color: [0.14, 0.11, 0.09], smooth: true });
      g.prism(cx, cz, y + 1 + h, y + 1.8 + h, rad, 0.2, 12, { color: [0.1, 0.085, 0.07], smooth: true, top: false });
      for (let q = 0; q < 4; q++) { const a = q * 1.57 + 0.78; g.tube([cx + Math.cos(a) * rad * 0.7, y, cz + Math.sin(a) * rad * 0.7], [cx + Math.cos(a) * rad * 0.7, y + 1, cz + Math.sin(a) * rad * 0.7], 0.1, 4, METAL); }
    } else if (k === 2) antenna(g, cx, y, cz, r.range(8, 30), r);
    else if (k === 3) dish(g, cx, y, cz, r.range(1.2, 3), r.range(0, 6));
    else { // stair bulkhead with a service light
      const sx = r.range(3, 5), sz = r.range(3, 5), h = r.range(2.6, 3.4);
      g.cbox(cx, y + h / 2, cz, sx, h, sz, { color: [0.08, 0.08, 0.085] });
      g.cbox(cx, y + h - 0.5, cz + sz / 2 + 0.05, 0.6, 0.15, 0.1, { color: r.chance(0.5) ? NEON.amber : NEON.cyan, glow: 4, bottom: true });
    }
  }
  // duct runs
  if (r.chance(0.7)) { const zz = z0 + d * r.range(0.2, 0.8); g.tube([x0 + 1, y + 0.5, zz], [x1 - 1, y + 0.5, zz], 0.35, 6, { color: [0.11, 0.11, 0.12], glow: -1 }); }
}

function cornerStrips(g, x0, z0, x1, z1, y0, y1, color, glow = 2.4, t = 0.22) {
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) neonBox(g, x - t, y0, z - t, x + t, y1, z + t, color, glow);
}
function ringStrip(g, x0, z0, x1, z1, y, color, glow = 2.2, t = 0.25, out = 0.12) {
  neonBox(g, x0 - out, y, z0 - out, x1 + out, y + t, z0, color, glow); neonBox(g, x0 - out, y, z1, x1 + out, y + t, z1 + out, color, glow);
  neonBox(g, x0 - out, y, z0, x0, y + t, z1, color, glow); neonBox(g, x1, y, z0, x1 + out, y + t, z1, color, glow);
}
function ledge(g, x0, z0, x1, z1, y, out = 0.6, t = 0.4, o = DARK) { g.box(x0 - out, y, z0 - out, x1 + out, y + t, z1 + out, { ...o, bottom: true }); }

// ---- shaft typologies -----------------------------------------------------------------------
// each returns the roof rectangle [x0,z0,x1,z1,y]

function shaftStack(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; let [x0, z0, x1, z1] = R; let y = y0;
  const n = r.int(2, 4), total = H - y0;
  const parts = []; let rem = total;
  for (let i = 0; i < n; i++) { const h = i === n - 1 ? rem : rem * r.range(0.4, 0.6); parts.push(h); rem -= h; }
  for (let i = 0; i < n; i++) {
    const h = Math.max(P.fh * 2, Math.round(parts[i] / P.fh) * P.fh);
    g.box(x0, y, z0, x1, y + h, z1, P);
    if (i === 0) addCollider(C, x0, y, z0, x1, y + h, z1);
    y += h;
    if (i < n - 1) {
      if (!lod) { ledge(g, x0, z0, x1, z1, y - 0.2); if (r.chance(0.6)) ringStrip(g, x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, y - 0.55, acc, 2.2, 0.18, 0.05); }
      const w = x1 - x0, d = z1 - z0;
      const ix0 = r.chance(0.6) ? r.range(0.06, 0.16) * w : 0, ix1 = r.chance(0.6) ? r.range(0.06, 0.16) * w : 0;
      const iz0 = r.chance(0.6) ? r.range(0.06, 0.16) * d : 0, iz1 = r.chance(0.6) ? r.range(0.06, 0.16) * d : 0;
      // mechanical floor between tiers
      g.box(x0 + 0.5, y, z0 + 0.5, x1 - 0.5, y + P.fh, z1 - 0.5, { style: 7, seed: P.seed + i, cw: 3, fh: P.fh, color: [0.05, 0.05, 0.055] });
      if (!lod && (ix0 + ix1 + iz0 + iz1) > 3 && r.chance(0.5)) roofKit(C, g, x0, z0, x1, z1, y, true);
      y += P.fh;
      x0 += ix0; x1 -= ix1; z0 += iz0; z1 -= iz1;
    }
  }
  if (r.chance(0.6)) cornerStrips(g, x0, z0, x1, z1, y - Math.min(60, parts[n - 1]), y, acc, 2.2, lod ? 0.5 : 0.2);
  return [x0, z0, x1, z1, y];
}

function shaftFin(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; const [x0, z0, x1, z1] = R;
  g.box(x0, y0, z0, x1, H, z1, P); addCollider(C, x0, y0, z0, x1, H, z1);
  const crown = P.noCrown ? 0 : r.range(4, 10), depth = lod ? 1.4 : 0.9, fw = lod ? 0.7 : 0.3;
  const fc = { color: mul(P.color, 1.5), glow: -1 };
  const sides = r.chance(0.5) ? 'ns' : r.chance(0.5) ? 'ew' : 'nsew';
  for (const s of sides) {
    const f = frame(s, x0, z0, x1, z1);
    const n = Math.max(2, Math.round(f.L / (lod ? 9 : 2 * P.cw)));
    for (let i = 0; i <= n; i++) {
      const u = (f.L * i) / n;
      const a = fpt(f, u - fw / 2, 0), b = fpt(f, u + fw / 2, depth);
      g.box(Math.min(a[0], b[0]), y0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), H + crown, Math.max(a[1], b[1]), fc);
    }
  }
  const step = Math.round(r.range(10, 16)) * P.fh;
  for (let y = y0 + step; y < H - 4; y += step) ringStrip(g, x0, z0, x1, z1, y, acc, 2.0, lod ? 0.5 : 0.22, lod ? 0.4 : 0.1);
  if (crown) ringStrip(g, x0 - depth, z0 - depth, x1 + depth, z1 + depth, H + crown - 1.0, acc, 2.0, 0.35, 0.15);
  return [x0, z0, x1, z1, H];
}

function shaftRound(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; const [x0, z0, x1, z1] = R;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rad = Math.min(x1 - x0, z1 - z0) / 2;
  const sides = r.pick([8, 12, 16]), rot = Math.PI / sides;
  const k = Math.cos(Math.PI / sides);
  g.prism(cx, cz, y0, H, rad, rad, sides, { ...P, rot });
  addCollider(C, cx - rad * k, y0, cz - rad * k, cx + rad * k, H, cz + rad * k);
  const step = Math.round(r.range(6, 12)) * P.fh;
  for (let y = y0 + step; y < H - 2; y += step) {
    g.prism(cx, cz, y - 0.5, y, rad + 0.9, rad + 0.9, sides, { ...DARK, rot, bottom: true });
    g.prism(cx, cz, y - 0.75, y - 0.5, rad + 0.75, rad + 0.75, sides, { color: acc, glow: 2.2, rot, bottom: true });
  }
  // drum + cap
  const h2 = r.range(8, 20);
  g.prism(cx, cz, H, H + h2, rad * 0.7, rad * 0.62, sides, { ...P, style: 7, rot });
  g.prism(cx, cz, H + h2, H + h2 + rad * 0.5, rad * 0.62, rad * 0.1, sides, { color: [0.07, 0.07, 0.08], rot, glow: -1 });
  g.prism(cx, cz, H + h2 - 0.6, H + h2, rad * 0.66, rad * 0.66, sides, { color: acc, glow: 3, rot, bottom: true });
  antenna(g, cx, H + h2 + rad * 0.5, cz, r.range(15, 45), r);
  return null;
}

function shaftTwin(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; const [x0, z0, x1, z1] = R;
  const alongX = x1 - x0 > z1 - z0, gap = r.range(5, 8);
  const mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const A = alongX ? [x0, z0, mid - gap / 2, z1] : [x0, z0, x1, mid - gap / 2];
  const B = alongX ? [mid + gap / 2, z0, x1, z1] : [x0, mid + gap / 2, x1, z1];
  const hA = H, hB = Math.round((H * r.range(0.72, 0.92)) / P.fh) * P.fh;
  const hh = r.chance(0.5) ? [hA, hB] : [hB, hA];
  [A, B].forEach((q, i) => { g.box(q[0], y0, q[1], q[2], hh[i], q[3], { ...P, seed: P.seed + i * 3 }); addCollider(C, q[0], y0, q[1], q[2], hh[i], q[3]); });
  const lo = Math.min(hh[0], hh[1]);
  for (let y = y0 + r.range(20, 40); y < lo - 10; y += r.range(35, 60)) {
    const bh = P.fh * 2;
    if (alongX) { const c = (z0 + z1) / 2, hw = (z1 - z0) * 0.3; g.box(mid - gap / 2, y, c - hw, mid + gap / 2, y + bh, c + hw, { ...P, style: 2, sides: 'ns', bottom: true, roofGlow: 0 }); neonBox(g, mid - gap / 2, y - 0.3, c - hw, mid + gap / 2, y, c + hw, acc, 1.0); }
    else { const c = (x0 + x1) / 2, hw = (x1 - x0) * 0.3; g.box(c - hw, y, mid - gap / 2, c + hw, y + bh, mid + gap / 2, { ...P, style: 2, sides: 'ew', bottom: true }); neonBox(g, c - hw, y - 0.3, mid - gap / 2, c + hw, y, mid + gap / 2, acc, 1.0); }
  }
  // glowing seams on the inner faces
  if (alongX) { neonBox(g, mid - gap / 2 - 0.05, y0, (z0 + z1) / 2 - 0.3, mid - gap / 2 + 0.15, hh[0], (z0 + z1) / 2 + 0.3, acc, 1.8); neonBox(g, mid + gap / 2 - 0.15, y0, (z0 + z1) / 2 - 0.3, mid + gap / 2 + 0.05, hh[1], (z0 + z1) / 2 + 0.3, acc, 1.8); }
  else { neonBox(g, (x0 + x1) / 2 - 0.3, y0, mid - gap / 2 - 0.05, (x0 + x1) / 2 + 0.3, hh[0], mid - gap / 2 + 0.15, acc, 1.8); neonBox(g, (x0 + x1) / 2 - 0.3, y0, mid + gap / 2 - 0.15, (x0 + x1) / 2 + 0.3, hh[1], mid + gap / 2 + 0.05, acc, 1.8); }
  roofKit(C, g, B[0], B[1], B[2], B[3], hh[1], lod);
  return [A[0], A[1], A[2], A[3], hh[0]];
}

function shaftTaper(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; let [x0, z0, x1, z1] = R; let y = y0;
  const n = r.int(6, 9); let h = (H - y0) / n * 1.7;
  for (let i = 0; i < n && y < H; i++) {
    const hh = Math.max(P.fh, Math.round(Math.min(h, H - y) / P.fh) * P.fh);
    g.box(x0, y, z0, x1, y + hh, z1, { ...P, seed: P.seed + i });
    if (i === 0) addCollider(C, x0, y, z0, x1, y + hh, z1);
    y += hh; h *= 0.8;
    if (!lod || i % 2 === 0) ringStrip(g, x0, z0, x1, z1, y - 0.3, acc, 1.8, lod ? 0.5 : 0.2, lod ? 0.4 : 0.1);
    const w = x1 - x0, d = z1 - z0, k = r.range(0.035, 0.07);
    if (i % 2 === 0) { x0 += w * k; x1 -= w * k; } else { z0 += d * k; z1 -= d * k; }
    if (i % 3 === 2) { x0 += w * k * 0.5; x1 -= w * k * 0.5; z0 += d * k * 0.5; z1 -= d * k * 0.5; }
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sp = r.range(25, 60);
  g.prism(cx, cz, y, y + sp, Math.min(x1 - x0, z1 - z0) * 0.22, 0.25, 4, { color: [0.08, 0.08, 0.09], glow: -1, rot: 0.785 });
  g.cbox(cx, y + sp + 0.4, cz, 0.8, 0.8, 0.8, { color: NEON.red, glow: 110, bottom: true });
  neonBox(g, cx - 0.15, y + sp * 0.3, cz - 0.15, cx + 0.15, y + sp, cz + 0.15, acc, 2.5);
  return [x0, z0, x1, z1, y];
}

function shaftCut(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; const [x0, z0, x1, z1] = R;
  const yc = y0 + Math.round(((H - y0) * r.range(0.35, 0.55)) / P.fh) * P.fh, gap = P.fh * r.int(2, 4);
  g.box(x0, y0, z0, x1, yc, z1, P); addCollider(C, x0, y0, z0, x1, yc, z1);
  const w = x1 - x0, d = z1 - z0;
  g.box(x0 + w * 0.3, yc, z0 + d * 0.3, x1 - w * 0.3, yc + gap, z1 - d * 0.3, { ...P, style: 4 });
  for (const [x, z] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) g.cbox(x, yc + gap / 2, z, 1.2, gap, 1.2, { color: mul(P.color, 0.8) });
  const ov = lod ? 0 : 1.5;
  g.box(x0 - ov, yc + gap, z0 - ov, x1 + ov, H, z1 + ov, { ...P, seed: P.seed + 5, bottom: true, roofGlow: 0 });
  // luminous soffit of the sky lobby
  g.quad([x0 - ov + 1, yc + gap - 0.02, z0 - ov + 1], [x1 + ov - 1, yc + gap - 0.02, z0 - ov + 1], [x1 + ov - 1, yc + gap - 0.02, z1 + ov - 1], [x0 - ov + 1, yc + gap - 0.02, z1 + ov - 1], [0, -1, 0], 0, 0, 1, 1, { color: acc, glow: 1.3 });
  ringStrip(g, x0, z0, x1, z1, yc - 0.3, acc, 2.2, 0.25, 0.1);
  return [x0 - ov, z0 - ov, x1 + ov, z1 + ov, H];
}

function shaftResi(C, g, R, y0, H, P, acc, lod, streets) {
  const r = C.rng; const [x0, z0, x1, z1] = R;
  // coloured panel bands every few floors
  let y = y0, i = 0;
  const band = Math.round(r.range(7, 12)) * P.fh;
  while (y < H - 0.1) {
    const hh = Math.min(band, H - y);
    const c = i % 2 ? mul(P.color, 0.8) : P.color;
    g.box(x0, y, z0, x1, y + hh, z1, { ...P, color: c, top: y + hh >= H - 0.1, seed: P.seed + i * 0.1 });
    y += hh; i++;
  }
  addCollider(C, x0, y0, z0, x1, H, z1);
  if (!lod) {
    const rail = { color: [0.05, 0.05, 0.055] }, slab = { color: mul(P.color, 0.7), bottom: true };
    for (const s of streets) {
      const f = frame(s, x0, z0, x1, z1);
      const cells = Math.max(1, Math.round(f.L / P.cw)), cwid = f.L / cells;
      const floors = Math.min(34, Math.floor((H - y0) / P.fh) - 1);
      for (let c = 0; c + 1 < cells; c += r.int(2, 4)) {
        if (r.chance(0.2)) continue;
        const span = r.chance(0.5) ? 2 : 1;
        for (let fl = 1; fl < floors; fl++) {
          if (r.chance(0.12)) continue;
          const yy = y0 + fl * P.fh + P.fh * 0.2;
          const a = fpt(f, c * cwid + 0.2, 0), b = fpt(f, (c + span) * cwid - 0.2, 1.3);
          const bx0 = Math.min(a[0], b[0]), bx1 = Math.max(a[0], b[0]), bz0 = Math.min(a[1], b[1]), bz1 = Math.max(a[1], b[1]);
          g.box(bx0, yy - 0.14, bz0, bx1, yy, bz1, slab);
          const e0 = fpt(f, c * cwid + 0.2, 1.22), e1 = fpt(f, (c + span) * cwid - 0.2, 1.3);
          g.box(Math.min(e0[0], e1[0]), yy, Math.min(e0[1], e1[1]), Math.max(e0[0], e1[0]), yy + 1.0, Math.max(e0[1], e1[1]), rail);
          if (r.chance(0.07)) { const l = fpt(f, (c + 0.5) * cwid, 1.36); g.cbox(l[0], yy + 0.6, l[1], 0.5, 0.5, 0.5, { color: NEON[r.pick(NEON_KEYS)], glow: 2.5, bottom: true }); }
        }
      }
      // air-conditioning units scattered on the facade
      for (let k = 0; k < 40; k++) {
        const u = (r.int(0, cells - 1) + 0.5) * cwid, yy = y0 + r.int(1, Math.max(2, Math.floor((H - y0) / P.fh) - 1)) * P.fh + 0.25;
        const a = fpt(f, u - 0.45, 0), b = fpt(f, u + 0.45, 0.5);
        g.box(Math.min(a[0], b[0]), yy, Math.min(a[1], b[1]), Math.max(a[0], b[0]), yy + 0.6, Math.max(a[1], b[1]), { color: [0.16, 0.16, 0.16], bottom: true });
      }
    }
  }
  return [x0, z0, x1, z1, H];
}

function shaftIndus(C, g, R, y0, H, P, acc, lod) {
  const r = C.rng; const [x0, z0, x1, z1] = R; const w = x1 - x0, d = z1 - z0;
  const hall = Math.min(H, r.range(18, 32));
  const split = r.chance(0.5);
  const hx1 = split ? x0 + w * 0.6 : x1, hz1 = split ? z1 : z0 + d * 0.6;
  g.box(x0, y0, z0, hx1, hall, hz1, { ...P, style: 5, cw: 4, fh: 4 }); addCollider(C, x0, y0, z0, hx1, hall, hz1);
  g.box(x0 + 1, hall, z0 + 1, hx1 - 1, hall + 4, hz1 - 1, { style: 7, seed: P.seed, cw: 3, fh: 4, color: [0.06, 0.055, 0.05] });
  ringStrip(g, x0, z0, hx1, hz1, hall - 0.4, NEON.orange, 2.0, 0.2, 0.1);
  // tank farm on the remaining part of the lot
  const tx0 = split ? hx1 + 1 : x0, tz0 = split ? z0 : hz1 + 1;
  const tw = x1 - tx0, td = z1 - tz0;
  addCollider(C, tx0, y0, tz0, x1, y0 + 6, z1);
  g.box(tx0, y0, tz0, x1, y0 + 1.2, z1, { color: [0.07, 0.07, 0.07] });
  const nt = Math.max(1, Math.floor(Math.max(tw, td) / 16));
  for (let i = 0; i < nt; i++) {
    const rad = Math.min(tw, td) * r.range(0.3, 0.42), th = r.range(16, 34);
    const cx = tw > td ? tx0 + (tw * (i + 0.5)) / nt : tx0 + tw / 2, cz = tw > td ? tz0 + td / 2 : tz0 + (td * (i + 0.5)) / nt;
    const tc = r.pick([[0.16, 0.15, 0.14], [0.14, 0.09, 0.06], [0.08, 0.1, 0.11]]);
    g.prism(cx, cz, y0 + 1.2, y0 + th, rad, rad, 16, { color: tc, smooth: true });
    g.prism(cx, cz, y0 + th, y0 + th + rad * 0.35, rad, rad * 0.25, 16, { color: mul(tc, 0.8), smooth: true });
    for (let k = 1; k < 4; k++) g.prism(cx, cz, y0 + (th * k) / 4, y0 + (th * k) / 4 + 0.35, rad + 0.15, rad + 0.15, 16, { color: [0.05, 0.05, 0.05], smooth: true, bottom: true });
    g.prism(cx, cz, y0 + th - 0.3, y0 + th, rad + 0.5, rad + 0.5, 16, { color: NEON.orange, glow: 1.6, bottom: true });
    g.tube([cx + rad + 0.4, y0, cz], [cx + rad + 0.4, y0 + th + 2, cz], 0.3, 6, METAL);
    g.tube([cx + rad + 0.4, y0 + th + 2, cz], [cx, y0 + th + 2 + rad * 0.3, cz], 0.3, 6, METAL);
  }
  // chimneys with hazard bands, beacons and plumes
  const nc = r.int(2, 3);
  for (let i = 0; i < nc; i++) {
    const cx = x0 + (hx1 - x0) * r.range(0.2, 0.8), cz = z0 + (hz1 - z0) * r.range(0.2, 0.8), ch = r.range(70, 120), r0 = r.range(2.2, 3.2);
    const seg = 8;
    for (let k = 0; k < seg; k++) {
      const ya = hall + 4 + ((ch - hall - 4) * k) / seg, yb = hall + 4 + ((ch - hall - 4) * (k + 1)) / seg;
      const ra = r0 - (r0 * 0.4 * k) / seg, rb = r0 - (r0 * 0.4 * (k + 1)) / seg;
      g.prism(cx, cz, ya, yb, ra, rb, 12, { color: k >= seg - 3 && k % 2 === 1 ? [0.3, 0.05, 0.04] : [0.12, 0.115, 0.11], smooth: true, top: k === seg - 1 });
    }
    g.prism(cx, cz, ch - 0.6, ch, r0 * 0.6 + 0.3, r0 * 0.6 + 0.3, 12, { color: NEON.red, glow: 106, bottom: true });
    g.prism(cx, cz, ch * 0.6, ch * 0.6 + 0.5, r0 * 0.8 + 0.25, r0 * 0.8 + 0.25, 12, { color: NEON.red, glow: 104, bottom: true });
    C.steam.push({ x: cx, y: ch + 1, z: cz, size: 9, rise: 38, n: 14, tint: [0.5, 0.42, 0.5] });
  }
  // pipe racks along the street faces
  for (const s of 'nsew') {
    const f = frame(s, x0, z0, hx1, hz1);
    for (let k = 0; k < 3; k++) {
      const yy = y0 + 6 + k * 4.5 + r.range(0, 2), out = 0.6 + k * 0.25, rad = r.range(0.22, 0.5);
      const a = fpt(f, 1, out), b = fpt(f, f.L - 1, out);
      g.tube([a[0], yy, a[1]], [b[0], yy, b[1]], rad, 8, { color: r.pick([[0.14, 0.1, 0.07], [0.1, 0.11, 0.12], [0.2, 0.17, 0.08]]), glow: -1 });
      for (let u = 3; u < f.L - 2; u += 7) { const q0 = fpt(f, u, 0), q1 = fpt(f, u, out + rad); g.box(Math.min(q0[0], q1[0]) - 0.08, yy - rad - 0.15, Math.min(q0[1], q1[1]) - 0.08, Math.max(q0[0], q1[0]) + 0.08, yy - rad, Math.max(q0[1], q1[1]) + 0.08, { ...DARK, bottom: true }); }
    }
  }
  // roof extraction fans glowing from within
  for (let k = 0; k < 4; k++) {
    const cx = x0 + (hx1 - x0) * r.range(0.15, 0.85), cz = z0 + (hz1 - z0) * r.range(0.15, 0.85), rad = r.range(2, 3.6);
    g.prism(cx, cz, hall + 4, hall + 6.5, rad, rad, 14, { color: [0.09, 0.09, 0.095], smooth: true, top: false });
    g.prism(cx, cz, hall + 4.6, hall + 4.7, rad * 0.95, rad * 0.95, 14, { color: NEON.orange, glow: 1.4 });
    C.steam.push({ x: cx, y: hall + 6.5, z: cz, size: 4, rise: 14, n: 6, tint: [0.6, 0.45, 0.35] });
  }
  return null;
}

const SHAFTS = { stack: shaftStack, fin: shaftFin, round: shaftRound, twin: shaftTwin, taper: shaftTaper, cut: shaftCut, resi: shaftResi, indus: shaftIndus };
const STYLE_FOR = { stack: [1, 2, 8, 0], fin: [4, 1, 3], round: [1, 2, 4], twin: [1, 4, 2], taper: [4, 1, 3], cut: [1, 2, 4], resi: [0, 8], indus: [5] };

// ---- complete building ----------------------------------------------------------------------
// lot: {x0,z0,x1,z1}; o: {kind, h, streets, lod, ads (0..1), podH, inset:{n,s,e,w}, wall, acc, style, noRoof}
export function building(C, g, lot, o) {
  const r = C.rng; const { x0, z0, x1, z1 } = lot;
  const kind = o.kind, lod = !!o.lod, streets = o.streets ?? 'nsew';
  const wall = o.wall || r.pick(WALLS), accKey = o.acc || r.pick(NEON_KEYS), acc = NEON[accKey];
  const style = o.style ?? r.pick(STYLE_FOR[kind]);
  const fh = style === 0 || style === 8 ? r.range(3.0, 3.3) : r.range(3.6, 4.2);
  const cw = { 0: 3.2, 1: r.range(2.4, 3.4), 2: r.range(3.5, 5), 3: r.range(1.8, 2.4), 4: r.range(2.6, 3.6), 5: 4, 8: r.range(2.6, 3.4) }[style];
  const P = { style, cw, fh, seed: r.range(1, 90), color: style === 4 ? mul(wall, 0.45) : wall, noCrown: !!o.noRoof };
  const H = Math.round(o.h / fh) * fh;
  let R = [x0, z0, x1, z1], y0 = 0;
  const info = { lot, H, acc, accKey, P };

  if (!lod && kind !== 'indus') {
    const gf = 4.6;
    const podH = o.podH ?? gf + fh * r.int(1, 3);
    const alley = 'nsew'.split('').filter((s) => !streets.includes(s)).join('');
    const shopCw = r.range(4.5, 7);
    if (streets.length) g.box(x0, 0, z0, x1, gf, z1, { style: 6, seed: P.seed, cw: shopCw, fh: gf, color: [0.045, 0.045, 0.05], sides: streets, top: false });
    if (alley.length) g.box(x0, 0, z0, x1, gf, z1, { style: 5, seed: P.seed, cw: 3.5, fh: gf, color: mul(wall, 0.7), sides: alley, top: false });
    g.box(x0, gf, z0, x1, podH, z1, { ...P, style: style === 0 ? 0 : 2, cw: style === 0 ? 3.2 : 4, color: mul(wall, 0.85) });
    addCollider(C, x0, 0, z0, x1, podH, z1);
    // canopy with a neon edge above the shops
    for (const s of streets) {
      const f = frame(s, x0, z0, x1, z1);
      const a = fpt(f, 0, 0), b = fpt(f, f.L, 1.1);
      g.box(Math.min(a[0], b[0]), gf - 0.1, Math.min(a[1], b[1]), Math.max(a[0], b[0]), gf + 0.22, Math.max(a[1], b[1]), { ...DARK, bottom: true });
      const c = fpt(f, 0.3, 1.1), d = fpt(f, f.L - 0.3, 1.18);
      neonBox(g, Math.min(c[0], d[0]), gf - 0.04, Math.min(c[1], d[1]), Math.max(c[0], d[0]), gf + 0.14, Math.max(c[1], d[1]), acc, 52.6);
    }
    ledge(g, x0, z0, x1, z1, podH - 0.3, 0.35, 0.3);
    info.podH = podH; y0 = podH;
    const ins = o.inset || {};
    const di = () => (r.chance(0.5) ? r.range(1, 3.5) : 0);
    R = [x0 + (ins.w ?? di()), z0 + (ins.n ?? di()), x1 - (ins.e ?? di()), z1 - (ins.s ?? di())];
    // podium-level dressing
    for (const s of streets) {
      const f = frame(s, x0, z0, x1, z1);
      const dens = o.ads ?? 0.6;
      if (podH - gf > 3.4 && r.chance(dens)) {
        const w = Math.min(f.L - 2, r.range(6, 16)), u = r.range(1, f.L - w - 1), hh = Math.min(podH - gf - 0.9, w / r.range(1.6, 3));
        billboard(C, g, f, u, u + w, gf + 0.6, gf + 0.6 + hh, { out: 0.35, bright: 1.6, glowK: 0.6 });
      } else if (r.chance(dens)) {
        const w = Math.min(f.L - 2, r.range(8, 20)), u = r.range(1, Math.max(1.1, f.L - w - 1));
        const tk = r.pick(C.atlas.ticker);
        g.wall(f, u - 0.1, u + w + 0.1, gf + 0.5, gf + 1.7, 0.25, DARK);
        C.screens.wall(f, u, u + w, gf + 0.6, gf + 1.6, 0.3, tk.rect, null, [1, r.range(0, 100), r.range(0.6, 1.4) * (r.chance(0.5) ? 1 : -1), 1.8]);
      }
      const nb = Math.round(f.L / 11 * dens * r.range(0.6, 1.5));
      for (let i = 0; i < nb; i++) {
        const u = r.range(1.5, f.L - 1.5);
        if (r.chance(0.65)) bladeSign(C, g, f, u, r.range(5.2, 9), r.range(4, 9), { light: i === 0 });
        else wallSign(C, g, f, Math.min(u, f.L - 5), r.range(4.9, 5.4) + (podH > 9 ? r.range(0, 3) : 0), r.range(2.5, 4.5), { light: i === 0 });
      }
    }
  }

  let roof = SHAFTS[kind](C, g, R, y0, H, P, acc, lod, streets);
  if (roof && !o.noRoof) roofKit(C, g, roof[0], roof[1], roof[2], roof[3], roof[4], lod);
  info.roof = roof; info.R = R;

  // facade advertising
  const dens = o.ads ?? 0.5;
  if (kind !== 'indus') {
    for (const s of streets) {
      if (!r.chance(dens)) continue;
      const f = frame(s, R[0], R[1], R[2], R[3]);
      if (f.L < 12) continue;
      const big = o.big ?? 1;
      const w = Math.min(f.L - 2, f.L * r.range(0.5, 0.9) * (lod ? 1 : 1)), aspect = r.pick([0.4, 0.4, 0.7, 0.7, 1, 1.8]);
      let hh = Math.min(w / aspect, (H - y0) * 0.5, 90 * big);
      const ww = Math.min(w, hh * 2.2);
      const u = (f.L - ww) / 2 + r.range(-1, 1) * (f.L - ww) * 0.3;
      const yb = y0 + r.range(3, lod ? 60 : 18);
      if (yb + hh > H - 4) continue;
      billboard(C, g, f, u, u + ww, yb, yb + hh, { out: lod ? 1.2 : 0.8, bright: lod ? 2.0 : undefined, noGlow: lod && ww * hh < 600 });
    }
    // big vertical blade signs on taller corners
    if (!lod && r.chance(dens * 0.8) && streets.length) {
      const f = frame(r.pick(streets.split('')), R[0], R[1], R[2], R[3]);
      bladeSign(C, g, f, r.chance(0.5) ? 0.6 : f.L - 0.6, y0 + r.range(4, 20), r.range(12, 26), { light: false });
    }
  }
  return info;
}
