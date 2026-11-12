import * as THREE from 'three';
import './ui/style.css';
import { QUALITY, WEATHER, EYE } from './config.js';
import { installFog } from './render/fog.js';
import { PostFX } from './render/postfx.js';
import { PlanarReflection } from './render/reflection.js';
import { buildAtlas } from './world/ads.js';
import { buildCity } from './world/city.js';
import { U } from './world/materials.js';
import { CollisionWorld } from './player/collision.js';
import { Player } from './player/controller.js';
import { Rain, makeSteam } from './fx/weather.js';
import { LightPool } from './fx/lights.js';
import { Traffic } from './fx/traffic.js';
import { Ambience } from './audio/ambience.js';
import { UI } from './ui/ui.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const tick = () => new Promise((r) => setTimeout(r, 16));

async function main() {
  const ui = new UI({ quality: 'high', weather: 'drizzle', sens: 1, fov: 72, volume: 0.7 });
  let autoQ = !ui.hasSavedQuality && !params.get('q');
  if (params.get('q')) ui.s.quality = params.get('q');
  if (params.get('weather')) ui.s.weather = params.get('weather');

  installFog();
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const FOG_BASE = new THREE.Color(0.024, 0.021, 0.047);
  scene.fog = new THREE.FogExp2(FOG_BASE.clone(), 0.002);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 6000);
  camera.rotation.order = 'YXZ';

  // --- ambient light rig: cool sky glow from above, warm street bounce from below, faint key light
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.20, 0.22, 0.42), new THREE.Color(0.30, 0.12, 0.22), 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(new THREE.Color(0.42, 0.55, 1.0), 0.75);
  key.position.set(60, 160, 40); key.castShadow = true;
  key.shadow.camera.left = -120; key.shadow.camera.right = 120; key.shadow.camera.top = 120; key.shadow.camera.bottom = -120;
  key.shadow.camera.near = 10; key.shadow.camera.far = 700; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.6;
  scene.add(key, key.target);

  // --- environment map for glass and wet metal: a tiny scene of neon slabs, prefiltered
  {
    const es = new THREE.Scene(); es.background = new THREE.Color(0.012, 0.012, 0.03);
    const mk = (c, k, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * k, c[1] * k, c[2] * k) })); m.position.set(x, y, z); es.add(m); };
    mk([0.05, 0.85, 1], 2.2, -30, 6, -8, 2, 22, 18); mk([1, 0.08, 0.55], 2.2, 30, 4, 10, 2, 16, 22); mk([1, 0.42, 0.08], 1.6, 6, 2, 32, 26, 8, 2);
    mk([0.55, 0.2, 1], 1.6, -10, 8, -34, 24, 14, 2); mk([0.3, 0.35, 0.6], 0.5, 0, 40, 0, 90, 2, 90); mk([0.9, 0.3, 0.5], 0.25, 0, -14, 0, 90, 2, 90);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  }

  // --- world
  ui.progress(0.08, 'Printing advertisements…'); await tick();
  const atlas = await buildAtlas(renderer.capabilities.getMaxAnisotropy());
  ui.progress(0.3, 'Raising towers…'); await tick();
  const city = buildCity(atlas, renderer);
  scene.add(city.group);
  const C = city.C;
  ui.progress(0.62, 'Starting the rain…'); await tick();

  const world = new CollisionWorld(C.colliders, C.pits);
  const player = new Player(camera, canvas, world);
  const rain = new Rain(QUALITY.ultra.rain); scene.add(rain.lines, rain.splash);
  const steam = makeSteam(C.steam); scene.add(steam);
  const lights = new LightPool(scene, C.lights, 12);
  const traffic = new Traffic(scene, city.cityMat, city.glow.material, C.search);
  const refl = new PlanarReflection(); U.uReflTex.value = refl.rt.texture;
  const audio = new Ambience(); audio.volume = ui.s.volume;
  const post = new PostFX(renderer, scene, camera, 0);

  // --- settings
  let Q = QUALITY[ui.s.quality];
  const wx = { ...WEATHER[ui.s.weather] }; let wxTarget = WEATHER[ui.s.weather];
  function resize() {
    const pr = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    post.setSize();
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    refl.setSize(s.x * Math.max(Q.reflection, 0.1) * 0.8, s.y * Math.max(Q.reflection, 0.1) * 0.8);
  }
  function applyQuality() {
    Q = QUALITY[ui.s.quality];
    const pr = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    post.build(Q.msaa);
    key.castShadow = Q.shadows; key.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true; shadowAt.set(1e9, 0, 0);
    rain.lines.geometry.setDrawRange(0, Q.rain * 2); rain.splash.geometry.setDrawRange(0, Math.floor(Q.rain * 0.35));
    lights.setCount(Q.lights);
    resize();
  }
  const shadowAt = new THREE.Vector3(1e9, 0, 0);
  ui.onChange = (k, v, user) => {
    if (k === 'quality') { applyQuality(); if (user) autoQ = false; }
    if (k === 'weather') wxTarget = WEATHER[v];
    if (k === 'sens') player.sens = v;
    if (k === 'fov') player.baseFov = v;
    if (k === 'volume') audio.setVolume(v);
  };
  player.sens = ui.s.sens; player.baseFov = ui.s.fov; camera.fov = ui.s.fov;
  applyQuality();
  addEventListener('resize', resize);

  // --- interaction
  let started = false, fade = 0, busy = false, active = null;
  player.onStep = (s) => audio.footstep(s, U.uWet.value);
  player.onLock = (locked) => {
    player.enabled = locked;
    if (!started) return;
    ui.show(locked ? null : 'pause');
    if (locked) audio.start(); else audio.suspend();
  };
  ui.onEnter = () => { started = true; audio.start(); ui.show(null); ui.hint(); player.lock(); if (SHOT) player.enabled = true; };
  canvas.addEventListener('click', () => { if (started && !player.locked) player.lock(); });
  addEventListener('keydown', (e) => {
    if (!player.locked) return;
    const wk = { Digit1: 'clear', Digit2: 'drizzle', Digit3: 'storm', Digit4: 'fog' }[e.code];
    if (wk) ui.set('weather', wk);
    if (e.code === 'KeyE' && active && !busy) {
      busy = true; ui.fade(true); audio.blip();
      const d = active.dest;
      setTimeout(() => { player.teleport(d[0], d[1], d[2], d[3]); player.pitch = 0.05; shadowAt.set(1e9, 0, 0); }, 480);
      setTimeout(() => { ui.fade(false); busy = false; }, 900);
    }
  });

  // --- warm up: compile every shader before showing the start screen
  ui.progress(0.8, 'Lighting the signs…'); await tick();
  player.update(0.016);
  if (params.get('pos')) {
    const p = params.get('pos').split(',').map(Number);
    player.teleport(p[0], p[1], p[2], THREE.MathUtils.degToRad(parseFloat(params.get('yaw') || '0')));
    player.pitch = THREE.MathUtils.degToRad(parseFloat(params.get('pitch') || '0'));
  }
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* older drivers: compile lazily */ }
  ui.progress(1, 'Ready'); await tick();
  ui.show(SHOT && !params.has('ui') ? null : 'start');
  if (SHOT) started = true;

  // --- frame loop
  const clock = new THREE.Clock();
  const hidden = [city.ground, rain.lines, rain.splash, steam, traffic.points.mesh];
  const size = new THREE.Vector2();
  let frames = 0; const perf = { t: 0, n: 0, ok: 0 };
  window.__nc = { player, ui, renderer, scene, camera, C, city, lights, step: (n) => { for (let i = 0; i < n; i++) frame(); } };

  const shotFrames = SHOT ? parseInt(params.get('frames') || '6', 10) : Infinity;
  function frame() {
    if (frames < shotFrames) requestAnimationFrame(frame);
    const dt = SHOT ? 0.033 : Math.min(clock.getDelta(), 0.05);
    U.uTime.value += dt; const t = U.uTime.value;

    // idle drift on the title screen
    if (!started) { player.yaw += dt * 0.012; }
    player.update(dt);

    // weather interpolation
    const k = 1 - Math.exp(-dt * 0.6);
    for (const key2 of ['rain', 'wet', 'fog', 'wind']) wx[key2] += (wxTarget[key2] - wx[key2]) * k;
    U.uWet.value = wx.wet; U.uRain.value = wx.rain;
    scene.fog.density = wx.fog;
    scene.fog.color.copy(FOG_BASE).multiplyScalar(1 + Math.max(0, wx.fog - 0.0016) * 150);
    U.uHaze.value = Math.min(3.2, 0.62 + wx.fog * 210);
    rain.update(camera, wx.rain, wx.wind, t);

    traffic.update(dt, t, camera);
    lights.update(camera, dt);
    renderer.getDrawingBufferSize(size);
    steam.material.uniforms.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    traffic.points.mesh.material.uniforms.uScale.value = steam.material.uniforms.uScale.value * 0.9;

    // the shadow frustum follows the player in coarse steps
    if (Q.shadows && shadowAt.distanceToSquared(player.pos) > 30 * 30) {
      shadowAt.copy(player.pos);
      key.target.position.set(Math.round(player.pos.x / 8) * 8, 0, Math.round(player.pos.z / 8) * 8);
      key.position.copy(key.target.position).add(new THREE.Vector3(70, 300, 110));
      key.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true;
    }

    // lift prompts
    active = null;
    for (const tr of C.triggers) if (Math.abs(player.pos.y - tr.y) < 2 && Math.hypot(player.pos.x - tr.x, player.pos.z - tr.z) < tr.r) active = tr;
    ui.prompt(started && player.locked && !busy && active ? active.label : null);

    camera.updateMatrixWorld();
    let on = false;
    if (Q.reflection > 0 && wx.wet > 0.05) on = refl.render(renderer, scene, camera, hidden);
    U.uReflOn.value = on ? 1 : 0; U.uReflMatrix.value.copy(refl.matrix);

    post.render(t, fade);
    audio.update({ rain: wx.rain, height: player.pos.y, underground: player.pos.y < -1, train: traffic.trainNear || 0 });
    // automatic quality: if the default preset cannot hold ~35 fps on this GPU, step down once or twice
    if (autoQ && started && !SHOT && player.locked) {
      perf.t += dt; perf.n++;
      if (perf.t > 3) {
        const fps = perf.n / perf.t; perf.t = 0; perf.n = 0;
        if (fps < 35 && ui.s.quality !== 'low') ui.set('quality', ui.s.quality === 'high' ? 'medium' : 'low', false); else if (++perf.ok > 3) autoQ = false;
      }
    }
    if (++frames >= Math.min(4, shotFrames)) window.__ready = frames >= shotFrames || !SHOT;
  }
  frame();
  void EYE;
}

main().catch((e) => { console.error(e); const s = document.getElementById('status'); if (s) s.textContent = `Failed to start: ${e.message}`; });
