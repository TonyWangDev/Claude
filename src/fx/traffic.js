import * as THREE from 'three';
import { Geo } from '../world/geo.js';
import { cone } from '../world/street.js';
import { NEON } from '../config.js';
import { RAIL_Y, RAIL_Z, HWY_Y, HWY_X } from '../world/infra.js';
import { U } from '../world/materials.js';
import { RNG } from '../rng.js';

// Everything that moves: ground cars on stadium-shaped circuits, expressway traffic, flying
// vehicles on stacked air lanes, elevated trains and sweeping searchlights.

class LightPoints {
  constructor(n) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uScale: { value: 700 } },
      fog: true, defines: { NC_ADDITIVE: 1 }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vC;
#include <fog_pars_vertex>
void main() { vC = aCol; vec4 mvPosition = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(aSize * uScale / max(-mvPosition.z, 1.0), 2.0, 110.0);
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */ `
varying vec3 vC;
#include <fog_pars_fragment>
void main() { float r = length(gl_PointCoord * 2.0 - 1.0); float a = pow(clamp(1.0 - r, 0.0, 1.0), 3.0) + 0.6 * pow(clamp(1.0 - r * 2.5, 0.0, 1.0), 2.0);
  gl_FragColor = vec4(vC * a, 1.0);
  #include <fog_fragment>
}`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9; this.k = 0;
  }
  begin() { this.k = 0; }
  add(x, y, z, r, g, b, s) { const k = this.k++; if (k >= this.n) return; this.pos.set([x, y, z], k * 3); this.col.set([r, g, b], k * 3); this.size[k] = s; }
  end() {
    for (let k = this.k; k < this.n; k++) this.size[k] = 0;
    const a = this.mesh.geometry.attributes; a.position.needsUpdate = a.aCol.needsUpdate = a.aSize.needsUpdate = true;
  }
}

function carGeo(accent) {
  const g = new Geo(512);
  const body = { color: [0.045, 0.047, 0.055], glow: -1, bottom: true };
  g.box(-0.95, 0.28, -2.2, 0.95, 0.78, 2.2, body);
  g.box(-0.9, 0.2, -1.9, 0.9, 0.3, 1.9, { color: [0.02, 0.02, 0.02], bottom: true });
  // cabin with raked ends
  const y0 = 0.78, y1 = 1.24, gl = { color: [0.01, 0.014, 0.02], glow: -1 };
  g.quadN([-0.78, y0, 1.25], [0.78, y0, 1.25], [0.7, y1, 0.45], [-0.7, y1, 0.45], 0, 0, 1, 1, gl);
  g.quadN([0.78, y0, -1.5], [-0.78, y0, -1.5], [-0.7, y1, -0.8], [0.7, y1, -0.8], 0, 0, 1, 1, gl);
  g.quadN([-0.7, y1, 0.45], [0.7, y1, 0.45], [0.7, y1, -0.8], [-0.7, y1, -0.8], 0, 0, 1, 1, body);
  g.quadN([0.78, y0, 1.25], [0.78, y0, -1.5], [0.7, y1, -0.8], [0.7, y1, 0.45], 0, 0, 1, 1, gl);
  g.quadN([-0.78, y0, -1.5], [-0.78, y0, 1.25], [-0.7, y1, 0.45], [-0.7, y1, -0.8], 0, 0, 1, 1, gl);
  // light bars: front (+z), rear (-z), accent underglow
  g.box(-0.85, 0.56, 2.2, 0.85, 0.66, 2.23, { color: [0.85, 0.93, 1], glow: 7 });
  g.box(-0.85, 0.58, -2.23, 0.85, 0.68, -2.2, { color: NEON.red, glow: 6 });
  g.box(-0.97, 0.3, -1.8, -0.95, 0.34, 1.8, { color: accent, glow: 3 }); g.box(0.95, 0.3, -1.8, 0.97, 0.34, 1.8, { color: accent, glow: 3 });
  for (const [x, z] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) g.box(x - 0.14, 0, z - 0.36, x + 0.14, 0.62, z + 0.36, { color: [0.012, 0.012, 0.012] });
  return g.build();
}

function flyerGeo() {
  const g = new Geo(256);
  const body = { color: [0.05, 0.052, 0.06], glow: -1, bottom: true };
  g.box(-1.1, -0.3, -2.6, 1.1, 0.35, 2.4, body);
  g.box(-0.8, 0.35, -1.2, 0.8, 0.85, 1.2, { color: [0.012, 0.016, 0.022], glow: -1 });
  g.box(-2.2, -0.1, -1.6, -1.1, 0.1, 0.2, body); g.box(1.1, -0.1, -1.6, 2.2, 0.1, 0.2, body);
  g.box(-0.9, -0.34, -2.0, 0.9, -0.3, 2.0, { color: NEON.cyan, glow: 2.5, bottom: true });
  g.box(-0.8, 0.0, 2.4, 0.8, 0.12, 2.43, { color: [0.9, 0.95, 1], glow: 8 });
  g.box(-0.9, 0.0, -2.63, 0.9, 0.14, -2.6, { color: NEON.red, glow: 7 });
  return g.build();
}

