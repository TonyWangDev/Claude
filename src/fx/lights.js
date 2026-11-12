import * as THREE from 'three';

// A fixed pool of real point lights is continuously re-assigned to the most relevant neon
// sources around the camera (out of the many hundreds registered by the world generator).
// Each light fades out towards the edge of the selection so reassignment never pops.

export class LightPool {
  constructor(scene, sources, max = 12) {
    this.src = sources; this.pool = []; this.n = 0; this.R = 40; this.acc = 1; this.scene = scene;
    this.score = new Float32Array(sources.length);
    for (let i = 0; i < max; i++) { const l = new THREE.PointLight(0xffffff, 0, 40, 1.7); l.userData.src = -1; scene.add(l); this.pool.push(l); }
    this.setCount(max);
  }
  setCount(n) { this.n = Math.min(n, this.pool.length); this.pool.forEach((l, i) => { if (i >= this.n) { l.intensity = 0; l.userData.src = -1; } }); }
  update(cam, dt) {
    this.acc += dt;
    const src = this.src, N = this.n, p = cam.position;
    if (this.acc > 0.12) {
      this.acc = 0;
      // score = distance scaled down for strong sources
      const best = [];
      for (let i = 0; i < src.length; i++) {
        const s = src[i], dx = s.x - p.x, dy = (s.y - p.y) * 1.6, dz = s.z - p.z;
        const sc = Math.sqrt(dx * dx + dy * dy + dz * dz) / (0.55 + s.i * 0.6);
        this.score[i] = sc;
        if (best.length < N + 1 || sc < this.score[best[best.length - 1]]) {
          let k = best.length; best.push(i);
          while (k > 0 && this.score[best[k - 1]] > sc) { best[k] = best[k - 1]; k--; }
          best[k] = i; if (best.length > N + 1) best.pop();
        }
      }
      this.targetR = best.length > N ? this.score[best[N]] : 80;
      // keep lights that are still selected, hand free lights to newcomers
      const want = new Set(best.slice(0, N));
      const free = [];
      for (let i = 0; i < N; i++) { const l = this.pool[i]; if (want.has(l.userData.src)) want.delete(l.userData.src); else free.push(l); }
      for (const id of want) { const l = free.pop(); if (!l) break; const s = src[id]; l.userData.src = id; l.position.set(s.x, s.y, s.z); l.color.setRGB(s.r, s.g, s.b); l.distance = s.range; l.intensity = 0; }
    }
    this.R += ((this.targetR ?? 40) - this.R) * (1 - Math.exp(-dt * 3));
    for (let i = 0; i < N; i++) {
      const l = this.pool[i], id = l.userData.src; if (id < 0) continue;
      const s = src[id], sc = this.score[id];
      const fade = 1 - Math.min(1, Math.max(0, (sc / this.R - 0.55) / 0.4));
      const tgt = s.i * 42 * fade * fade;
      l.intensity += (tgt - l.intensity) * (1 - Math.exp(-dt * 8));
    }
  }
}
