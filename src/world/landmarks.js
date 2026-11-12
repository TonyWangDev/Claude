import { frame } from './geo.js';
import { NEON } from '../config.js';
import { addCollider, billboard, antenna } from './buildings.js';

// Hand-designed landmark megastructures. Each one closes the vista of one of the two main axes,
// so there is always a recognisable silhouette at the end of the street.

const DARK = { color: [0.035, 0.037, 0.042] };

// OMNI-HELIX Spire: a twisting, tapering glass needle north of the avenue.
function omniHelix(C, g) {
  const cx = 0, cz = -272, r = C.rng;
  // podium
  g.box(-70, 0, -335, 70, 26, -205, { style: 2, seed: 3, cw: 5, fh: 4.3, color: [0.05, 0.055, 0.07] });
  g.box(-58, 26, -325, 58, 38, -215, { style: 4, seed: 5, cw: 3, fh: 4, color: [0.03, 0.035, 0.045] });
  addCollider(C, -70, 0, -335, 70, 26, -205);
  const fS = frame('s', -70, -335, 70, -205);
  billboard(C, g, fS, 12, 128, 5, 23, { out: 0.8, bright: 2.2, mode: 2, ad: C.atlas.big[0] });
  for (const x of [-70, 70]) g.box(x - 0.4, 0, -205.6, x + 0.4, 38, -204.6, { color: NEON.cyan, glow: 3, bottom: true });
  // twisting shaft
  const segs = 30, segH = 19.5, base = 38;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, y0 = base + i * segH, y1 = y0 + segH;
    const r0 = 54 * (1 - t * 0.62), r1 = 54 * (1 - (t + 1 / segs) * 0.62);
    const rot = 0.785 + i * 0.062;
    g.prism(cx, cz, y0, y1, r0, r1 + 0.6, 4, { style: 4, seed: 11 + i * 0.3, cw: 3.2, fh: 3.9, color: [0.03, 0.04, 0.055], rot, top: false });
    g.prism(cx, cz, y1 - 0.9, y1, r1 + 1.4, r1 + 1.4, 4, { color: i % 5 === 4 ? NEON.magenta : NEON.cyan, glow: i % 5 === 4 ? 2.6 : 1.7, rot, bottom: true });
    // luminous spine on every corner
    for (let k = 0; k < 4; k++) {
      const a = rot + k * Math.PI / 2;
      g.tube([cx + Math.cos(a) * (r0 + 0.3), y0, cz + Math.sin(a) * (r0 + 0.3)], [cx + Math.cos(a + 0.062) * (r1 + 0.9), y1, cz + Math.sin(a + 0.062) * (r1 + 0.9)], 0.45, 4, { color: NEON.cyan, glow: 2.2 });
    }
  }
  const top = base + segs * segH;
  g.prism(cx, cz, top, top + 70, 9, 0.6, 6, { color: [0.07, 0.08, 0.09], glow: -1 });
  g.cbox(cx, top + 71, cz, 2, 2, 2, { color: NEON.red, glow: 112, bottom: true });
  // floating hologram on the plaza side
  const a = C.atlas.big[5], b = C.atlas.big[10];
  C.holo.quad([-34, 52, -196], [34, 52, -196], [34, 120, -196], [-34, 120, -196], C.atlas.emblem.rect, null, [0, 3, 1, 0.9], 68, 68);
  C.holo.quad([-78, 44, -200], [-44, 44, -200], [-44, 122, -200], [-78, 122, -200], a.rect, b.rect, [2, 8, 1, 0.75], 34, 78);
  C.holo.quad([44, 44, -200], [78, 44, -200], [78, 122, -200], [44, 122, -200], C.atlas.big[3].rect, C.atlas.big[8].rect, [2, 21, 1, 0.75], 34, 78);
  C.lights.push({ x: 0, y: 30, z: -196, r: 0.1, g: 0.8, b: 1, i: 1.5, range: 80 });
  C.search.push({ x: -62, y: 38, z: -212, c: [0.5, 0.8, 1] }, { x: 62, y: 38, z: -212, c: [1, 0.4, 0.8] });
  void r;
}