// position on a stadium-shaped circuit along a street. Returns [x, z, dx, dz]
function stadium(lane, s, out) {
  const { c, o, e, ax } = lane, st = 2 * e, arc = Math.PI * o, P = 2 * st + 2 * arc;
  s = ((s % P) + P) % P;
  let a, b, da, db;
  if (s < st) { a = c + o; b = e - s; da = 0; db = -1; }
  else if (s < st + arc) { const f = (s - st) / o; a = c + o * Math.cos(f); b = -e - o * Math.sin(f); da = -Math.sin(f); db = -Math.cos(f); }
  else if (s < 2 * st + arc) { a = c - o; b = -e + (s - st - arc); da = 0; db = 1; }
  else { const f = (s - 2 * st - arc) / o; a = c - o * Math.cos(f); b = e + o * Math.sin(f); da = Math.sin(f); db = Math.cos(f); }
  if (ax === 'z') { out[0] = a; out[1] = b; out[2] = da; out[3] = db; } else { out[0] = b; out[1] = 2 * c - a; out[2] = db; out[3] = -da; }
  return P;
}

export class Traffic {
  constructor(scene, cityMat, glowMat, search) {
    const r = new RNG(4242); this.r = r;
    this.points = new LightPoints(700); scene.add(this.points.mesh);
    this.dummy = new THREE.Object3D(); this.tmp = [0, 0, 0, 0];

    // ground cars
    const lanes = [
      { ax: 'z', c: -180, o: 2, e: 520, n: 8 }, { ax: 'z', c: -90, o: 2, e: 520, n: 9 }, { ax: 'z', c: 90, o: 2, e: 520, n: 9 }, { ax: 'z', c: 0, o: 4.6, e: 176, n: 8 },
      { ax: 'x', c: -180, o: 2, e: 520, n: 8 }, { ax: 'x', c: 90, o: 2, e: 520, n: 9 }, { ax: 'x', c: 180, o: 2, e: 520, n: 8 }, { ax: 'x', c: 0, o: 4.0, e: 176, n: 7 },
    ];
    this.cars = [];
    for (const l of lanes) { const P = stadium(l, 0, this.tmp); for (let i = 0; i < l.n; i++) this.cars.push({ l, s: (P * i) / l.n + r.range(-20, 20), v: r.range(8.5, 13), k: this.cars.length % 2 }); }
    this.carMesh = [NEON.cyan, NEON.magenta].map((acc, k) => {
      const m = new THREE.InstancedMesh(carGeo(acc), cityMat, this.cars.filter((c) => c.k === k).length);
      m.frustumCulled = false; m.castShadow = false; scene.add(m); return m;
    });

    // flying vehicles
    this.fly = [];
    for (let i = 0; i < 76; i++) {
      const ax = r.chance(0.5) ? 'x' : 'z';
      this.fly.push({ ax, c: r.int(-5, 5) * 90 + r.range(-4, 4), y: r.pick([58, 74, 96, 120, 150, 185, 230]) + r.range(-3, 3), s: r.range(-1100, 1100), v: r.range(22, 46) * (r.chance(0.5) ? 1 : -1), ph: r.range(0, 10) });
    }
    this.flyMesh = new THREE.InstancedMesh(flyerGeo(), cityMat, this.fly.length); this.flyMesh.frustumCulled = false; scene.add(this.flyMesh);

    // expressway traffic (lights only)
    this.hwy = [];
    for (let i = 0; i < 64; i++) { const dir = i % 2 ? 1 : -1; this.hwy.push({ x: HWY_X + dir * -1 * r.pick([2.2, 5.4]), z: r.range(-700, 700), v: dir * r.range(22, 34) }); }

    // trains
    this.trains = [];
    for (const dir of [1, -1]) {
      const g = new Geo(2048), cars = 5, L = 19;
      for (let i = 0; i < cars; i++) {
        const x0 = i * (L + 0.8) - (cars * (L + 0.8)) / 2, x1 = x0 + L;
        g.box(x0, 0.5, -1.45, x1, 3.7, 1.45, { color: [0.08, 0.085, 0.095], glow: -1, bottom: true });
        g.box(x0 + 0.6, 1.9, -1.47, x1 - 0.6, 2.9, 1.47, { color: [1.0, 0.9, 0.72], glow: 2.0, sides: 'ns', top: false });
        g.box(x0 + 0.2, 3.7, -1.2, x1 - 0.2, 3.95, 1.2, { color: [0.05, 0.05, 0.055] });
        g.box(x0, 1.2, -1.48, x1, 1.32, 1.48, { color: dir > 0 ? NEON.cyan : NEON.orange, glow: 2.4, sides: 'ns', top: false });
        for (const dx of [3, L / 2, L - 3]) g.box(x0 + dx - 0.6, 0.7, -1.49, x0 + dx + 0.6, 2.9, 1.49, { color: [0.03, 0.03, 0.035], sides: 'ns', top: false });
      }
      const half = (cars * (L + 0.8)) / 2;
      g.box(dir * half - 0.05, 1.0, -1.0, dir * half + 0.05, 1.5, 1.0, { color: [1, 0.95, 0.85], glow: 8 });
      g.box(-dir * half - 0.05, 1.0, -1.0, -dir * half + 0.05, 1.4, 1.0, { color: NEON.red, glow: 5 });
      const m = new THREE.Mesh(g.build(), cityMat); m.frustumCulled = false; scene.add(m);
      this.trains.push({ m, dir, x: dir > 0 ? -900 : 400, z: RAIL_Z - dir * 1.7, wait: dir > 0 ? 6 : 0, half });
    }

    // searchlights
    this.search = search.map((s, i) => {
      const g = new Geo(256); cone(g, 0, 0, 0, 1.5, 30, 560, [s.c[0] * 0.75, s.c[1] * 0.75, s.c[2] * 0.75], 12);
      const m = new THREE.Mesh(g.build(), glowMat); m.position.set(s.x, s.y, s.z); m.frustumCulled = false; m.renderOrder = 3; scene.add(m);
      return { m, ph: i * 1.7, sp: 0.07 + (i % 3) * 0.02 };
    });
    void U;
  }

