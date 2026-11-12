import { QUALITY, WEATHER } from '../config.js';

// Minimal interface: loading bar, start screen, and a pause panel with weather / graphics /
// sensitivity / FOV / volume. Settings persist in localStorage.

const $ = (id) => document.getElementById(id);
const KEY = 'neon-city-settings-v1';

export class UI {
  constructor(defaults) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* ignore */ }
    this.s = { ...defaults, ...saved }; this.hasSavedQuality = !!saved.qualityChosen;
    if (!QUALITY[this.s.quality]) this.s.quality = defaults.quality;
    if (!WEATHER[this.s.weather]) this.s.weather = defaults.weather;
    this.onChange = () => {}; this.onEnter = () => {};
    const seg = (el, table, key) => {
      for (const k of Object.keys(table)) {
        const b = document.createElement('button'); b.textContent = table[k].label; b.dataset.k = k;
        b.onclick = () => this.set(key, k); el.appendChild(b);
      }
    };
    seg($('weather'), WEATHER, 'weather'); seg($('quality'), QUALITY, 'quality');
    for (const [id, key] of [['sens', 'sens'], ['fov', 'fov'], ['vol', 'volume']]) { $(id).value = this.s[key]; $(id).oninput = (e) => this.set(key, parseFloat(e.target.value)); }
    $('enter').onclick = () => this.onEnter(); $('resume').onclick = () => this.onEnter();
    this.sync();
  }
  set(key, v, user = true) { this.s[key] = v; if (key === 'quality' && user) this.s.qualityChosen = true; try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { /* ignore */ } this.sync(); this.onChange(key, v, user); }
  sync() {
    for (const [id, key] of [['weather', 'weather'], ['quality', 'quality']]) for (const b of $(id).children) b.classList.toggle('on', b.dataset.k === this.s[key]);
  }
  progress(p, text) { $('bar').style.width = `${Math.round(p * 100)}%`; if (text) $('status').textContent = text; }
  show(name) { for (const id of ['loading', 'start', 'pause']) $(id).classList.toggle('hidden', id !== name); }
  prompt(text) { const p = $('prompt'); if (text) { p.textContent = `E — ${text}`; p.classList.add('on'); } else p.classList.remove('on'); }
  fade(on) { $('fade').style.opacity = on ? 1 : 0; }
  hint() { const h = $('hint'); h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 7000); }
}
