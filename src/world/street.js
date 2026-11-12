import { frame, fpt } from './geo.js';
import { NEON, NEON_KEYS, SIDEWALK_H } from '../config.js';
import { addCollider, addLight, bladeSign, wallSign, hexLin } from './buildings.js';

// Street-level furniture and dressing: lamps, vending machines, alley clutter, cables, vents.

const METAL = { color: [0.09, 0.095, 0.105], glow: -1 };
const DARK = { color: [0.035, 0.037, 0.042] };
const S = SIDEWALK_H;

// split rect [x0,z0,x1,z1] into up to four rects around a hole
export function rectsMinus(R, Hh) {
  if (!Hh) return [R];
  const [x0, z0, x1, z1] = R, [a0, b0, a1, b1] = Hh;
  return [[x0, z0, x1, b0], [x0, b1, x1, z1], [x0, b0, a0, b1], [a1, b0, x1, b1]].filter((q) => q[2] - q[0] > 0.01 && q[3] - q[1] > 0.01);
}

// volumetric light cone (additive), v runs 0 at the source to 1 at the far end
export function cone(G, x, yTop, z, rTop, rBot, h, color, sides = 14) {
  const o = { color, style: 1, seed: (x * 7.1 + z * 3.3) % 50 };
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b = G.vert(x + c1 * rTop, yTop, z + s1 * rTop, c1, 0, s1, (i + 1) / sides, 0, o);
    G.vert(x + c0 * rTop, yTop, z + s0 * rTop, c0, 0, s0, i / sides, 0, o);
    G.vert(x + c0 * rBot, yTop - h, z + s0 * rBot, c0, 0, s0, i / sides, 1, o);
    G.vert(x + c1 * rBot, yTop - h, z + s1 * rBot, c1, 0, s1, (i + 1) / sides, 1, o);
    const ix = G.idx; ix.need(6);
    ix.a[ix.n++] = b; ix.a[ix.n++] = b + 1; ix.a[ix.n++] = b + 2; ix.a[ix.n++] = b; ix.a[ix.n++] = b + 2; ix.a[ix.n++] = b + 3;
  }
}

// dir: unit vector pointing from the kerb towards the road
export function streetLamp(C, g, x, z, dx, dz, color, h = 7.2) {
  g.tube([x, S, z], [x, h, z], 0.11, 6, METAL);
  g.cbox(x, S + 0.5, z, 0.36, 1.0, 0.36, DARK);
  const ax = x + dx * 2.0, az = z + dz * 2.0;
  g.tube([x, h - 0.05, z], [ax, h + 0.25, az], 0.07, 5, METAL);
  g.cbox(ax, h + 0.2, az, 0.5 + Math.abs(dx) * 0.5, 0.14, 0.5 + Math.abs(dz) * 0.5, { ...DARK, bottom: true });
  g.cbox(ax, h + 0.1, az, 0.4 + Math.abs(dx) * 0.45, 0.06, 0.4 + Math.abs(dz) * 0.45, { color, glow: 7, bottom: true });
  cone(C.glow, ax, h + 0.05, az, 0.25, 3.6, h - 0.1, [color[0] * 0.42, color[1] * 0.42, color[2] * 0.42]);
  addLight(C, ax, h - 1.2, az, color, 0.75, 20);
  addCollider(C, x - 0.2, 0, z - 0.2, x + 0.2, 3, z + 0.2);
  // a small banner sign on some poles
  if (C.rng.chance(0.35)) g.cbox(x - dx * 0.5, 4.2, z - dz * 0.5, 0.08 + Math.abs(dx) * 0.7, 1.4, 0.08 + Math.abs(dz) * 0.7, { color: NEON[C.rng.pick(NEON_KEYS)], glow: 1.2, bottom: true });
}

