import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// HDR pipeline: scene (MSAA, half-float) -> bloom -> filmic grade (ACES tone map, split-toned
// shadows/highlights, chromatic aberration, vignette, grain, rain-on-lens streaks).

const Grade = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 1.0 }, uRain: { value: 0 }, uFade: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime, uExposure, uRain, uFade; varying vec2 vUv;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { x *= 0.62; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 c = vUv - 0.5; float r2 = dot(c, c);
  vec2 dir = c * r2 * 0.007;
  vec3 col;
  col.r = texture2D(tDiffuse, vUv - dir).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv + dir).b;
  col *= uExposure;
  col = aces(col);
  // grade: cool shadows, warm highlights, a little extra contrast and saturation
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col * vec3(0.90, 0.98, 1.12), (1.0 - smoothstep(0.0, 0.45, l)) * 0.55);
  col = mix(col, col * vec3(1.05, 1.0, 0.95), smoothstep(0.5, 1.0, l) * 0.4);
  col = mix(vec3(l), col, 1.14);
  col = mix(col, smoothstep(0.0, 1.0, col), 0.22);
  col *= 1.0 - smoothstep(0.12, 0.95, r2 * 1.9) * 0.55;
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (h21(gl_FragCoord.xy + fract(uTime) * 311.0) - 0.5) * 0.028;
  col *= 1.0 - uFade;
  gl_FragColor = vec4(col, 1.0);
}`,
};

export class PostFX {
  constructor(renderer, scene, camera, samples) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.build(samples);
  }
  build(samples) {
    const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); }
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(r, rt);
    this.composer.setPixelRatio(1); this.composer.setSize(size.x, size.y);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.42, 0.6, 1.0);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(Grade);
    this.composer.addPass(this.grade);
  }
  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);
  }
  render(time, fade) {
    this.grade.uniforms.uTime.value = time; this.grade.uniforms.uFade.value = fade;
    this.composer.render();
  }
}
