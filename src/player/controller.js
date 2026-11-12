import * as THREE from 'three';
import { BOUND, EYE, SIDEWALK_H } from '../config.js';

// First-person controller: pointer-lock mouse look, WASD with smooth acceleration, sprint, jump,
// stair stepping, a very restrained head bob and a slight FOV kick while sprinting.

const WALK = 4.6, SPRINT = 9.2, ACCEL = 9, AIR = 2.2, GRAV = 24, JUMP = 7.4, RADIUS = 0.38, HEIGHT = 1.8, STEP = 0.4;

export class Player {
  constructor(camera, dom, world) {
    this.camera = camera; this.dom = dom; this.world = world;
    this.pos = new THREE.Vector3(3.5, SIDEWALK_H, 62); this.vel = new THREE.Vector3();
    this.yaw = 0.12; this.pitch = 0.22; this.sens = 1; this.baseFov = 72;
    this.onGround = true; this.eyeY = this.pos.y + EYE; this.bob = 0; this.bobAmp = 0; this.keys = new Set();
    this.locked = false; this.enabled = false; this.stepPhase = 0; this.onStep = null; this.speed = 0;
    this.look = new THREE.Vector2(); this.sm = new THREE.Vector2();
    addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'Space' && this.locked) e.preventDefault(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const mx = Math.max(-150, Math.min(150, e.movementX)), my = Math.max(-150, Math.min(150, e.movementY));
      this.look.x += mx; this.look.y += my;
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; if (!this.locked) this.keys.clear(); this.onLock && this.onLock(this.locked); });
  }
  lock() { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); }
  teleport(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); if (yaw !== undefined) this.yaw = yaw; this.eyeY = y + EYE; }

  update(dt) {
    const k = this.keys, w = this.world;
    // mouse look with a touch of smoothing
    const s = 0.0021 * this.sens;
    const a = 1 - Math.exp(-dt * 38);
    const lx = this.look.x * a, ly = this.look.y * a; this.look.x -= lx; this.look.y -= ly;
    this.yaw -= lx * s; this.pitch -= ly * s;
    this.pitch = Math.max(-1.52, Math.min(1.54, this.pitch));

    let fx = 0, fz = 0;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) fz += 1; if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) fx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    }
    const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
    const sprint = (k.has('ShiftLeft') || k.has('ShiftRight')) && fz > 0;
    const max = sprint ? SPRINT : WALK;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * fz + cy * fx) * max, wz = (-cy * fz - sy * fx) * max;
    const acc = 1 - Math.exp(-dt * (this.onGround ? ACCEL : AIR));
    this.vel.x += (wx - this.vel.x) * acc; this.vel.z += (wz - this.vel.z) * acc;

    if (this.onGround && this.enabled && k.has('Space')) { this.vel.y = JUMP; this.onGround = false; }
    this.vel.y -= GRAV * dt;

    // horizontal move in small sub-steps so thin walls cannot be tunnelled
    const dist = Math.hypot(this.vel.x, this.vel.z) * dt, n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n; i++) {
      this.pos.x += (this.vel.x * dt) / n; this.pos.z += (this.vel.z * dt) / n;
      w.resolve(this.pos, RADIUS, this.pos.y, HEIGHT, this.onGround ? STEP : 0.12);
    }
    this.pos.x = Math.max(-BOUND, Math.min(BOUND, this.pos.x)); this.pos.z = Math.max(-BOUND, Math.min(BOUND, this.pos.z));

    // vertical
    this.pos.y += this.vel.y * dt;
    const floor = w.floorAt(this.pos.x, this.pos.z, this.pos.y, this.onGround ? STEP : 0.25);
    if (this.pos.y <= floor) {
      if (!this.onGround && this.vel.y < -6 && this.onStep) this.onStep(1.6);
      this.pos.y = floor; this.vel.y = 0; this.onGround = true;
    } else if (this.onGround && this.pos.y - floor < STEP + 0.05 && this.vel.y <= 0) {
      this.pos.y = floor; this.vel.y = 0;        // stick to stairs going down
    } else this.onGround = false;

    // camera: smooth out steps, gentle bob
    const sp = Math.hypot(this.vel.x, this.vel.z); this.speed = sp;
    const target = this.pos.y + EYE;
    this.eyeY += (target - this.eyeY) * (1 - Math.exp(-dt * 16));
    if (Math.abs(target - this.eyeY) > 1.2) this.eyeY = target;
    const moving = this.onGround && sp > 0.6;
    this.bobAmp += ((moving ? Math.min(1, sp / WALK) : 0) - this.bobAmp) * (1 - Math.exp(-dt * 6));
    const prev = this.stepPhase;
    if (moving) this.stepPhase += dt * (1.55 + sp * 0.27);
    if (Math.floor(prev) !== Math.floor(this.stepPhase) && this.onStep) this.onStep(sprint ? 1.2 : 0.8);
    const ph = this.stepPhase * Math.PI;
    const by = Math.abs(Math.sin(ph)) * 0.028 * this.bobAmp, bx = Math.cos(ph) * 0.014 * this.bobAmp;
    this.camera.position.set(this.pos.x + cy * bx, this.eyeY - 0.014 * this.bobAmp + by, this.pos.z - sy * bx);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(ph) * 0.0016 * this.bobAmp, 'YXZ');
    const fov = this.baseFov + (sprint && sp > WALK ? 5 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.02) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 5)); this.camera.updateProjectionMatrix(); }
  }
}
