import { frame, fpt } from './geo.js';
import { NEON, SIDEWALK_H } from '../config.js';
import { addCollider, addLight, billboard, bladeSign, wallSign, antenna } from './buildings.js';
import { cone, vending, bench, lanternString } from './street.js';

// Transport and pedestrian infrastructure: elevated railway, elevated expressway, the walkable
// skybridge with its stairs and terraces, enclosed high-level bridges, the metro entrance and
// concourse, and the hotel sky deck.

const METAL = { color: [0.09, 0.095, 0.105], glow: -1 };
const DARK = { color: [0.035, 0.037, 0.042] };
const CONC = { color: [0.085, 0.085, 0.09] };
const S = SIDEWALK_H;
export const DECK_Y = S + 39 * 0.18;   // height of the walkable terrace level (7.17 m)
export const RAIL_Y = 13.5, RAIL_Z = -90;
export const HWY_Y = 23, HWY_X = 180;

// glass balustrade with a collider. Axis-aligned between (xa,za) and (xb,zb)
export function rail(C, g, xa, za, xb, zb, y, glowCol) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
  const t = 0.05, alongX = x1 - x0 > z1 - z0;
  g.box(x0 - t, y, z0 - t, x1 + t, y + 0.12, z1 + t, DARK);
  g.box(x0 - t, y + 0.12, z0 - t, x1 + t, y + 1.0, z1 + t, { color: [0.02, 0.03, 0.04], glow: -1 });
  g.box(x0 - t * 1.6, y + 1.0, z0 - t * 1.6, x1 + t * 1.6, y + 1.08, z1 + t * 1.6, METAL);
  if (glowCol) g.box(x0 - t * 1.2, y + 0.02, z0 - t * 1.2, x1 + t * 1.2, y + 0.08, z1 + t * 1.2, { color: glowCol, glow: 2.4 });
  void alongX;
  addCollider(C, x0 - 0.12, y, z0 - 0.12, x1 + 0.12, y + 1.15, z1 + 0.12);
}

// straight flight of stairs rising along -z or +z; solid underneath; LED nosings
function stairs(C, g, x0, x1, zStart, dir, n, yBase, col) {
  for (let i = 0; i < n; i++) {
    const za = zStart + dir * 0.3 * i, zb = zStart + dir * 0.3 * (i + 1), top = yBase + 0.18 * (i + 1);
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    g.box(x0, Math.max(yBase - 0.2, top - 1.2), z0, x1, top, z1, { ...CONC, bottom: true });
    if (i % 2 === 0) g.box(x0 + 0.05, top - 0.03, dir < 0 ? z1 - 0.04 : z0, x1 - 0.05, top + 0.012, dir < 0 ? z1 : z0 + 0.04, { color: col, glow: 1.6 });
    addCollider(C, x0, yBase - 0.2, z0, x1, top, z1);
  }
}