// Kuroshio Arcology: a stepped megastructure the size of a mountain, west of the cross street.
function arcology(C, g) {
  const cx = -272, cz = 0; let half = 84, y = 0;
  const tiers = 7, th = 29.4;
  for (let i = 0; i < tiers; i++) {
    const c = i % 2 ? [0.085, 0.07, 0.06] : [0.10, 0.085, 0.07];
    g.box(cx - half, y, cz - half, cx + half, y + th, cz + half, { style: i % 3 === 2 ? 8 : 0, seed: 40 + i, cw: 3.3, fh: 3.27, color: c });
    if (i === 0) addCollider(C, cx - half, 0, cz - half, cx + half, th, cz + half);
    // terrace edge lights
    for (const s of 'nsew') {
      const f = frame(s, cx - half, cz - half, cx + half, cz + half);
      g.wall(f, 0, f.L, y + th - 0.5, y + th - 0.1, 0.15, { color: NEON.amber, glow: 1.5 });
    }
    // the glowing canyon cut into the city-facing side
    g.box(cx + half - 0.5, y + 2, cz - 7, cx + half + 0.4, y + th - 1, cz + 7, { color: NEON.orange, glow: 1.5, bottom: true });
    g.box(cx + half - 0.2, y, cz - 9.5, cx + half + 1.6, y + th, cz - 7, DARK); g.box(cx + half - 0.2, y, cz + 7, cx + half + 1.6, y + th, cz + 9.5, DARK);
    y += th; half -= 10.5;
  }
  g.prism(cx, cz, y, y + 46, 24, 4, 4, { style: 4, seed: 77, cw: 3, fh: 4, color: [0.04, 0.04, 0.05], rot: 0.785 });
  g.prism(cx, cz, y + 8, y + 9, 30, 30, 4, { color: NEON.orange, glow: 2.4, rot: 0.785, bottom: true });
  antenna(g, cx, y + 46, cz, 50, C.rng);
  const fE = frame('e', cx - 84, cz - 84, cx + 84, cz + 84);
  billboard(C, g, fE, 16, 66, 4, 26, { out: 0.9, bright: 2.2, ad: C.atlas.big[3] });
  billboard(C, g, fE, 102, 152, 4, 26, { out: 0.9, bright: 2.2, ad: C.atlas.big[8] });
  C.holo.quad([-186, 60, 34], [-186, 60, -34], [-186, 128, -34], [-186, 128, 34], C.atlas.big[12].rect, C.atlas.big[17].rect, [2, 5, 1, 0.7], 68, 68);
  C.search.push({ x: cx + 60, y: 60, z: -60, c: [1, 0.7, 0.3] });
}

// Meridian Twins: paired round towers joined by sky bridges, south end of the avenue.
function twins(C, g) {
  const cz = 272;
  g.box(-76, 0, 200, 76, 22, 340, { style: 2, seed: 9, cw: 5, fh: 4.4, color: [0.06, 0.05, 0.08] });
  addCollider(C, -76, 0, 200, 76, 22, 340);
  const fN = frame('n', -76, 200, 76, 340);
  billboard(C, g, fN, 20, 132, 4, 20, { out: 0.8, bright: 2.2, mode: 2, ad: C.atlas.big[6] });
  [[-40, 452], [40, 410]].forEach(([x, h], i) => {
    const P = { style: i ? 1 : 4, seed: 60 + i * 7, cw: 3.2, fh: 4, color: [0.045, 0.04, 0.065], rot: Math.PI / 16 };
    g.prism(x, cz, 22, h, 27, 27, 16, P);
    for (let y = 60; y < h - 5; y += 44) {
      g.prism(x, cz, y, y + 0.8, 28.2, 28.2, 16, { color: NEON.violet, glow: 2.6, rot: Math.PI / 16, bottom: true });
    }
    g.prism(x, cz, h, h + 16, 27, 12, 16, { style: 7, seed: 2, cw: 3, fh: 4, color: [0.05, 0.05, 0.06], rot: Math.PI / 16 });
    g.prism(x, cz, h + 16, h + 17, 13, 13, 16, { color: NEON.magenta, glow: 3, rot: Math.PI / 16, bottom: true });
    antenna(g, x, h + 17, cz, 40, C.rng);
  });
  for (const y of [120, 232, 344]) {
    g.box(-16, y, cz - 5, 16, y + 9, cz + 5, { style: 2, seed: y, cw: 4, fh: 4.5, color: [0.05, 0.05, 0.07], bottom: true, sides: 'ns' });
    g.box(-16, y - 0.5, cz - 5.2, 16, y, cz + 5.2, { color: NEON.violet, glow: 2.5, bottom: true });
  }
  C.holo.quad([34, 160, 238], [-34, 160, 238], [-34, 228, 238], [34, 228, 238], C.atlas.emblem.rect, null, [0, 9, 1, 0.8], 68, 68);
  C.search.push({ x: -70, y: 22, z: 206, c: [0.7, 0.4, 1] }, { x: 70, y: 22, z: 206, c: [1, 0.3, 0.7] });
}

