import * as THREE from 'three';
import { Geo, ScreenGeo, frame, fpt } from './geo.js';
import { RNG } from '../rng.js';
import { SEED, PITCH, NEON, NEON_KEYS, SIDEWALK_H, streetHalf, roadHalf } from '../config.js';
import { building, addCollider, addLight, billboard } from './buildings.js';
import { rectsMinus, dressAlley, dressSidewalk, shelter, trafficLight, cable, lanternString, vending, bench, vent, cone } from './street.js';
import { buildRail, buildHighway, buildSkywalk, buildSkyBridges, buildMetro, buildSkyDeck, METRO, DECK_Y } from './infra.js';
import { buildLandmarks } from './landmarks.js';
import { makeCityMaterial, makeGroundMaterial, makeScreenMaterial, makeGlowMaterial, makeSkyMaterial, U } from './materials.js';

// City layout. The walkable core is a 4x4 grid of hand-zoned blocks around the crossing of
// Halcyon Avenue (north-south) and Kaizen Street (east-west). Around it sits a ring of lower
// detail blocks with the four landmarks, and beyond that a far skyline that fades into the haze.

const S = SIDEWALK_H;
const MAP = [
  ['resi', 'comm', 'comm', 'market'],
  ['resi', 'down', 'down', 'shop'],
  ['corp', 'down', 'down', 'indus'],
  ['corp', 'comm', 'comm', 'indus'],
];
const DIST = {
  down: { kinds: ['fin', 'taper', 'cut', 'twin', 'stack', 'round'], h: [170, 330], ads: 0.9, lamp: [0.7, 0.88, 1] },
  comm: { kinds: ['stack', 'fin', 'round', 'cut', 'twin', 'taper'], h: [100, 230], ads: 0.7, lamp: [0.75, 0.9, 1] },
  shop: { kinds: ['stack', 'round', 'cut', 'fin'], h: [80, 180], ads: 1.0, lamp: [1, 0.6, 0.8] },
  corp: { kinds: ['fin', 'taper', 'cut', 'twin'], h: [150, 280], ads: 0.45, lamp: [0.6, 0.8, 1] },
  resi: { kinds: ['resi'], h: [70, 130], ads: 0.5, lamp: [1, 0.7, 0.4] },
  market: { kinds: ['stack', 'resi', 'round', 'stack'], h: [36, 110], ads: 1.0, lamp: [1, 0.5, 0.6] },
  indus: { kinds: ['indus'], h: [30, 50], ads: 0.2, lamp: [1, 0.55, 0.2] },
};

const blockRect = (i, j) => [i * PITCH + streetHalf(i * PITCH, 'x'), j * PITCH + streetHalf(j * PITCH, 'z'), (i + 1) * PITCH - streetHalf((i + 1) * PITCH, 'x'), (j + 1) * PITCH - streetHalf((j + 1) * PITCH, 'z')];
const slabRect = (i0, j0, i1 = i0, j1 = j0) => [i0 * PITCH + roadHalf(i0 * PITCH, 'x'), j0 * PITCH + roadHalf(j0 * PITCH, 'z'), (i1 + 1) * PITCH - roadHalf((i1 + 1) * PITCH, 'x'), (j1 + 1) * PITCH - roadHalf((j1 + 1) * PITCH, 'z')];

function subdivide(B, r, m = {}) {
  const [x0, z0, x1, z1] = B;
  const sx = (x0 + x1) / 2 + (m.fixed ? 0 : r.range(-8, 8)), sz = (z0 + z1) / 2 + (m.fixed ? 0 : r.range(-8, 8));
  const gx = m.gx ?? 4, gz = m.gz ?? (r.chance(0.55) ? 3.6 : 0);
  const cols = m.cols === 1 ? [[x0, x1]] : [[x0, sx - gx / 2], [sx + gx / 2, x1]];
  const rows = m.rows === 1 ? [[z0, z1]] : [[z0, sz - gz / 2], [sz + gz / 2, z1]];
  const lots = [];
  cols.forEach((c, ci) => rows.forEach((w, ri) => {
    let streets = '', alleys = '';
    if (c[0] === x0) streets += 'w'; else if (gx > 0) alleys += 'w';
    if (c[1] === x1) streets += 'e'; else if (gx > 0) alleys += 'e';
    if (w[0] === z0) streets += 'n'; else if (gz > 0) alleys += 'n';
    if (w[1] === z1) streets += 's'; else if (gz > 0) alleys += 's';
    lots.push({ x0: c[0], z0: w[0], x1: c[1], z1: w[1], streets, alleys, ci, ri });
  }));
  return { lots, sx, sz, gx, gz, cols: cols.length, rows: rows.length };
}