export function buildRail(C, g) {
  const y = RAIL_Y, z = RAIL_Z;
  g.box(-640, y - 1.1, z - 3.4, 640, y, z + 3.4, { ...CONC, bottom: true });
  for (const s of [-1, 1]) {
    g.box(-640, y, z + s * 3.4 - 0.15, 640, y + 0.9, z + s * 3.4 + 0.15, DARK);
    g.box(-640, y + 0.35, z + s * 3.58 - 0.03, 640, y + 0.5, z + s * 3.58 + 0.03, { color: NEON.cyan, glow: 1.3, bottom: true });
    for (const k of [-0.72, 0.72]) g.box(-640, y, z + s * 1.7 + k - 0.06, 640, y + 0.16, z + s * 1.7 + k + 0.06, METAL);
  }
  for (let x = -615; x <= 615; x += 30) {
    if (Math.abs(((x + 45) % 90 + 90) % 90 - 45) < 9) continue;   // keep intersections clear
    g.box(x - 0.9, 0, z - 0.9, x + 0.9, y - 2.2, z + 0.9, CONC);
    g.box(x - 1.3, y - 2.2, z - 3.2, x + 1.3, y - 1.1, z + 3.2, { ...CONC, bottom: true });
    g.box(x - 0.92, 1.2, z - 0.92, x + 0.92, 1.6, z + 0.92, { color: NEON.amber, glow: 1.2 });
    if (Math.abs(x) < 200) addCollider(C, x - 0.9, 0, z - 0.9, x + 0.9, y, z + 0.9);
    // catenary masts
    g.tube([x, y, z - 3.3], [x, y + 5.2, z - 3.3], 0.09, 5, METAL); g.tube([x, y, z + 3.3], [x, y + 5.2, z + 3.3], 0.09, 5, METAL);
    g.tube([x, y + 5.2, z - 3.3], [x, y + 5.2, z + 3.3], 0.06, 4, METAL);
  }
  for (const k of [-1.7, 1.7]) C.cables.push(-640, y + 4.9, z + k, 640, y + 4.9, z + k);
  // station straddling the block east of the avenue
  const sx0 = 18, sx1 = 78;
  for (const s of [-1, 1]) {
    const zo = z + s * 5.3;
    g.box(sx0, y - 0.5, zo - 1.9, sx1, y + 0.9, zo + 1.9, { ...CONC, bottom: true });
    g.box(sx0, y + 4.3, zo - 2.3, sx1, y + 4.55, zo + 2.3, { ...DARK, bottom: true });
    g.box(sx0 + 1, y + 4.2, zo - 0.25, sx1 - 1, y + 4.3, zo + 0.25, { color: NEON.white, glow: 3.2, bottom: true });
    for (let x = sx0 + 2; x < sx1; x += 8) g.tube([x, y + 0.9, zo + s * 1.6], [x, y + 4.3, zo + s * 1.6], 0.1, 5, METAL);
    g.box(sx0, y + 0.9, zo + s * 1.85 - 0.05, sx1, y + 2.2, zo + s * 1.85 + 0.05, { color: [0.02, 0.03, 0.04], glow: -1 });
    for (const x of [sx0 + 3, sx1 - 3]) g.box(x - 0.6, 0, zo + s * 0.9 - 0.6, x + 0.6, y - 0.5, zo + s * 0.9 + 0.6, CONC);
    const f = s > 0 ? frame('s', sx0, 0, sx1, zo + 1.9) : frame('n', sx0, zo - 1.9, sx1, 0);
    C.screens.wall(f, 14, 46, y + 2.5, y + 4.1, 0.1, C.atlas.ticker[s > 0 ? 0 : 1].rect, null, [1, 5 + s, 1, 1.9]);
    addLight(C, (sx0 + sx1) / 2, y + 3.5, zo, NEON.white, 0.9, 30);
  }
}

