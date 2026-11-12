import * as THREE from 'three';

// Replaces three.js' fog chunks with an analytic height fog shared by every material in the scene
// (built-in and custom). Density falls off exponentially with altitude, a cloud deck swallows the
// tops of the tallest towers, and the fog colour depends on view direction so the haze near the
// horizon glows with city light while it darkens overhead. The sky dome uses the same colour
// function, so geometry dissolves seamlessly into the sky.

export const FOG_FUNCS = /* glsl */ `
vec3 ncFogColor(vec3 dir, vec3 base) {
  float h = clamp(dir.y, -1.0, 1.0);
  vec3 glow = base * 2.1 + vec3(0.030, 0.008, 0.030);
  vec3 high = base * 0.42;
  vec3 c = mix(glow, high, smoothstep(-0.05, 0.55, h));
  // a warm sodium band right on the horizon
  c += vec3(0.05, 0.018, 0.012) * exp(-abs(h) * 9.0) * (base.r * 12.0);
  return c;
}
float ncFogAmount(vec3 camPos, vec3 wpos, float density) {
  vec3 fv = wpos - camPos;
  float fd = length(fv);
  const float k = 0.0105;
  float y0 = max(camPos.y, 0.0);
  float t = k * fv.y;
  float integ = exp(-k * y0) * (abs(t) > 1e-3 ? (1.0 - exp(-t)) / t : 1.0);
  float od = density * fd * (integ * 0.88 + 0.12);
  // cloud deck: the upper floors of the tallest towers disappear
  float cl = smoothstep(335.0, 640.0, wpos.y);
  od += cl * cl * 2.6 * clamp(fd / 250.0, 0.0, 1.0) * (0.6 + min(density, 0.006) * 180.0);
  return 1.0 - exp(-od);
}
`;

export function installFog() {
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorld;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogWorld = cameraPosition + (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogDensity;
  varying vec3 vFogWorld;
  ${FOG_FUNCS}
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    float ncF = ncFogAmount(cameraPosition, vFogWorld, fogDensity);
    #ifdef NC_ADDITIVE
      gl_FragColor.rgb *= (1.0 - ncF);
    #else
      gl_FragColor.rgb = mix(gl_FragColor.rgb, ncFogColor(normalize(vFogWorld - cameraPosition), fogColor), ncF);
    #endif
  }
#endif`;
}