function stall(C, g, x, z, side, col) {
  // market stall: counter, back wall of lit shelves, sloped awning
  const r = C.rng, d = side;
  g.box(x - 1.5, S, z - 0.4 * 1, x + 1.5, S + 0.95, z + 0.4, { color: [0.09, 0.07, 0.06] });
  g.box(x - 1.5, S + 0.95, z - 0.45, x + 1.5, S + 1.0, z + 0.45, { color: [0.2, 0.2, 0.2], glow: -1 });
  for (const px of [x - 1.5, x + 1.5]) g.tube([px, S, z - 0.5], [px, S + 2.6, z - 0.5], 0.04, 4, { color: [0.1, 0.1, 0.1], glow: -1 });
  const a = [x - 1.8, S + 2.75, z - 0.7], b = [x + 1.8, S + 2.75, z - 0.7], c2 = [x + 1.8, S + 2.2, z + 1.0], d2 = [x - 1.8, S + 2.2, z + 1.0];
  g.quadN(d2, c2, b, a, 0, 0, 1, 1, { color: col }); g.quadN(a, b, c2, d2, 0, 0, 1, 1, { color: [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5] });
  g.box(x - 1.4, S + 2.0, z - 0.52, x + 1.4, S + 2.12, z - 0.44, { color: r.pick([NEON.amber, NEON.white, NEON.pink]), glow: 3.5, bottom: true });
  for (let k = 0; k < 6; k++) g.cbox(x - 1.2 + k * 0.48, S + 1.12, z + r.range(-0.2, 0.2), 0.3, 0.24, 0.3, { color: NEON[r.pick(NEON_KEYS)], glow: r.chance(0.4) ? 1.2 : 0 });
  addCollider(C, x - 1.6, 0, z - 0.5, x + 1.6, 1.1, z + 0.5);
  if (r.chance(0.5)) addLight(C, x, S + 1.9, z + 0.6, [1, 0.75, 0.5], 0.5, 12);
  void d;
}