export function buildHighway(C, g) {
  const y = HWY_Y, x = HWY_X;
  g.box(x - 7.6, y - 1.7, -700, x + 7.6, y, 700, { ...CONC, bottom: true });
  for (const s of [-1, 1]) {
    g.box(x + s * 7.6 - 0.2, y, -700, x + s * 7.6 + 0.2, y + 1.1, 700, DARK);
    g.box(x + s * 7.85 - 0.04, y + 0.3, -700, x + s * 7.85 + 0.04, y + 0.5, 700, { color: NEON.orange, glow: 1.5, bottom: true });
  }
  g.box(x - 0.25, y, -700, x + 0.25, y + 0.8, 700, DARK);
  for (let z = -684; z <= 684; z += 36) {
    if (Math.abs(((z + 45) % 90 + 90) % 90 - 45) < 9) continue;
    g.box(x - 1.3, 0, z - 1.1, x + 1.3, y - 3.2, z + 1.1, CONC);
    g.box(x - 6.5, y - 3.2, z - 1.4, x + 6.5, y - 1.7, z + 1.4, { ...CONC, bottom: true });
    g.box(x - 1.32, 1.2, z - 1.12, x + 1.32, 1.6, z + 1.12, { color: NEON.orange, glow: 1.2 });
    if (Math.abs(z) < 200) addCollider(C, x - 1.3, 0, z - 1.1, x + 1.3, y, z + 1.1);
  }
  // lighting masts on the deck and overhead gantries with signs
  for (let z = -640; z <= 640; z += 64) {
    for (const s of [-1, 1]) {
      g.tube([x + s * 7.4, y, z], [x + s * 7.4, y + 8, z], 0.12, 5, METAL);
      g.tube([x + s * 7.4, y + 8, z], [x + s * 5, y + 8.3, z], 0.08, 5, METAL);
      g.cbox(x + s * 5, y + 8.2, z, 1.0, 0.1, 0.5, { color: [1, 0.72, 0.4], glow: 6, bottom: true });
      if (Math.abs(z) < 330) cone(C.glow, x + s * 5, y + 8.1, z, 0.3, 4.5, 8, [0.34, 0.23, 0.11], 10);
    }
  }
  for (const z of [-150, 60, 250]) {
    g.tube([x - 7.6, y, z], [x - 7.6, y + 7.5, z], 0.2, 6, METAL); g.tube([x + 7.6, y, z], [x + 7.6, y + 7.5, z], 0.2, 6, METAL);
    g.box(x - 7.8, y + 5.6, z - 0.2, x + 7.8, y + 7.6, z + 0.2, { ...DARK, bottom: true });
    const tk = C.atlas.ticker[z > 0 ? 0 : 1];
    C.screens.quad([x - 7.4, y + 5.8, z + 0.22], [x + 7.4, y + 5.8, z + 0.22], [x + 7.4, y + 7.4, z + 0.22], [x - 7.4, y + 7.4, z + 0.22], tk.rect, null, [1, z, 1, 2], 14.8, 1.6);
    C.screens.quad([x + 7.4, y + 5.8, z - 0.22], [x - 7.4, y + 5.8, z - 0.22], [x - 7.4, y + 7.4, z - 0.22], [x + 7.4, y + 7.4, z - 0.22], tk.rect, null, [1, z + 3, 1, 2], 14.8, 1.6);
  }
}

