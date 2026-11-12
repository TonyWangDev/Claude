import * as THREE from 'three';

// Merged-geometry builder. Everything static in the city is appended into a handful of these
// so the whole district renders in a few draw calls.
//
// Vertex layout: position, normal, color, aUv (facade cell coords), aFacade (style, seed, cellW, floorH), aGlow.

class Buf {
  constructor(Type, cap) { this.T = Type; this.a = new Type(cap); this.n = 0; }
  need(k) {
    if (this.n + k > this.a.length) {
      const b = new this.T(Math.max(this.a.length * 2, this.n + k));
      b.set(this.a); this.a = b;
    }
  }
  trim() { return this.a.slice(0, this.n); }
}

const DEF = { color: [0.1, 0.1, 0.1], style: -1, seed: 0, cw: 1, fh: 1, glow: 0 };

// Wall frame for one side of an axis-aligned footprint. `r` points to the viewer's right when
// looking at the wall from outside, `n` is the outward normal.
export function frame(side, x0, z0, x1, z1) {
  switch (side) {
    case 's': return { ox: x0, oz: z1, rx: 1, rz: 0, nx: 0, nz: 1, L: x1 - x0 };
    case 'n': return { ox: x1, oz: z0, rx: -1, rz: 0, nx: 0, nz: -1, L: x1 - x0 };
    case 'e': return { ox: x1, oz: z1, rx: 0, rz: -1, nx: 1, nz: 0, L: z1 - z0 };
    default: return { ox: x0, oz: z0, rx: 0, rz: 1, nx: -1, nz: 0, L: z1 - z0 };
  }
}
export const fpt = (f, u, out = 0) => [f.ox + f.rx * u + f.nx * out, f.oz + f.rz * u + f.nz * out];

export class Geo {
  constructor(cap = 8192) {
    this.pos = new Buf(Float32Array, cap * 3);
    this.nor = new Buf(Float32Array, cap * 3);
    this.col = new Buf(Float32Array, cap * 3);
    this.uv = new Buf(Float32Array, cap * 2);
    this.fac = new Buf(Float32Array, cap * 4);
    this.glow = new Buf(Float32Array, cap);
    this.idx = new Buf(Uint32Array, cap * 2);
    this.count = 0;
    this.xf = null;
  }

  // local transform for props: rotate about Y then translate
  place(x, y, z, ry = 0) { this.xf = { x, y, z, c: Math.cos(ry), s: Math.sin(ry) }; return this; }
  unplace() { this.xf = null; return this; }

  vert(px, py, pz, nx, ny, nz, u, v, o) {
    const t = this.xf;
    if (t) {
      const x = px * t.c + pz * t.s, z = -px * t.s + pz * t.c;
      px = x + t.x; pz = z + t.z; py += t.y;
      const mx = nx * t.c + nz * t.s, mz = -nx * t.s + nz * t.c;
      nx = mx; nz = mz;
    }
    const { pos, nor, col, uv, fac, glow } = this;
    pos.need(3); nor.need(3); col.need(3); uv.need(2); fac.need(4); glow.need(1);
    pos.a[pos.n++] = px; pos.a[pos.n++] = py; pos.a[pos.n++] = pz;
    nor.a[nor.n++] = nx; nor.a[nor.n++] = ny; nor.a[nor.n++] = nz;
    const c = o.color || DEF.color;
    col.a[col.n++] = c[0]; col.a[col.n++] = c[1]; col.a[col.n++] = c[2];
    uv.a[uv.n++] = u; uv.a[uv.n++] = v;
    fac.a[fac.n++] = o.style ?? -1; fac.a[fac.n++] = o.seed ?? 0; fac.a[fac.n++] = o.cw ?? 1; fac.a[fac.n++] = o.fh ?? 1;
    glow.a[glow.n++] = o.glow ?? 0;
    return this.count++;
  }

