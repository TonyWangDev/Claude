// Collision world: axis-aligned boxes in a uniform grid, plus "pits" (areas whose base floor is
// below street level, used by the metro). The player is a vertical capsule approximated by a
// circle in XZ; walkable surfaces are simply the tops of boxes, so stairs are real steps.

const CELL = 12;
export class CollisionWorld {
  constructor(boxes, pits) {
    this.boxes = boxes; this.pits = pits; this.grid = new Map();
    boxes.forEach((b, i) => {
      if (b[3] - b[0] > 400 || b[5] - b[2] > 400) return;
      for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[3] / CELL); cx++)
        for (let cz = Math.floor(b[2] / CELL); cz <= Math.floor(b[5] / CELL); cz++) {
          const k = cx * 4096 + cz; let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(i);
        }
    });
    this._seen = new Uint32Array(boxes.length); this._stamp = 0; this._out = [];
  }
  query(x, z, r) {
    const out = this._out; out.length = 0; const st = ++this._stamp;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const a = this.grid.get(cx * 4096 + cz); if (!a) continue;
        for (const i of a) if (this._seen[i] !== st) { this._seen[i] = st; out.push(this.boxes[i]); }
      }
    return out;
  }
  baseFloor(x, z) {
    for (const p of this.pits) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p.y;
    return 0;
  }
  // highest walkable surface under the player that is not above feet + step
  floorAt(x, z, feet, step, rad = 0.22) {
    let h = this.baseFloor(x, z);
    for (const b of this.query(x, z, rad)) {
      if (x + rad > b[0] && x - rad < b[3] && z + rad > b[2] && z - rad < b[5] && b[4] <= feet + step && b[4] > h) h = b[4];
    }
    return h;
  }
  // push a circle out of every box that overlaps the body's vertical span
  resolve(pos, rad, feet, height, step) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of this.query(pos.x, pos.z, rad + 0.1)) {
        if (b[4] <= feet + step || b[1] >= feet + height) continue;
        const qx = Math.max(b[0], Math.min(pos.x, b[3])), qz = Math.max(b[2], Math.min(pos.z, b[5]));
        let dx = pos.x - qx, dz = pos.z - qz; const d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; pos.x += dx * k; pos.z += dz * k; }
        else { // centre is inside the box: leave through the nearest face
          const l = pos.x - b[0], r = b[3] - pos.x, n = pos.z - b[2], s = b[5] - pos.z, m = Math.min(l, r, n, s);
          if (m === l) pos.x = b[0] - rad; else if (m === r) pos.x = b[3] + rad; else if (m === n) pos.z = b[2] - rad; else pos.z = b[5] + rad;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
}