export function vending(C, g, x, z, ry, y = S) {
  const r = C.rng, v = r.pick(C.atlas.vend);
  g.place(x, y, z, ry);
  g.box(-0.55, 0, -0.42, 0.55, 2.0, 0.42, { color: [0.05, 0.06, 0.08], glow: -1 });
  g.box(-0.6, 2.0, -0.45, 0.6, 2.12, 0.5, DARK);
  g.unplace();
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  C.screens.quad(P(-0.5, 0.08, 0.43), P(0.5, 0.08, 0.43), P(0.5, 1.95, 0.43), P(-0.5, 1.95, 0.43), v.rect, null, [0, r.range(0, 99), 1, 1.5], 1, 1.9);
  const lp = P(0, 1.2, 1.6);
  if (r.chance(0.6)) addLight(C, lp[0], lp[1], lp[2], r.chance(0.5) ? NEON.cyan : NEON.pink, 0.4, 14);
  addCollider(C, x - 0.6, y - S, z - 0.6, x + 0.6, y + 2.1, z + 0.6);
}

export function bench(C, g, x, z, ry, y = S) {
  g.place(x, y, z, ry);
  g.box(-1.0, 0.4, -0.25, 1.0, 0.48, 0.25, { color: [0.12, 0.1, 0.08] });
  g.box(-1.0, 0.48, -0.25, 1.0, 0.95, -0.18, { color: [0.12, 0.1, 0.08] });
  g.box(-0.9, 0, -0.2, -0.8, 0.4, 0.2, METAL); g.box(0.8, 0, -0.2, 0.9, 0.4, 0.2, METAL);
  g.unplace();
  addCollider(C, x - 0.9, y - S, z - 0.9, x + 0.9, y + 0.5, z + 0.9);
}

export function bin(C, g, x, z) {
  g.prism(x, z, S, S + 1.0, 0.32, 0.36, 8, { color: [0.07, 0.08, 0.08], glow: -1, smooth: true });
  addCollider(C, x - 0.3, 0, z - 0.3, x + 0.3, 1.1, z + 0.3);
}

export function dumpster(C, g, x, z, ry) {
  const col = C.rng.pick([[0.05, 0.12, 0.1], [0.12, 0.06, 0.05], [0.06, 0.07, 0.12]]);
  g.place(x, S, z, ry);
  g.box(-1.0, 0.15, -0.55, 1.0, 1.25, 0.55, { color: col });
  g.box(-1.05, 1.25, -0.6, 1.05, 1.33, 0.6, DARK);
  g.unplace();
  addCollider(C, x - 0.95, 0, z - 0.95, x + 0.95, 1.4, z + 0.95);
}

export function utilityBox(C, g, x, z, ry) {
  g.place(x, S, z, ry);
  g.box(-0.5, 0, -0.25, 0.5, 1.5, 0.25, { color: [0.1, 0.11, 0.1], glow: -1 });
  g.box(-0.3, 1.1, 0.25, -0.2, 1.2, 0.27, { color: NEON.green, glow: 5 });
  g.box(0.1, 1.1, 0.25, 0.2, 1.2, 0.27, { color: NEON.red, glow: 105 });
  g.unplace();
  addCollider(C, x - 0.5, 0, z - 0.5, x + 0.5, 1.6, z + 0.5);
}

export function trafficLight(C, g, x, z, dx, dz) {
  g.tube([x, S, z], [x, 5.6, z], 0.09, 6, METAL);
  g.tube([x, 5.5, z], [x + dx * 3.2, 5.5, z + dz * 3.2], 0.06, 5, METAL);
  for (const k of [1.6, 3.0]) {
    const cx = x + dx * k, cz = z + dz * k;
    g.cbox(cx, 5.0, cz, 0.34, 0.95, 0.34, { ...DARK, bottom: true });
    g.cbox(cx, 5.27, cz, 0.37, 0.2, 0.37, { color: NEON.red, glow: 104, bottom: true });
    g.cbox(cx, 4.73, cz, 0.37, 0.2, 0.37, { color: NEON.green, glow: 2.5, bottom: true });
  }
  addCollider(C, x - 0.15, 0, z - 0.15, x + 0.15, 3, z + 0.15);
}

// steam vent grate; registers a particle emitter
export function vent(C, g, x, y, z, size = 1.6, rise = 5) {
  g.cbox(x, y + 0.02, z, 1.0, 0.04, 1.0, { color: [0.02, 0.02, 0.02], glow: -1 });
  C.steam.push({ x, y: y + 0.1, z, size, rise, n: 7, tint: [0.55, 0.55, 0.62] });
}