  // p0..p3 counter-clockwise seen from the front; uv rect (u0,v0)-(u1,v1)
  quad(p0, p1, p2, p3, n, u0, v0, u1, v1, o = DEF) {
    const a = this.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], u0, v0, o);
    this.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], u1, v0, o);
    this.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], u1, v1, o);
    this.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], u0, v1, o);
    const i = this.idx; i.need(6);
    i.a[i.n++] = a; i.a[i.n++] = a + 1; i.a[i.n++] = a + 2; i.a[i.n++] = a; i.a[i.n++] = a + 2; i.a[i.n++] = a + 3;
  }

  // quad with automatically computed normal
  quadN(p0, p1, p2, p3, u0, v0, u1, v1, o = DEF) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    this.quad(p0, p1, p2, p3, [nx / l, ny / l, nz / l], u0, v0, u1, v1, o);
  }

  // flat panel on a wall frame
  wall(f, u0, u1, y0, y1, out, o = DEF, uvr) {
    const a = fpt(f, u0, out), b = fpt(f, u1, out);
    const r = uvr || [u0, y0, u1, y1];
    this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [f.nx, 0, f.nz], r[0], r[1], r[2], r[3], o);
  }

  // axis-aligned box given min/max corners. o.sides (default all four), o.top (default true), o.bottom (default false)
  box(x0, y0, z0, x1, y1, z1, o = DEF) {
    const sides = o.sides || 'nsew';
    const plain = (o.style ?? -1) < 0;
    const cw = o.cw || 1, fh = o.fh || 1, seed = o.seed || 0;
    for (let k = 0; k < sides.length; k++) {
      const f = frame(sides[k], x0, z0, x1, z1);
      const n = plain ? f.L : Math.max(1, Math.round(f.L / cw));
      const oo = plain ? o : { ...o, seed: seed + k * 0.371, cw: f.L / n };
      this.wall(f, 0, f.L, y0, y1, 0, oo, [0, y0 / fh, n, y1 / fh]);
    }
    const flat = plain ? o : { ...o, style: -1, cw: 1, fh: 1, glow: o.roofGlow ?? 0, color: o.roofColor || o.color };
    if (o.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], x0, z0, x1, z1, flat);
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], x0, z0, x1, z1, flat);
  }

  // centred box
  cbox(cx, cy, cz, sx, sy, sz, o = DEF) {
    this.box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, o);
  }

  // vertical n-gon prism / frustum. o.rot (radians), o.smooth (radial normals), o.top, o.bottom
  prism(cx, cz, y0, y1, r0, r1, sides, o = DEF) {
    const rot = o.rot || 0, plain = (o.style ?? -1) < 0;
    const cw = o.cw || 1, fh = o.fh || 1, seed = o.seed || 0;
    const slope = (r0 - r1) / Math.max(1e-3, y1 - y0);
    for (let i = 0; i < sides; i++) {
      const a0 = rot + (i / sides) * Math.PI * 2, a1 = rot + ((i + 1) / sides) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const w = 2 * r0 * Math.sin(Math.PI / sides);
      const n = plain ? w : Math.max(1, Math.round(w / cw));
      const oo = plain ? o : { ...o, seed: seed + i * 0.371, cw: w / n };
      const ub = plain ? i * w : 0;
      // going a0 -> a1 around +Y viewed from outside is right-to-left, so swap
      const p0 = [cx + c1 * r0, y0, cz + s1 * r0], p1 = [cx + c0 * r0, y0, cz + s0 * r0];
      const p2 = [cx + c0 * r1, y1, cz + s0 * r1], p3 = [cx + c1 * r1, y1, cz + s1 * r1];
      if (o.smooth) {
        const nl = Math.hypot(1, slope);
        const a = this.vert(p0[0], p0[1], p0[2], c1 / nl, slope / nl, s1 / nl, ub, y0 / fh, oo);
        this.vert(p1[0], p1[1], p1[2], c0 / nl, slope / nl, s0 / nl, ub + n, y0 / fh, oo);
        this.vert(p2[0], p2[1], p2[2], c0 / nl, slope / nl, s0 / nl, ub + n, y1 / fh, oo);
        this.vert(p3[0], p3[1], p3[2], c1 / nl, slope / nl, s1 / nl, ub, y1 / fh, oo);
        const ix = this.idx; ix.need(6);
        ix.a[ix.n++] = a; ix.a[ix.n++] = a + 1; ix.a[ix.n++] = a + 2; ix.a[ix.n++] = a; ix.a[ix.n++] = a + 2; ix.a[ix.n++] = a + 3;
      } else {
        this.quadN(p0, p1, p2, p3, ub, y0 / fh, ub + n, y1 / fh, oo);
      }
    }
    const flat = plain ? o : { ...o, style: -1, cw: 1, fh: 1, glow: o.roofGlow ?? 0 };
    const cap = (y, r, up) => {
      const c = this.vert(cx, y, cz, 0, up, 0, cx, cz, flat);
      for (let i = 0; i <= sides; i++) {
        const a = rot + (i / sides) * Math.PI * 2;
        this.vert(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, up, 0, cx + Math.cos(a) * r, cz + Math.sin(a) * r, flat);
      }
      const ix = this.idx; ix.need(sides * 3);
      for (let i = 0; i < sides; i++) {
        ix.a[ix.n++] = c;
        if (up > 0) { ix.a[ix.n++] = c + 2 + i; ix.a[ix.n++] = c + 1 + i; } else { ix.a[ix.n++] = c + 1 + i; ix.a[ix.n++] = c + 2 + i; }
      }
    };
    if (o.top !== false && r1 > 0.01) cap(y1, r1, 1);
    if (o.bottom) cap(y0, r0, -1);
  }

  // smooth tube between two arbitrary points (pipes, rails, cables)
  tube(a, b, r, sides = 6, o = DEF) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    d[0] /= L; d[1] /= L; d[2] /= L;
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(d[1]) > 0.9) { ux = 1; uy = 0; }
    // v = d x u ; u = v x d
    let vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
    const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
    ux = vy * d[2] - vz * d[1]; uy = vz * d[0] - vx * d[2]; uz = vx * d[1] - vy * d[0];
    const base = this.count;
    for (let i = 0; i <= sides; i++) {
      const t = (i / sides) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const nx = ux * c + vx * s, ny = uy * c + vy * s, nz = uz * c + vz * s;
      this.vert(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r, nx, ny, nz, i, 0, o);
      this.vert(b[0] + nx * r, b[1] + ny * r, b[2] + nz * r, nx, ny, nz, i, L, o);
    }
    const ix = this.idx; ix.need(sides * 6);
    for (let i = 0; i < sides; i++) {
      const k = base + i * 2;
      ix.a[ix.n++] = k; ix.a[ix.n++] = k + 3; ix.a[ix.n++] = k + 1; ix.a[ix.n++] = k; ix.a[ix.n++] = k + 2; ix.a[ix.n++] = k + 3;
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.trim(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.trim(), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.trim(), 3));
    g.setAttribute('aUv', new THREE.BufferAttribute(this.uv.trim(), 2));
    g.setAttribute('aFacade', new THREE.BufferAttribute(this.fac.trim(), 4));
    g.setAttribute('aGlow', new THREE.BufferAttribute(this.glow.trim(), 1));
    g.setIndex(new THREE.BufferAttribute(this.idx.trim(), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Geometry for LED screens, neon signs and holograms (atlas-textured quads).
export class ScreenGeo {
  constructor() { this.p = []; this.uv = []; this.r1 = []; this.r2 = []; this.an = []; this.sz = []; this.ix = []; this.count = 0; }
  // corners CCW from front. anim = [mode, seed, speed, brightness]
  quad(p0, p1, p2, p3, rect, rect2, anim, w, h) {
    const b = this.count;
    const P = [p0, p1, p2, p3], U = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 4; i++) {
      this.p.push(P[i][0], P[i][1], P[i][2]); this.uv.push(U[i][0], U[i][1]);
      this.r1.push(rect[0], rect[1], rect[2], rect[3]);
      const q = rect2 || rect; this.r2.push(q[0], q[1], q[2], q[3]);
      this.an.push(anim[0], anim[1], anim[2], anim[3]); this.sz.push(w, h);
    }
    this.ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.count += 4;
  }
  // screen on a wall frame
  wall(f, u0, u1, y0, y1, out, rect, rect2, anim) {
    const a = fpt(f, u0, out), b = fpt(f, u1, out);
    this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], rect, rect2, anim, u1 - u0, y1 - y0);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aRect', new THREE.Float32BufferAttribute(this.r1, 4));
    g.setAttribute('aRect2', new THREE.Float32BufferAttribute(this.r2, 4));
    g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.an, 4));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(this.sz, 2));
    g.setIndex(this.ix);
    g.computeBoundingSphere();
    return g;
  }
}