// The walkable skybridge over the avenue with stairs on both sides, plus terrace dressing.
export function buildSkywalk(C, g, east, west) {
  const Y = DECK_Y, r = C.rng;
  const zA = 24, zB = 28;
  // bridge deck
  g.box(-12, Y - 0.6, zA, 12, Y, zB, { ...CONC, bottom: true });
  addCollider(C, -12, Y - 0.6, zA, 12, Y, zB);
  for (const z of [zA, zB]) {
    rail(C, g, -12, z, 12, z, Y, NEON.cyan);
    g.box(-12, Y - 0.75, z - 0.12, 12, Y - 0.6, z + 0.12, { color: NEON.cyan, glow: 2.2, bottom: true });
  }
  // portal frames + roof light
  for (const x of [-11.5, -4, 4, 11.5]) {
    for (const z of [zA, zB]) g.tube([x, Y, z], [x, Y + 3.4, z], 0.08, 5, METAL);
    g.box(x - 0.1, Y + 3.4, zA - 0.1, x + 0.1, Y + 3.55, zB + 0.1, { ...DARK, bottom: true });
  }
  g.box(-11.5, Y + 3.42, (zA + zB) / 2 - 0.12, 11.5, Y + 3.5, (zA + zB) / 2 + 0.12, { color: NEON.pink, glow: 2.6, bottom: true });
  addLight(C, 0, Y + 2.6, (zA + zB) / 2, NEON.pink, 0.7, 18);
  // tickers on both faces, readable from the street
  const tk = C.atlas.ticker;
  g.box(-10, Y - 2.1, zB + 0.12, 10, Y - 0.75, zB + 0.2, { ...DARK, bottom: true }); g.box(-10, Y - 2.1, zA - 0.2, 10, Y - 0.75, zA - 0.12, { ...DARK, bottom: true });
  C.screens.quad([-9.8, Y - 2.0, zB + 0.22], [9.8, Y - 2.0, zB + 0.22], [9.8, Y - 0.85, zB + 0.22], [-9.8, Y - 0.85, zB + 0.22], tk[0].rect, null, [1, 1, 1, 2], 19.6, 1.15);
  C.screens.quad([9.8, Y - 2.0, zA - 0.22], [-9.8, Y - 2.0, zA - 0.22], [-9.8, Y - 0.85, zA - 0.22], [9.8, Y - 0.85, zA - 0.22], tk[1].rect, null, [1, 2, 1, 2], 19.6, 1.15);

  for (const side of [1, -1]) {
    const lot = side > 0 ? east : west;
    const xi = side * 12, xo = side * 10.3;            // inner (building) and outer (kerb) edge of the stair
    const sx0 = Math.min(xi, xo), sx1 = Math.max(xi, xo);
    const zTop = 44.2 - 39 * 0.3;
    stairs(C, g, sx0, sx1, 44.2, -1, 39, S, side > 0 ? NEON.cyan : NEON.pink);
    // landing
    g.box(sx0, Y - 1.0, zTop - 2.4, sx1, Y, zTop, { ...CONC, bottom: true });
    g.box(sx0 + 0.2, 0, zTop - 1.6, sx1 - 0.2, Y - 1.0, zTop - 0.6, CONC);
    addCollider(C, sx0, Y - 1.0, zTop - 2.4, sx1, Y, zTop);
    addCollider(C, sx0 + 0.2, 0, zTop - 1.6, sx1 - 0.2, Y, zTop - 0.6);
    // invisible guard along the outer edge of the flight, visible handrail
    addCollider(C, xo - side * 0.02 - 0.06, 0, zTop - 2.4, xo - side * 0.02 + 0.06, Y + 1.1, 44.2);
    g.tube([xo, S + 1.05, 44.2], [xo, Y + 1.05, zTop], 0.04, 5, METAL);
    g.tube([xo, Y + 1.05, zTop], [xo, Y + 1.05, zTop - 2.4], 0.04, 5, METAL);
    for (let i = 0; i <= 39; i += 6) { const z = 44.2 - i * 0.3, yy = S + i * 0.18; g.tube([xo, yy, z], [xo, yy + 1.05, z], 0.03, 4, METAL); }
    rail(C, g, sx0, zTop - 2.4, sx1, zTop - 2.4, Y, null);
    // terrace balustrade with gaps for the landing and the bridge
    const tx = xi, z0 = lot.z0, z1 = lot.z1;
    rail(C, g, tx, z0, tx, zA, Y, NEON.cyan);
    rail(C, g, tx, zB, tx, zTop - 2.4, Y, NEON.cyan);
    rail(C, g, tx, zTop, tx, z1, Y, NEON.cyan);
    const deep = side > 0 ? lot.x0 + lot.terrace : lot.x1 - lot.terrace;  // face of the tower
    rail(C, g, tx, z0, deep, z0, Y, null); rail(C, g, tx, z1, deep, z1, Y, null);
    // terrace furniture
    const midx = (tx + deep) / 2, ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    vending(C, g, deep - side * 0.6, z0 + 3, ry, Y); vending(C, g, deep - side * 0.6, z0 + 4.4, ry, Y);
    bench(C, g, tx + side * 0.9, 16, ry + Math.PI, Y); bench(C, g, tx + side * 0.9, 38, ry + Math.PI, Y);
    for (const z of [14, 20, 36, 41]) { // planters with glowing rims
      g.box(midx - 0.7, Y, z - 0.7, midx + 0.7, Y + 0.6, z + 0.7, CONC);
      g.box(midx - 0.74, Y + 0.5, z - 0.74, midx + 0.74, Y + 0.56, z + 0.74, { color: side > 0 ? NEON.green : NEON.violet, glow: 2.2 });
      for (let k = 0; k < 5; k++) g.tube([midx + r.range(-0.4, 0.4), Y + 0.6, z + r.range(-0.4, 0.4)], [midx + r.range(-0.8, 0.8), Y + r.range(1.4, 2.4), z + r.range(-0.8, 0.8)], 0.03, 3, { color: [0.03, 0.1, 0.05] });
      addCollider(C, midx - 0.7, Y, z - 0.7, midx + 0.7, Y + 0.7, z + 0.7);
    }
    const f = side > 0 ? frame('w', deep, z0, 0, z1) : frame('e', 0, z0, deep, z1);
    wallSign(C, g, f, 6, Y + 2.8, 4.5, { light: true }); wallSign(C, g, f, 22, Y + 2.6, 4, { light: true });
    bladeSign(C, g, f, 15, Y + 3, 6, { light: false });
    lanternString(C, g, [tx, Y + 3.6, 12], [deep, Y + 4.2, 12], side > 0 ? NEON.orange : NEON.pink, 5);
    lanternString(C, g, [tx, Y + 3.6, 42], [deep, Y + 4.2, 42], side > 0 ? NEON.orange : NEON.pink, 5);
    addLight(C, midx, Y + 2.5, 18, side > 0 ? NEON.orange : NEON.pink, 0.6, 18);
  }
}
// Enclosed high-level bridges between towers (not walkable, purely skyline layering)
export function buildSkyBridges(C, g) {
  const list = [[-17, 17, -34, 52, 'x'], [-17, 17, -64, 96, 'x'], [-17, 17, 64, 70, 'x'], [-17, 17, 140, 44, 'x'], [-60, -26, -8, 58, 'z', 12], [40, 70, -8, 82, 'z', 12], [-150, -120, -94, 40, 'z', 8]];
  for (const [a, b, c, y, ax, len] of list) {
    const col = C.rng.pick([NEON.cyan, NEON.magenta, NEON.violet, NEON.amber]);
    if (ax === 'x') {
      g.box(a, y, c - 2.2, b, y + 4.2, c + 2.2, { style: 2, seed: y, cw: 3, fh: 4.2, color: [0.06, 0.065, 0.075], bottom: true, sides: 'ns' });
      g.box(a, y - 0.3, c - 2.3, b, y, c + 2.3, { color: col, glow: 0.9, bottom: true });
      g.box(a, y + 4.2, c - 2.4, b, y + 4.5, c + 2.4, DARK);
    } else {
      const z0 = c - len, z1 = c + len, x = (a + b) / 2;
      g.box(x - 2.2, y, z0, x + 2.2, y + 4.2, z1, { style: 2, seed: y, cw: 3, fh: 4.2, color: [0.06, 0.065, 0.075], bottom: true, sides: 'ew' });
      g.box(x - 2.3, y - 0.3, z0, x + 2.3, y, z1, { color: col, glow: 0.9, bottom: true });
      g.box(x - 2.4, y + 4.2, z0, x + 2.4, y + 4.5, z1, DARK);
    }
  }
}