function coreBlock(C, g, i, j, special) {
  const r = C.rng, B = blockRect(i, j), [x0, z0, x1, z1] = B;
  const d = MAP[j + 2][i + 2], D = DIST[d];
  const sp = special[`${i},${j}`];
  const mode = d === 'resi' ? { cols: 1, gz: 4.5 } : d === 'indus' ? { rows: 1, gx: 5 } : d === 'market' ? { gx: 7, gz: 4 } : {};
  if (sp) mode.fixed = true;
  if (sp && mode.gz === undefined) mode.gz = 4;
  const sub = subdivide(B, r, mode);
  for (const lot of sub.lots) {
    const o = { kind: r.pick(D.kinds), h: r.range(D.h[0], D.h[1]), streets: lot.streets, ads: D.ads };
    if (d === 'down') o.inset = { [i < 0 ? 'e' : 'w']: r.range(0, 2) };
    if (d === 'market' && o.kind === 'stack') o.style = r.pick([0, 8]);
    let hook = null;
    if (sp === 'hotel' && lot.ci === 1 && lot.ri === 0) { Object.assign(o, { kind: 'fin', h: 312, podH: DECK_Y, inset: { e: 6, w: 0, n: 0, s: 0 }, noRoof: true, acc: 'pink', style: 1 }); hook = 'hotel'; }
    if (sp === 'terrace' && lot.ci === 0 && lot.ri === 0) { Object.assign(o, { kind: 'cut', h: 262, podH: DECK_Y, inset: { w: 9, e: 0, n: 0, s: 0 }, acc: 'cyan' }); hook = 'terrace'; }
    if (sp === 'metro' && lot.ci === 1 && lot.ri === 1) { lot.x1 -= 15; hook = 'plaza'; o.kind = 'taper'; o.h = 300; }
    const info = building(C, g, lot, o);
    if (hook) C.hooks[hook] = { lot, info };
    for (const s of lot.alleys) dressAlley(C, g, frame(s, lot.x0, lot.z0, lot.x1, lot.z1), 30);
  }
  // things strung across the alleys
  const strung = (ax) => {
    const a0 = ax === 'x' ? sub.sx - sub.gx / 2 : sub.sz - sub.gz / 2, a1 = ax === 'x' ? sub.sx + sub.gx / 2 : sub.sz + sub.gz / 2;
    const l0 = ax === 'x' ? z0 : x0, l1 = ax === 'x' ? z1 : x1;
    for (let t = l0 + r.range(3, 8); t < l1 - 3; t += r.range(5, 11)) {
      const y = r.range(5.5, 20);
      const P = (v, yy) => (ax === 'x' ? [v, yy, t] : [t, yy, v]);
      if (d === 'market' && r.chance(0.7)) lanternString(C, g, P(a0, y * 0.4 + 3), P(a1, y * 0.4 + 3.3), r.pick([NEON.red, NEON.orange, NEON.pink]), 6);
      else if (r.chance(0.3)) g.tube(P(a0, y), P(a1, y), r.range(0.1, 0.3), 6, { color: [0.1, 0.09, 0.08], glow: -1 });
      else cable(C, P(a0, y), P(a1, y + r.range(-2, 2)), r.range(0.4, 1.2), 8);
    }
    // glowing gate signs at both alley mouths
    for (const e of [l0, l1]) {
      const col = NEON[r.pick(NEON_KEYS)], q = e === l0 ? 0.6 : -0.6;
      g.box(...(ax === 'x' ? [a0, 4.6, e + q - 0.12, a1, 5.0, e + q + 0.12] : [e + q - 0.12, 4.6, a0, e + q + 0.12, 5.0, a1]), { color: col, glow: 53, bottom: true });
    }
  };
  if (sub.cols > 1 && sub.gx > 0) strung('x');
  if (sub.rows > 1 && sub.gz > 0) strung('z');
  if (d === 'market' && sub.cols > 1) {
    for (let z = z0 + 6; z < z1 - 5; z += 6.5) {
      const left = Math.round(z) % 2 === 0;
      const x = left ? sub.sx - 1.3 : sub.sx + 1.3;
      g.place(x, 0, z, left ? Math.PI / 2 : -Math.PI / 2); stall(C, g, 0, 0, 1, r.pick([[0.25, 0.04, 0.05], [0.04, 0.1, 0.22], [0.22, 0.14, 0.03], [0.05, 0.17, 0.12]])); g.unplace();
      const cl = C.colliders[C.colliders.length - 1]; cl[0] = x - 0.6; cl[3] = x + 0.6; cl[2] = z - 1.6; cl[5] = z + 1.6;
      if (C.lights.length && C.lights[C.lights.length - 1].x === 0) { const L = C.lights[C.lights.length - 1]; L.x = x + (left ? 0.6 : -0.6); L.z = z; }
    }
  }
  // sidewalks
  for (const s of 'nsew') {
    const f = frame(s, x0, z0, x1, z1);
    const c = s === 'w' ? i * PITCH : s === 'e' ? (i + 1) * PITCH : s === 'n' ? j * PITCH : (j + 1) * PITCH, ax = s === 'w' || s === 'e' ? 'x' : 'z';
    const sw = streetHalf(c, ax) - roadHalf(c, ax);
    const o = {};
    if (sp === 'terrace' && s === 'w') o.skip = [[16, 37]];
    if (sp === 'hotel' && s === 'e') o.skip = [[36, 56], [63, 71]];
    if (sp === 'metro' && s === 'e') o.skip = [[0, 36]];
    if (sp === 'metro' && s === 's') o.skip = [[0, 16]];
    dressSidewalk(C, g, f, sw, D.lamp, o);
    if (sw > 4 && !sp && r.chance(0.8)) shelter(C, g, f, r.range(12, f.L - 18), sw);
  }
}

