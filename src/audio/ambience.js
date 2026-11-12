// Fully procedural soundscape (Web Audio): city drone, distant traffic wash, rain, ventilation
// hum, neon buzz, passing trains, footsteps and occasional far-off synthetic sirens / chimes.

export class Ambience {
  constructor() { this.ctx = null; this.volume = 0.7; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = this.volume;
    const comp = C.createDynamicsCompressor(); this.master.connect(comp); comp.connect(C.destination);
    // shared noise buffers
    const len = C.sampleRate * 4, white = C.createBuffer(1, len, C.sampleRate), brown = C.createBuffer(1, len, C.sampleRate);
    const w = white.getChannelData(0), b = brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { const x = Math.random() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5; }
    this.white = white;
    const noise = (buf, type, freq, q, gain) => {
      const s = C.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = C.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.master); s.start(0, Math.random() * 3);
      return { f, g };
    };
    const lfo = (param, rate, depth) => { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };
    // deep city drone
    for (const [f, g] of [[43, 0.05], [64.5, 0.035], [86.3, 0.02], [129, 0.01]]) {
      const o = C.createOscillator(), gg = C.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(this.master); o.start();
      lfo(gg.gain, 0.05 + Math.random() * 0.1, g * 0.5); lfo(o.frequency, 0.03 + Math.random() * 0.05, 0.4);
    }
    this.rumble = noise(brown, 'lowpass', 140, 0.5, 0.5);
    // distant traffic: band-passed noise that swells like passing vehicles
    this.traffic = noise(brown, 'bandpass', 420, 0.6, 0.22); lfo(this.traffic.g.gain, 0.09, 0.1); lfo(this.traffic.f.frequency, 0.06, 160);
    // ventilation / machinery
    this.vent = noise(white, 'bandpass', 950, 2.5, 0.012); lfo(this.vent.g.gain, 0.21, 0.004);
    const hum = C.createOscillator(), hg = C.createGain(); hum.type = 'sawtooth'; hum.frequency.value = 100; hg.gain.value = 0.004;
    const hf = C.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 500; hum.connect(hf); hf.connect(hg); hg.connect(this.master); hum.start(); this.hum = hg;
    // rain: bright hiss + lower patter
    this.rainHi = noise(white, 'highpass', 5200, 0.3, 0); this.rainLo = noise(white, 'bandpass', 1500, 0.5, 0);
    // train
    this.train = noise(brown, 'bandpass', 210, 1.2, 0);
    const to = C.createOscillator(), tg = C.createGain(); to.type = 'triangle'; to.frequency.value = 310; tg.gain.value = 0; to.connect(tg); tg.connect(this.master); to.start(); this.trainTone = tg;
    this.next = C.currentTime + 6;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  suspend() { if (this.ctx) this.ctx.suspend(); }
  footstep(strength, wet) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime;
    const s = C.createBufferSource(); s.buffer = this.white; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 500 + wet * 1400; f.Q.value = 0.9;
    const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.085 * strength, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.11 + wet * 0.08);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 3, 0.25);
  }
  blip() { // lift chime
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime;
    [660, 990].forEach((fr, i) => { const o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.value = fr; g.gain.setValueAtTime(0, t + i * 0.16); g.gain.linearRampToValueAtTime(0.09, t + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.16 + 0.9); o.connect(g); g.connect(this.master); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 1); });
  }
  update(state) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime;
    const under = state.underground ? 0.25 : 1, high = Math.min(1, Math.max(0, state.height / 120));
    this.rainHi.g.gain.setTargetAtTime(state.rain * 0.05 * under, t, 0.4); this.rainLo.g.gain.setTargetAtTime(state.rain * 0.085 * under, t, 0.4);
    this.traffic.g.gain.setTargetAtTime(0.22 * under * (1 - high * 0.5), t, 0.5);
    this.rumble.g.gain.setTargetAtTime(0.5 + high * 0.25, t, 0.5);
    this.hum.gain.setTargetAtTime(state.underground ? 0.012 : 0.004, t, 0.3);
    this.train.g.gain.setTargetAtTime(state.train * state.train * 0.9, t, 0.15); this.trainTone.gain.setTargetAtTime(state.train * state.train * 0.012, t, 0.15);
    // sparse distant events
    if (t > this.next) {
      this.next = t + 7 + Math.random() * 16;
      const kind = Math.random(), g = C.createGain(), pan = C.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1; g.connect(pan); pan.connect(this.master);
      const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g);
      if (kind < 0.4) { // far siren
        const o = C.createOscillator(); o.type = 'triangle'; o.connect(f);
        for (let i = 0; i < 6; i++) { o.frequency.setValueAtTime(520, t + i); o.frequency.linearRampToValueAtTime(760, t + i + 0.5); o.frequency.linearRampToValueAtTime(520, t + i + 1); }
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 2); g.gain.linearRampToValueAtTime(0, t + 6); o.start(t); o.stop(t + 6.1);
      } else if (kind < 0.75) { // advertising jingle / chime
        const base = [392, 440, 523, 587][Math.floor(Math.random() * 4)];
        [1, 1.25, 1.5, 2].forEach((m, i) => { const o = C.createOscillator(), e = C.createGain(); o.type = 'sine'; o.frequency.value = base * m; e.gain.setValueAtTime(0, t + i * 0.22); e.gain.linearRampToValueAtTime(0.014, t + i * 0.22 + 0.03); e.gain.exponentialRampToValueAtTime(0.0004, t + i * 0.22 + 1.6); o.connect(e); e.connect(g); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 1.7); });
        g.gain.value = 1;
      } else { // aircraft whoosh overhead
        const s = C.createBufferSource(); s.buffer = this.white; s.loop = true; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1100, t + 2.2); bp.frequency.exponentialRampToValueAtTime(260, t + 5);
        s.connect(bp); bp.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 5); s.start(t); s.stop(t + 5.1);
      }
    }
  }
}