// sagging cable between two points (rendered as dark lines)
export function cable(C, a, b, sag = 1.2, n = 10) {
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, s = Math.sin(t * Math.PI) * sag;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s, a[2] + (b[2] - a[2]) * t];
    C.cables.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
    prev = p;
  }
}

// string of small lanterns across a lane
export function lanternString(C, g, a, b, color, n = 7) {
  cable(C, a, b, 0.7, n + 1);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), s = Math.sin(t * Math.PI) * 0.7;
    g.cbox(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s - 0.22, a[2] + (b[2] - a[2]) * t, 0.26, 0.34, 0.26, { color, glow: 3.2, bottom: true });
  }
}

// Clutter on a wall facing a narrow alley: pipes, conduits, AC units, doors, lights, dumpsters, vents.
export function dressAlley(C, g, f, wallH) {
  const r = C.rng, L = f.L;
  const top = Math.min(wallH, 40);
  // vertical pipes and conduits
  for (let u = r.range(1, 4); u < L - 1; u += r.range(2.5, 7)) {
    const rad = r.range(0.06, 0.22), out = rad + 0.06, h = r.range(8, top);
    const a = fpt(f, u, out);
    g.tube([a[0], S, a[1]], [a[0], h, a[1]], rad, 6, { color: r.pick([[0.1, 0.1, 0.11], [0.13, 0.08, 0.06], [0.06, 0.09, 0.09]]), glow: -1 });
    for (let y = 2.5; y < h; y += 3.5) { const b0 = fpt(f, u - rad - 0.05, 0), b1 = fpt(f, u + rad + 0.05, out + rad); g.box(Math.min(b0[0], b1[0]), y, Math.min(b0[1], b1[1]), Math.max(b0[0], b1[0]), y + 0.1, Math.max(b0[1], b1[1]), { ...DARK, bottom: true }); }
  }
  // horizontal conduit bundles
  for (let k = 0; k < 3; k++) {
    const y = r.range(3.2, 9), out = 0.12 + k * 0.05;
    const a = fpt(f, 0.5, out), b = fpt(f, L - 0.5, out);
    g.tube([a[0], y, a[1]], [b[0], y, b[1]], 0.05 + k * 0.02, 5, { color: [0.07, 0.07, 0.075], glow: -1 });
  }
  // AC units with drip stains
  for (let u = r.range(2, 5); u < L - 2; u += r.range(3, 8)) {
    const y = r.range(2.8, 14);
    const a = fpt(f, u - 0.5, 0), b = fpt(f, u + 0.5, 0.55);
    g.box(Math.min(a[0], b[0]), y, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y + 0.7, Math.max(a[1], b[1]), { color: [0.15, 0.15, 0.15], bottom: true });
  }
  // service doors with a caged light above
  for (let u = r.range(3, 8); u < L - 3; u += r.range(9, 18)) {
    g.wall(f, u - 0.6, u + 0.6, S, 2.3, 0.04, { color: [0.07, 0.05, 0.04], glow: -1 });
    const col = r.pick([NEON.amber, NEON.red, NEON.cyan, NEON.green, NEON.white]);
    const a = fpt(f, u - 0.18, 0), b = fpt(f, u + 0.18, 0.2);
    g.box(Math.min(a[0], b[0]), 2.5, Math.min(a[1], b[1]), Math.max(a[0], b[0]), 2.68, Math.max(a[1], b[1]), { color: col, glow: 56, bottom: true });
    const l = fpt(f, u, 1.2);
    if (r.chance(0.55)) addLight(C, l[0], 2.4, l[1], col, 0.45, 13);
  }
  // ground clutter
  for (let u = r.range(2, 6); u < L - 3; u += r.range(6, 13)) {
    const k = r.int(0, 3), p = fpt(f, u, 0.75);
    const ry = Math.atan2(f.nx, f.nz);
    if (k === 0) dumpster(C, g, p[0], p[1], ry);
    else if (k === 1) vending(C, g, p[0] - f.nx * 0.25, p[1] - f.nz * 0.25, ry);
    else if (k === 2) { vent(C, g, p[0] + f.nx * 0.6, S, p[1] + f.nz * 0.6, 1.4, 5); }
    else utilityBox(C, g, p[0] - f.nx * 0.4, p[1] - f.nz * 0.4, ry);
  }
  if (r.chance(0.7)) bladeSign(C, g, f, r.range(2, L - 2), r.range(3.4, 6), r.range(2.2, 3.6), { light: true });
  if (r.chance(0.4)) wallSign(C, g, f, r.range(1, Math.max(1.5, L - 5)), r.range(2.8, 3.6), r.range(1.8, 3), { light: false });
}