function midRing(C, g, gFar, slabs) {
  const r = C.rng;
  const reserved = (i, j) => (i >= -1 && i <= 0 && (j === -4 || j === -3 || j === 2 || j === 3)) || (j >= -1 && j <= 0 && (i === -4 || i === -3 || i === 2 || i === 3));
  const kinds = ['stack', 'taper', 'fin', 'round', 'cut', 'twin', 'stack', 'taper', 'resi'];
  for (let i = -6; i <= 5; i++) for (let j = -6; j <= 5; j++) {
    if (i >= -2 && i <= 1 && j >= -2 && j <= 1) continue;
    if (reserved(i, j)) continue;
    const B = blockRect(i, j);
    slabs.push(slabRect(i, j));
    const ring = Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5));
    const n = r.chance(0.45) ? 1 : 2;
    const horiz = r.chance(0.5), mid = 0.5 + r.range(-0.12, 0.12);
    for (let k = 0; k < n; k++) {
      let [x0, z0, x1, z1] = B;
      if (n === 2) { if (horiz) { const m = x0 + (x1 - x0) * mid; if (k) x0 = m + 2; else x1 = m - 2; } else { const m = z0 + (z1 - z0) * mid; if (k) z0 = m + 2; else z1 = m - 2; } }
      const pad = r.range(0, 6);
      const tall = r.chance(0.13);
      const h = tall ? r.range(380, 520) : r.range(90, 300) * (ring < 3.6 ? 1.15 : 0.9);
      building(C, ring < 3.6 ? g : gFar, { x0: x0 + pad, z0: z0 + pad, x1: x1 - pad, z1: z1 - pad }, { kind: r.pick(kinds), h, lod: true, ads: ring < 3.6 ? 0.42 : 0.2 });
    }
  }
}

function farRing(C, g) {
  const r = C.rng, kinds = ['stack', 'taper', 'stack', 'fin', 'cut', 'round'];
  for (let n = 0; n < 420; n++) {
    const a = r.range(0, Math.PI * 2), rad = 600 + Math.pow(r.next(), 1.4) * 2100;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) < 560 && Math.abs(z) < 560) continue;
    const w = r.range(40, 110), d = r.range(40, 110), h = r.range(80, 330) + (r.chance(0.1) ? r.range(150, 300) : 0);
    building(C, g, { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 }, { kind: r.pick(kinds), h, lod: true, ads: 0.05 });
  }
}