// Metro entrance in the corner plaza: stairs down to a small concourse.
export const METRO = { hole: [-21.5, -30, -18.5, -23.1], hall: [-26, -45, -14, -30], floor: S - 23 * 0.18 };
export function buildMetro(C, g) {
  const [hx0, hz0, hx1, hz1] = METRO.hole, [cx0, cz0, cx1, cz1] = METRO.hall, fl = METRO.floor, ceil = -0.75;
  const tile = { color: [0.16, 0.17, 0.18] }, wallc = { style: 5, seed: 2, cw: 1.2, fh: 1.1, color: [0.2, 0.21, 0.22] };
  C.pits.push({ x0: hx0, z0: hz0, x1: hx1, z1: hz1, y: fl }, { x0: cx0, z0: cz0, x1: cx1, z1: cz1, y: fl });
  // steps
  for (let i = 0; i < 23; i++) {
    const z1 = hz1 - 0.3 * i, z0 = z1 - 0.3, top = S - 0.18 * (i + 1);
    g.box(hx0, fl - 0.1, z0, hx1, top, z1, { ...tile, sides: 's' });
    if (i % 2 === 0) g.box(hx0 + 0.05, top - 0.02, z1 - 0.04, hx1 - 0.05, top + 0.012, z1, { color: NEON.cyan, glow: 1.8 });
    if (i < 22) addCollider(C, hx0, fl - 0.3, z0, hx1, top, z1);
  }
  // stair well walls (inward facing)
  g.wall(frame('e', 0, hz0, hx0, hz1), 0, hz1 - hz0, fl, S, 0, wallc); g.wall(frame('w', hx1, hz0, 0, hz1), 0, hz1 - hz0, fl, S, 0, wallc);
  g.wall(frame('s', hx0, 0, hx1, hz0), 0, hx1 - hx0, ceil, S, 0, wallc);
  for (const [x, c] of [[hx0, 0.06], [hx1, -0.06]]) g.box(Math.min(x, x + c) , fl + 1.0, hz0, Math.max(x, x + c), fl + 1.06, hz1, { color: NEON.cyan, glow: 2 });
  addCollider(C, hx0 - 0.3, fl - 0.3, hz0, hx0, S, hz1); addCollider(C, hx1, fl - 0.3, hz0, hx1 + 0.3, S, hz1);
  // surface: balustrades on three sides and a canopy
  rail(C, g, hx0, hz0, hx0, hz1, S, NEON.cyan); rail(C, g, hx1, hz0, hx1, hz1, S, NEON.cyan); rail(C, g, hx0, hz0, hx1, hz0, S, NEON.cyan);
  for (const [x, z] of [[hx0, hz0], [hx1, hz0], [hx0, hz1 + 1], [hx1, hz1 + 1]]) g.tube([x, S, z], [x, 3.6, z], 0.08, 5, METAL);
  g.box(hx0 - 0.5, 3.6, hz0 - 0.5, hx1 + 0.5, 3.75, hz1 + 1.5, { color: [0.02, 0.03, 0.04], glow: -1, bottom: true });
  g.box(hx0 - 0.5, 3.52, hz0 - 0.5, hx1 + 0.5, 3.6, hz1 + 1.5, { color: NEON.cyan, glow: 1.2, sides: 'nsew', top: false });
  const m = C.atlas.metro;
  C.screens.quad([hx0 - 0.4, 2.75, hz1 + 1.52], [hx1 + 0.4, 2.75, hz1 + 1.52], [hx1 + 0.4, 3.5, hz1 + 1.52], [hx0 - 0.4, 3.5, hz1 + 1.52], m.rect, null, [0, 1, 1, 2.2], 3.8, 0.75);
  addLight(C, (hx0 + hx1) / 2, 2.6, hz1 + 2.5, NEON.cyan, 0.7, 16);
  // totem
  g.box(-17.2, S, -22.2, -16.6, 5.2, -21.8, DARK);
  C.screens.quad([-17.25, 3.6, -21.78], [-16.55, 3.6, -21.78], [-16.55, 5.1, -21.78], [-17.25, 5.1, -21.78], C.atlas.emblem.rect, null, [0, 2, 1, 2], 0.7, 1.5);
  addCollider(C, -17.3, 0, -22.3, -16.5, 5, -21.7);

  // concourse
  g.quad([cx0, fl, cz1], [cx1, fl, cz1], [cx1, fl, cz0], [cx0, fl, cz0], [0, 1, 0], cx0, cz0, cx1, cz1, { color: [0.12, 0.125, 0.13], glow: -1 });
  g.quad([hx0, fl, hz1 - 6.9], [hx1, fl, hz1 - 6.9], [hx1, fl, hz0], [hx0, fl, hz0], [0, 1, 0], 0, 0, 1, 1, { color: [0.12, 0.125, 0.13], glow: -1 });
  g.quad([cx0, ceil, cz0], [cx1, ceil, cz0], [cx1, ceil, cz1], [cx0, ceil, cz1], [0, -1, 0], cx0, cz0, cx1, cz1, { color: [0.05, 0.05, 0.055] });
  g.wall(frame('s', cx0, 0, cx1, cz0), 0, cx1 - cx0, fl, ceil, 0, wallc);
  g.wall(frame('e', 0, cz0, cx0, cz1), 0, cz1 - cz0, fl, ceil, 0, wallc);
  g.wall(frame('w', cx1, cz0, 0, cz1), 0, cz1 - cz0, fl, ceil, 0, wallc);
  const fS = frame('n', cx0, cz1, cx1, 0);   // south wall, faces north, with the stair opening
  g.wall(fS, 0, cx1 - hx1, fl, ceil, 0, wallc); g.wall(fS, cx1 - hx0, cx1 - cx0, fl, ceil, 0, wallc);
  addCollider(C, cx0 - 0.4, fl - 0.3, cz0 - 0.4, cx1 + 0.4, ceil, cz0); addCollider(C, cx0 - 0.4, fl - 0.3, cz0, cx0, ceil, cz1); addCollider(C, cx1, fl - 0.3, cz0, cx1 + 0.4, ceil, cz1);
  addCollider(C, cx0, fl - 0.3, cz1, hx0, ceil, cz1 + 0.4); addCollider(C, hx1, fl - 0.3, cz1, cx1, ceil, cz1 + 0.4);
  // ceiling light troughs
  for (const x of [cx0 + 2.5, (cx0 + cx1) / 2, cx1 - 2.5]) g.box(x - 0.15, ceil - 0.06, cz0 + 1, x + 0.15, ceil, cz1 - 1, { color: [0.8, 0.95, 1], glow: 1.5, bottom: true });
  addLight(C, (cx0 + cx1) / 2, fl + 2.4, cz0 + 4.5, [0.7, 0.9, 1], 0.45, 16); addLight(C, (cx0 + cx1) / 2, fl + 2.4, cz1 - 4, [0.7, 0.9, 1], 0.45, 16);
  // ticket gates
  const gz = cz0 + 5;
  for (let x = cx0 + 0.6; x < cx1 - 0.5; x += 1.25) {
    g.box(x, fl, gz - 0.9, x + 0.35, fl + 1.05, gz + 0.9, { color: [0.14, 0.15, 0.16], glow: -1 });
    g.box(x + 0.05, fl + 1.05, gz + 0.5, x + 0.3, fl + 1.08, gz + 0.8, { color: (Math.round(x) % 3) ? NEON.green : NEON.red, glow: 4 });
    g.box(x + 0.35, fl + 0.35, gz - 0.04, x + 1.25, fl + 0.95, gz + 0.04, { color: [0.3, 0.05, 0.08], glow: 0.6 });
  }
  addCollider(C, cx0, fl, gz - 0.9, cx1, fl + 1.2, gz + 0.9);
  // platform screen doors glowing behind the gates, signage and adverts
  const fN = frame('s', cx0, 0, cx1, cz0);
  for (let u = 0.8; u < 11; u += 2.6) g.wall(fN, u, u + 2.0, fl + 0.1, fl + 2.4, 0.05, { color: [0.45, 0.75, 1.0], glow: 0.45 });
  C.screens.wall(fN, 2.5, 9.5, fl + 2.55, fl + 3.15, 0.06, C.atlas.dir.rect, null, [0, 4, 1, 2]);
  const fW = frame('e', 0, cz0, cx0, cz1), fE = frame('w', cx1, cz0, 0, cz1);
  billboard(C, g, fW, 7.5, 13.5, fl + 0.5, fl + 2.9, { out: 0.08, bright: 1.5, noGlow: true, mode: 2 });
  billboard(C, g, fE, 1.5, 7.5, fl + 0.5, fl + 2.9, { out: 0.08, bright: 1.5, noGlow: true, mode: 0 });
  C.lights.length -= 2;   // the concourse has its own lights
  bench(C, g, cx0 + 0.6, cz1 - 3, Math.PI / 2, fl);
}