// Furniture along one sidewalk edge of a block. f: frame of the block side; sw: sidewalk width
export function dressSidewalk(C, g, f, sw, lampColor, o = {}) {
  const r = C.rng, L = f.L;
  const ry = Math.atan2(f.nx, f.nz);
  for (let u = 9; u < L - 6; u += 21) {
    const p = fpt(f, u + r.range(-1.5, 1.5), sw - 0.55);
    streetLamp(C, g, p[0], p[1], f.nx, f.nz, lampColor);
  }
  for (let u = r.range(3, 9); u < L - 3; u += r.range(5, 12)) {
    const k = r.int(0, 7);
    if (o.skip && o.skip.some(([a, b]) => u > a && u < b)) continue;
    const wallP = fpt(f, u, 0.62), kerbP = fpt(f, u, sw - 0.6);
    if (k === 0 && !o.noWall) vending(C, g, wallP[0], wallP[1], ry);
    else if (k === 1 && sw > 4) bench(C, g, kerbP[0] - f.nx * 0.2, kerbP[1] - f.nz * 0.2, ry + Math.PI);
    else if (k === 2) bin(C, g, kerbP[0], kerbP[1]);
    else if (k === 3 && !o.noWall) utilityBox(C, g, wallP[0] - f.nx * 0.3, wallP[1] - f.nz * 0.3, ry);
    else if (k === 4) { // bollards
      for (let i = 0; i < 3; i++) { const b = fpt(f, u + i * 1.4, sw - 0.3); g.prism(b[0], b[1], S, S + 0.8, 0.09, 0.09, 6, { color: [0.1, 0.1, 0.1], glow: -1, smooth: true }); g.prism(b[0], b[1], S + 0.62, S + 0.7, 0.1, 0.1, 6, { color: NEON.amber, glow: 2, smooth: true, top: false }); }
    } else if (k === 5) { const v = fpt(f, u, sw + 1.6); vent(C, g, v[0], 0, v[1], 1.8, 6); }
  }
}

// Bus-stop style shelter with an illuminated ad panel
export function shelter(C, g, f, u, sw) {
  const r = C.rng;
  const a = fpt(f, u, sw - 1.7), b = fpt(f, u + 4.2, sw - 0.5);
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
  g.box(x0 - 0.1, 2.6, z0 - 0.1, x1 + 0.1, 2.72, z1 + 0.1, { ...DARK, bottom: true });
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) g.tube([x, S, z], [x, 2.6, z], 0.05, 5, METAL);
  const ff = { ...f }; const ad = C.atlas.pickBig(r, 0.7);
  const p0 = fpt(f, u - 0.02, sw - 1.6), p1 = fpt(f, u - 0.02, sw - 0.6);
  C.screens.quad([p1[0], S + 0.4, p1[1]], [p0[0], S + 0.4, p0[1]], [p0[0], 2.4, p0[1]], [p1[0], 2.4, p1[1]], ad.rect, null, [0, r.range(0, 99), 1, 1.5], 1, 2);
  C.screens.quad([p0[0] + f.rx * 0.04, S + 0.4, p0[1] + f.rz * 0.04], [p1[0] + f.rx * 0.04, S + 0.4, p1[1] + f.rz * 0.04], [p1[0] + f.rx * 0.04, 2.4, p1[1] + f.rz * 0.04], [p0[0] + f.rx * 0.04, 2.4, p0[1] + f.rz * 0.04], ad.rect, null, [0, r.range(0, 99), 1, 1.5], 1, 2);
  neonBox2(g, x0, 2.52, z0, x1, 2.6, z1);
  const c = fpt(f, u + 2, sw - 1.1);
  addLight(C, c[0], 2.2, c[1], hexLin(ad.color), 0.4, 14);
  void ff;
}
function neonBox2(g, x0, y0, z0, x1, y1, z1) { g.box(x0, y0, z0, x1, y1, z1, { color: NEON.white, glow: 2.2, bottom: true }); }
