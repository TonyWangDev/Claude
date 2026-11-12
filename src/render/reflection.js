import * as THREE from 'three';

// Planar reflection of the whole scene about the street plane (y = 0), rendered into an HDR
// target. The ground shader samples it with roughness-dependent blur and vertical streaking.

export class PlanarReflection {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.cam = new THREE.PerspectiveCamera();
    this.matrix = new THREE.Matrix4();
    this.plane = new THREE.Plane(); this.clip = new THREE.Vector4(); this.q = new THREE.Vector4();
    this.n = new THREE.Vector3(0, 1, 0); this.v = new THREE.Vector3(); this.t = new THREE.Vector3(); this.rot = new THREE.Matrix4(); this.look = new THREE.Vector3();
  }
  setSize(w, h) { this.rt.setSize(Math.max(4, Math.floor(w)), Math.max(4, Math.floor(h))); }
  render(renderer, scene, camera, hidden) {
    const { cam, n, v, t, rot, look } = this;
    const cp = camera.position;
    if (cp.y < 0.05) return false;
    v.set(cp.x, -cp.y, cp.z);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(cp);
    t.set(look.x, -look.y, look.z);
    cam.position.copy(v);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    cam.lookAt(t);
    cam.near = camera.near; cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique near plane so nothing below the street leaks into the reflection
    this.plane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, 0, 0)).applyMatrix4(cam.matrixWorldInverse);
    const c = this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant), pm = cam.projectionMatrix.elements, q = this.q;
    q.x = (Math.sign(c.x) + pm[8]) / pm[0]; q.y = (Math.sign(c.y) + pm[9]) / pm[5]; q.z = -1; q.w = (1 + pm[10]) / pm[14];
    c.multiplyScalar(2 / c.dot(q));
    pm[2] = c.x; pm[6] = c.y; pm[10] = c.z + 1 - 0.003; pm[14] = c.w;

    for (const o of hidden) { o.userData._v = o.visible; o.visible = false; }
    const prevT = renderer.getRenderTarget(), sh = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(prevT); renderer.shadowMap.autoUpdate = sh;
    for (const o of hidden) o.visible = o.userData._v;
    return true;
  }
}