// Sky deck on the hotel roof, reached by the lift.
export function buildSkyDeck(C, g, info, door) {
  const [x0, z0, x1, z1] = info.R, y = info.H, r = C.rng;
  addCollider(C, x0, y - 1, z0, x1, y, z1);
  g.box(x0, y, z0, x1, y + 0.06, z1, { color: [0.09, 0.08, 0.075] });
  const Y = y + 0.06, m = 0.8;
  for (let zz = z0 + 4; zz < z1 - 3; zz += 4.5) g.box(x0 + 2, Y, zz - 0.05, x1 - 2, Y + 0.012, zz + 0.05, { color: NEON.pink, glow: 0.9 });
  rail(C, g, x0 + m, z0 + m, x1 - m, z0 + m, Y, NEON.pink); rail(C, g, x0 + m, z1 - m, x1 - m, z1 - m, Y, NEON.pink);
  rail(C, g, x0 + m, z0 + m, x0 + m, z1 - m, Y, NEON.pink); rail(C, g, x1 - m, z0 + m, x1 - m, z1 - m, Y, NEON.pink);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // lift kiosk
  const kx = x0 + 3.2, kz = cz;
  g.box(kx - 1.6, Y, kz - 1.8, kx + 1.6, Y + 3.4, kz + 1.8, { color: [0.07, 0.07, 0.08] });
  g.box(kx + 1.6, Y, kz - 0.8, kx + 1.66, Y + 2.3, kz + 0.8, { color: [0.9, 0.5, 0.7], glow: 1.1 });
  const L = C.atlas.lift;
  C.screens.quad([kx + 1.67, Y + 2.45, kz + 1.5], [kx + 1.67, Y + 2.45, kz - 1.5], [kx + 1.67, Y + 3.3, kz - 1.5], [kx + 1.67, Y + 3.3, kz + 1.5], L.rect, null, [0, 7, 1, 2], 3, 0.85);
  addCollider(C, kx - 1.6, Y, kz - 1.8, kx + 1.6, Y + 3.4, kz + 1.8);
  C.triggers.push({ x: kx + 2.3, y: Y, z: kz, r: 1.5, label: 'Lift — street level', dest: [door.x + 1.6, S, door.z, -Math.PI / 2] });
  C.triggers.push({ x: door.x + 0.9, y: S, z: door.z, r: 1.7, label: 'Lift — Hoshi sky deck', dest: [kx + 3.2, Y, kz, -Math.PI / 2] });
  // bar with a glowing counter and back-lit shelves
  const bz = z0 + 3.2;
  g.box(cx - 4.5, Y, bz - 0.4, cx + 4.5, Y + 1.1, bz + 0.4, { color: [0.05, 0.04, 0.05], glow: -1 });
  g.box(cx - 4.5, Y + 1.1, bz - 0.5, cx + 4.5, Y + 1.16, bz + 0.5, { color: NEON.magenta, glow: 0.7 });
  g.box(cx - 4, Y, z0 + 1.2, cx + 4, Y + 2.6, z0 + 1.5, { color: [0.04, 0.04, 0.05] });
  for (let k = 0; k < 3; k++) g.box(cx - 3.8, Y + 0.8 + k * 0.6, z0 + 1.5, cx + 3.8, Y + 0.86 + k * 0.6, z0 + 1.62, { color: k % 2 ? NEON.cyan : NEON.amber, glow: 1.4 });
  addCollider(C, cx - 4.5, Y, z0 + 1.2, cx + 4.5, Y + 1.2, bz + 0.4);
  const fB = frame('s', cx - 4, 0, cx + 4, z0 + 1.5);
  wallSign(C, g, fB, 1.5, Y + 2.7, 5, { light: false });
  addLight(C, cx, Y + 2.2, bz + 2, NEON.magenta, 0.8, 22);
  // helipad at the far end
  const hz = z1 - Math.min(9, (z1 - z0) * 0.28);
  g.prism(cx + 2, hz, Y, Y + 0.05, 5.2, 5.2, 28, { color: [0.05, 0.05, 0.055] });
  for (const rr of [5.2, 3.2]) { g.prism(cx + 2, hz, Y + 0.05, Y + 0.09, rr, rr, 28, { color: NEON.amber, glow: 2.2, top: false, smooth: true }); }
  g.box(cx + 0.6, Y + 0.05, hz - 1.6, cx + 1.0, Y + 0.08, hz + 1.6, { color: NEON.amber, glow: 2.4 }); g.box(cx + 3.0, Y + 0.05, hz - 1.6, cx + 3.4, Y + 0.08, hz + 1.6, { color: NEON.amber, glow: 2.4 });
  g.box(cx + 1.0, Y + 0.05, hz - 0.2, cx + 3.0, Y + 0.08, hz + 0.2, { color: NEON.amber, glow: 2.4 });
  addLight(C, cx + 2, Y + 2, hz, NEON.amber, 0.6, 20);
  // loungers, planters, mast
  for (const z of [cz - 4, cz + 3]) bench(C, g, x1 - 2.2, z, -Math.PI / 2, Y);
  lanternString(C, g, [x0 + m, Y + 3.2, bz + 2.5], [x1 - m, Y + 3.2, bz + 2.5], NEON.orange, 9);
  antenna(g, x1 - 2.5, Y, z0 + 2.5, 18, r);
}