  update(dt, t, cam) {
    const P = this.points, d = this.dummy, tmp = this.tmp; P.begin();
    const idx = [0, 0];
    for (const c of this.cars) {
      c.s += c.v * dt; stadium(c.l, c.s, tmp);
      d.position.set(tmp[0], 0, tmp[1]); d.rotation.set(0, Math.atan2(tmp[2], tmp[3]), 0); d.updateMatrix();
      this.carMesh[c.k].setMatrixAt(idx[c.k]++, d.matrix);
      const dx = tmp[0] - cam.position.x, dz = tmp[1] - cam.position.z;
      if (dx * dx + dz * dz < 250000) {
        P.add(tmp[0] + tmp[2] * 2.3, 0.62, tmp[1] + tmp[3] * 2.3, 1.1, 1.2, 1.35, 1.5);
        P.add(tmp[0] - tmp[2] * 2.3, 0.64, tmp[1] - tmp[3] * 2.3, 1.3, 0.06, 0.08, 1.2);
      }
    }
    this.carMesh.forEach((m) => { m.instanceMatrix.needsUpdate = true; });

    this.fly.forEach((f, i) => {
      f.s += f.v * dt; if (f.s > 1200) f.s -= 2400; if (f.s < -1200) f.s += 2400;
      const y = f.y + Math.sin(t * 0.4 + f.ph) * 1.5, sg = Math.sign(f.v);
      const x = f.ax === 'x' ? f.s : f.c, z = f.ax === 'x' ? f.c : f.s;
      const dx = f.ax === 'x' ? sg : 0, dz = f.ax === 'x' ? 0 : sg;
      d.position.set(x, y, z); d.rotation.set(0, Math.atan2(dx, dz), Math.sin(t * 0.7 + f.ph) * 0.06); d.updateMatrix();
      this.flyMesh.setMatrixAt(i, d.matrix);
      P.add(x + dx * 2.6, y, z + dz * 2.6, 1.2, 1.3, 1.5, 2.2);
      P.add(x - dx * 2.8, y, z - dz * 2.8, 1.5, 0.08, 0.1, 1.8);
      if (((t * 1.3 + f.ph) % 1) < 0.12) P.add(x, y - 0.5, z, 0.3, 1.6, 1.8, 2.6);
    });
    this.flyMesh.instanceMatrix.needsUpdate = true;

    for (const h of this.hwy) {
      h.z += h.v * dt; if (h.z > 700) h.z -= 1400; if (h.z < -700) h.z += 1400;
      const sg = Math.sign(h.v);
      P.add(h.x, HWY_Y + 0.8, h.z + sg * 2, 1.2, 1.25, 1.4, 1.7);
      P.add(h.x, HWY_Y + 0.8, h.z - sg * 2, 1.4, 0.07, 0.08, 1.4);
    }
    P.end();

    this.trainNear = 0;
    for (const tr of this.trains) {
      if (tr.wait > 0) { tr.wait -= dt; tr.m.visible = false; continue; }
      tr.m.visible = true; tr.x += tr.dir * 27 * dt;
      if (Math.abs(tr.x) > 760 && Math.sign(tr.x) === tr.dir) { tr.x = -tr.dir * 760; tr.wait = 14 + this.r.range(0, 22); }
      tr.m.position.set(tr.x, RAIL_Y + 0.1, tr.z);
      const dist = Math.hypot(tr.x - cam.position.x, RAIL_Y - cam.position.y, tr.z - cam.position.z);
      this.trainNear = Math.max(this.trainNear, Math.max(0, 1 - dist / 220));
    }

    for (const s of this.search) {
      s.m.rotation.set(Math.PI + 0.42 + Math.sin(t * s.sp * 1.3 + s.ph) * 0.25, t * s.sp + s.ph, 0, 'YXZ');
    }
  }
}