export function buildCity(atlas, renderer) {
  const C = {
    rng: new RNG(SEED), atlas, screens: new ScreenGeo(), holo: new ScreenGeo(), glow: new Geo(4096),
    lights: [], colliders: [], steam: [], cables: [], triggers: [], pits: [], search: [], hooks: {},
  };
  const group = new THREE.Group();
  const cityMat = makeCityMaterial(), groundMat = makeGroundMaterial();
  const addMesh = (geo, mat, shadow) => { const m = new THREE.Mesh(geo.build(), mat); m.castShadow = !!shadow; m.receiveShadow = !!shadow; group.add(m); return m; };

  // --- core blocks
  const special = { '-1,0': 'hotel', '0,0': 'terrace', '-1,-1': 'metro' };
  const slabs = [];
  for (let j = -2; j <= 1; j++) for (let i = -2; i <= 1; i++) {
    const g = new Geo(60000);
    coreBlock(C, g, i, j, special);
    addMesh(g, cityMat, true);
    slabs.push(slabRect(i, j));
  }
  const coreColliders = C.colliders.length;

  // --- infrastructure, set pieces
  const gi = new Geo(60000);
  buildRail(C, gi); buildHighway(C, gi); buildSkyBridges(C, gi); buildMetro(C, gi);
  const H = C.hooks;
  buildSkywalk(C, gi, { ...H.terrace.lot, terrace: 9 }, { ...H.hotel.lot, terrace: 6 });
  // hotel lift door on the avenue
  const door = { x: -12, z: 16 };
  const fE = frame('e', H.hotel.lot.x0, H.hotel.lot.z0, H.hotel.lot.x1, H.hotel.lot.z1), du = H.hotel.lot.z1 - door.z;
  gi.wall(fE, du - 1.1, du + 1.1, S, 2.9, 0.05, { color: [0.03, 0.03, 0.04] });
  gi.wall(fE, du - 0.9, du + 0.9, S, 2.6, 0.08, { color: [0.9, 0.45, 0.7], glow: 1.2 });
  C.screens.wall(fE, du - 1.6, du + 1.6, 3.0, 4.05, 0.3, atlas.lift.rect, null, [0, 3, 1, 2.2]);
  addLight(C, door.x + 2, 2.4, door.z, NEON.pink, 0.8, 16);
  buildSkyDeck(C, gi, H.hotel.info, door);
  // plaza in front of the metro
  const pl = H.plaza.lot, px0 = pl.x1, px1 = -12;
  C.holo.quad([px0 + 3, 5.5, pl.z0 + 8], [px0 + 3, 5.5, pl.z0 + 0.5], [px0 + 3, 13, pl.z0 + 0.5], [px0 + 3, 13, pl.z0 + 8], atlas.emblem.rect, null, [0, 4, 1, 1.1], 7.5, 7.5);
  gi.prism(px0 + 3, pl.z0 + 4.25, S, S + 0.5, 1.6, 1.3, 10, { color: [0.05, 0.05, 0.06], glow: -1, smooth: true });
  gi.prism(px0 + 3, pl.z0 + 4.25, S + 0.5, S + 0.56, 1.2, 1.2, 10, { color: NEON.cyan, glow: 3 });
  cone(C.glow, px0 + 3, 0.7, pl.z0 + 4.25, 1.0, 4.4, -12.4, [0.05, 0.3, 0.36], 12);
  addCollider(C, px0 + 1.4, 0, pl.z0 + 2.6, px0 + 4.6, 0.8, pl.z0 + 5.9);
  addLight(C, px0 + 5, 6, pl.z0 + 4.25, NEON.cyan, 0.9, 26);
  for (const z of [-14, -19, -34, -39]) bench(C, gi, px1 - 1.6, z, -Math.PI / 2);
  vending(C, gi, px0 + 0.7, -13, Math.PI / 2); vending(C, gi, px0 + 0.7, -14.4, Math.PI / 2);
  vent(C, gi, px0 + 6, S, -12.5, 1.6, 5);
  // holographic ads suspended over the avenue and cross street
  const hov = [[0, -128, 'x', 18, 15, 12], [0, 118, 'x', 20, 16, 22], [-128, 0, 'z', 16, 14, 30], [120, 0, 'z', 16, 14, 34]];
  for (const [x, z, ax, w, y, k] of hov) {
    const a = atlas.big[k], b = atlas.big[(k + 9) % 40], h = w / Math.max(a.a, 1.2);
    const p = ax === 'x' ? [[x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z], [x - w / 2, y + h, z]] : [[x, y, z + w / 2], [x, y, z - w / 2], [x, y + h, z - w / 2], [x, y + h, z + w / 2]];
    C.holo.quad(p[0], p[1], p[2], p[3], a.rect, b.rect, [2, k, 1, 0.85], w, h);
    for (const e of [-1, 1]) {
      const ex = ax === 'x' ? x + e * (w / 2 + 0.6) : x, ez = ax === 'x' ? z : z + e * (w / 2 + 0.6);
      gi.tube([ex, y - 0.4, ez], [ex, y + h + 0.4, ez], 0.12, 5, { color: NEON.cyan, glow: 2.5 });
      const wx = ax === 'x' ? e * 12 : x, wz = ax === 'x' ? z : e * 10;
      cable(C, [ex, y + h + 0.4, ez], [ax === 'x' ? wx : ex, y + h + 6, ax === 'x' ? ez : wz], 0.3, 4);
      cable(C, [ex, y - 0.4, ez], [ax === 'x' ? wx : ex, y - 3, ax === 'x' ? ez : wz], 0.2, 4);
    }
  }
  // traffic lights and street-crossing cables at the core intersections
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const cx = a * PITCH, cz = b * PITCH, hx = roadHalf(cx, 'x') + 0.5, hz = roadHalf(cz, 'z') + 0.5;
    trafficLight(C, gi, cx + hx, cz + hz, -1, 0); trafficLight(C, gi, cx - hx, cz - hz, 1, 0);
    if (C.rng.chance(0.7)) cable(C, [cx - streetHalf(cx, 'x'), 11 + C.rng.range(0, 6), cz + 20], [cx + streetHalf(cx, 'x'), 12 + C.rng.range(0, 6), cz + 24], 1.5, 10);
    if (C.rng.chance(0.7)) cable(C, [cx + 22, 10 + C.rng.range(0, 6), cz - streetHalf(cz, 'z')], [cx + 26, 12 + C.rng.range(0, 6), cz + streetHalf(cz, 'z')], 1.5, 10);
  }
  addMesh(gi, cityMat, true);

  const gl = new Geo(30000); buildLandmarks(C, gl); addMesh(gl, cityMat, false);
  for (const s of [slabRect(-1, -4, 0, -3), slabRect(-1, 2, 0, 3), slabRect(-4, -1, -3, 0), slabRect(2, -1, 3, 0)]) slabs.push(s);
  const gm = new Geo(60000), gf = new Geo(60000);
  midRing(C, gm, gf, slabs); farRing(C, gf);
  addMesh(gm, cityMat, false); addMesh(gf, cityMat, false);
  C.colliders.length = Math.max(coreColliders, C.colliders.length);

  // --- ground: street-level plane (with the metro stair opening) and raised paving slabs
  const gg = new Geo(4096);
  const road = { color: [0.25, 0.25, 0.25], glow: 0 }, pave = { color: [0.25, 0.25, 0.25], glow: 1 };
  for (const q of rectsMinus([-3600, -3600, 3600, 3600], METRO.hole)) gg.quad([q[0], 0, q[3]], [q[2], 0, q[3]], [q[2], 0, q[1]], [q[0], 0, q[1]], [0, 1, 0], 0, 0, 1, 1, road);
  slabs.forEach((sl, k) => {
    const core = k < 16;
    for (const q of rectsMinus(sl, k === 5 ? METRO.hole : null)) {
      gg.box(q[0], 0, q[1], q[2], S, q[3], pave);
      if (core) addCollider(C, q[0], 0, q[1], q[2], S, q[3]);
    }
  });
  const ground = new THREE.Mesh(gg.build(), groundMat); ground.receiveShadow = true; group.add(ground);

  // --- emissive layers
  U.uAtlas.value = atlas.texture;
  const screens = new THREE.Mesh(C.screens.build(), makeScreenMaterial(false)); group.add(screens);
  const holo = new THREE.Mesh(C.holo.build(), makeScreenMaterial(true)); holo.renderOrder = 5; group.add(holo);
  const glow = new THREE.Mesh(C.glow.build(), makeGlowMaterial()); glow.renderOrder = 4; group.add(glow);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(C.cables, 3));
  const cables = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x030304 })); group.add(cables);
  for (const m of [screens, holo, glow, cables]) m.frustumCulled = false;

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), makeSkyMaterial());
  sky.frustumCulled = false; sky.renderOrder = -1000; group.add(sky);

  void billboard; void fpt; void renderer;
  return { group, C, ground, glow, holo, sky, cityMat, groundMat };
}
