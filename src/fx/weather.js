import * as THREE from 'three';
import { U } from '../world/materials.js';

// Rain streaks, ground splashes and steam plumes. Everything is animated in the vertex shader;
// particles live in a box that wraps around the camera, so nothing is updated on the CPU.

export class Rain {
  constructor(count) {
    this.uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0.4 }, uWind: { value: new THREE.Vector2(1.2, 0.4) } };
    const n = count, pos = new Float32Array(n * 6), sd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 44, y = Math.random() * 34, z = Math.random() * 44, s = Math.random();
      pos.set([x, y, z, x, y, z], i * 6); sd.set([s, 0, s, 1], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 2));
    this.lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true, defines: { NC_ADDITIVE: 1 }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
attribute vec2 aSeed; uniform float uTime, uAmount; uniform vec3 uCam; uniform vec2 uWind;
varying float vA;
#include <fog_pars_vertex>
void main() {
  const vec3 B = vec3(44.0, 34.0, 44.0);
  float sp = 19.0 + aSeed.x * 9.0;
  vec3 vel = vec3(uWind.x, -sp, uWind.y);
  vec3 p = position + vel * uTime;
  p = mod(p - uCam + B * 0.5, B) - B * 0.5 + uCam;
  p -= normalize(vel) * aSeed.y * (0.55 + aSeed.x * 0.5);
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float d = -mvPosition.z;
  vA = step(aSeed.x, uAmount) * smoothstep(22.0, 6.0, d) * smoothstep(0.3, 1.5, d) * (0.35 + 0.65 * aSeed.y);
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */ `
varying float vA;
#include <fog_pars_fragment>
void main() { gl_FragColor = vec4(vec3(0.42, 0.5, 0.62) * vA * 0.55, 1.0); 
  #include <fog_fragment>
}`,
    }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 8;

    // splashes
    const m = Math.floor(count * 0.35), sp = new Float32Array(m * 3), ss = new Float32Array(m);
    for (let i = 0; i < m; i++) { sp.set([Math.random() * 36, 0, Math.random() * 36], i * 3); ss[i] = Math.random(); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    this.splash = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true, defines: { NC_ADDITIVE: 1 }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
attribute float aSeed; uniform float uTime, uAmount; uniform vec3 uCam;
varying float vA; varying float vL;
#include <fog_pars_vertex>
void main() {
  const vec2 B = vec2(36.0);
  float cyc = uTime * (1.6 + aSeed) + aSeed * 31.0;
  float life = fract(cyc); float gen = floor(cyc);
  vec2 jit = fract(sin(vec2(gen * 12.9898 + aSeed * 78.233, gen * 39.346 + aSeed * 11.135)) * 43758.5453) * 36.0;
  vec2 q = mod(position.xz + jit - uCam.xz + B * 0.5, B) - B * 0.5 + uCam.xz;
  vec4 mvPosition = viewMatrix * vec4(q.x, 0.05 + life * 0.05, q.y, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float d = -mvPosition.z;
  gl_PointSize = clamp((0.05 + life * 0.22) * 900.0 / d, 1.0, 40.0);
  vL = life;
  vA = step(aSeed, uAmount) * (1.0 - life) * smoothstep(18.0, 4.0, d);
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */ `
varying float vA; varying float vL;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y *= 2.2;
  float r = length(c);
  float ring = smoothstep(0.25, 0.0, abs(r - 0.7)) + (1.0 - vL) * smoothstep(0.4, 0.0, r);
  gl_FragColor = vec4(vec3(0.45, 0.55, 0.7) * ring * vA * 0.5, 1.0);
  #include <fog_fragment>
}`,
    }));
    this.splash.frustumCulled = false; this.splash.renderOrder = 7;
  }
  update(cam, amount, wind, time) {
    this.uniforms.uCam.value.copy(cam.position);
    this.uniforms.uAmount.value = cam.position.y < -0.8 ? 0 : amount;
    this.uniforms.uWind.value.set(1.6 * wind + Math.sin(time * 0.3) * 0.6 * wind, 0.7 * wind);
    this.lines.visible = this.splash.visible = amount > 0.005;
  }
}

export function makeSteam(emitters) {
  const pos = [], par = [], tint = [];
  for (const e of emitters) for (let i = 0; i < e.n; i++) {
    pos.push(e.x, e.y, e.z); par.push(Math.random(), e.size, e.rise, Math.random()); tint.push(e.tint[0], e.tint[1], e.tint[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPar', new THREE.Float32BufferAttribute(par, 4)); g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.uTime, uScale: { value: 800 } },
    fog: true, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
attribute vec4 aPar; attribute vec3 aTint; uniform float uTime, uScale;
varying float vA; varying vec3 vT; varying float vS;
#include <fog_pars_vertex>
void main() {
  float life = fract(uTime * (0.10 + 0.05 * aPar.w) * (6.0 / max(aPar.z, 3.0) + 0.6) + aPar.x);
  vec3 p = position;
  p.y += life * aPar.z;
  p.x += (sin(aPar.x * 40.0 + life * 3.0) * 0.25 + life * 0.9) * aPar.y * 0.6;
  p.z += cos(aPar.w * 50.0 + life * 2.3) * 0.3 * aPar.y * life;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float d = max(-mvPosition.z, 0.5);
  gl_PointSize = min(aPar.y * (0.35 + life * 1.5) * uScale / d, 620.0);
  vA = sin(life * 3.14159) * 0.26 * smoothstep(0.6, 3.0, d);
  vT = aTint; vS = aPar.x;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
varying float vA; varying vec3 vT; varying float vS;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
  a *= 0.75 + 0.25 * sin(c.x * 5.0 + vS * 30.0) * sin(c.y * 4.0 + vS * 17.0);
  gl_FragColor = vec4(vT * (0.2 + 0.12 * (1.0 - c.y)), a * vA);
  #include <fog_fragment>
}`,
  }));
  m.frustumCulled = false; m.renderOrder = 6;
  return m;
}