// Orbit//9: a cylindrical tower carrying a saucer deck and a ring of screens, east end of the cross street.
function orbit(C, g) {
  const cx = 272, cz = 0, R = 23, r = C.rng;
  g.prism(cx, cz, 0, 30, 46, 40, 16, { style: 2, seed: 4, cw: 5, fh: 4.3, color: [0.05, 0.065, 0.07] });
  addCollider(C, cx - 44, 0, cz - 44, cx + 44, 30, cz + 44);
  g.prism(cx, cz, 30, 372, R, R, 20, { style: 1, seed: 31, cw: 3, fh: 4, color: [0.045, 0.06, 0.065] });
  for (let y = 70; y < 360; y += 36) g.prism(cx, cz, y, y + 0.7, R + 1, R + 1, 20, { color: NEON.cyan, glow: 2.2, bottom: true });
  // saucer
  g.prism(cx, cz, 286, 300, R + 2, 58, 24, { color: [0.05, 0.055, 0.06], glow: -1, top: false, bottom: true });
  g.prism(cx, cz, 300, 310, 58, 58, 24, { style: 2, seed: 8, cw: 5, fh: 5, color: [0.05, 0.06, 0.065] });
  g.prism(cx, cz, 310, 324, 58, R + 4, 24, { color: [0.05, 0.055, 0.06], glow: -1, top: false });
  g.prism(cx, cz, 299, 300.2, 59, 59, 24, { color: NEON.orange, glow: 3, bottom: true });
  g.prism(cx, cz, 372, 400, R, 6, 20, { color: [0.06, 0.06, 0.07], glow: -1 });
  antenna(g, cx, 400, cz, 60, r);
  // ring of ticker screens
  const n = 10, rr = 34;
  g.prism(cx, cz, 92, 108, rr - 0.6, rr - 0.6, n, { ...DARK, bottom: true, rot: Math.PI / n });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.3; g.tube([cx + Math.cos(a) * R, 100, cz + Math.sin(a) * R], [cx + Math.cos(a) * rr, 100, cz + Math.sin(a) * rr], 0.6, 5, DARK); }
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI / n + (i / n) * Math.PI * 2, a1 = Math.PI / n + ((i + 1) / n) * Math.PI * 2;
    const p0 = [cx + Math.cos(a1) * rr, cz + Math.sin(a1) * rr], p1 = [cx + Math.cos(a0) * rr, cz + Math.sin(a0) * rr];
    const ad = i % 2 ? C.atlas.ticker[i % C.atlas.ticker.length] : C.atlas.big[4 + (i % 3) * 7];
    C.screens.quad([p0[0], 93, p0[1]], [p1[0], 93, p1[1]], [p1[0], 107, p1[1]], [p0[0], 107, p0[1]], ad.rect, null, [1, i * 0.1, 0.7, 2.0], 21, 14);
  }
  C.search.push({ x: cx - 30, y: 30, z: 30, c: [0.3, 0.9, 1] });
}

export function buildLandmarks(C, g) { omniHelix(C, g); arcology(C, g); twins(C, g); orbit(C, g); }
