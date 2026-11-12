import * as THREE from 'three';
import { RNG } from '../rng.js';

// Procedurally paints every advertisement, neon sign and screen in the city into a single
// 4096x4096 atlas (8x8 cells). All brands are fictional.

const CELL = 512, GRID = 8;
const F_DISPLAY = 'Orbitron', F_TEXT = 'Rajdhani', F_JP = '"Noto Sans JP"';

const PALS = [
  ['#05010f', '#3a0058', '#ff2bd6', '#ffffff'], ['#00121c', '#00455e', '#19e6ff', '#eaffff'],
  ['#120300', '#6a1c00', '#ff7a18', '#fff3df'], ['#0a0020', '#2a0f7a', '#8f5bff', '#f2eaff'],
  ['#14000a', '#70002e', '#ff2d55', '#ffe9ef'], ['#001410', '#005c45', '#2affb0', '#eafff6'],
  ['#02030d', '#0d1d6b', '#3d7bff', '#e8f0ff'], ['#110a00', '#5e4300', '#ffc21f', '#fff8e0'],
  ['#0d0010', '#4a0a55', '#ff5ac8', '#19e6ff'], ['#000a14', '#083a5a', '#ff7a18', '#19e6ff'],
];

const BRANDS = [
  ['OMNI-HELIX', 'ENGINEERING TOMORROW', '螺旋'], ['VANTA COLA', 'TASTE THE VOID', 'ヴァンタ'], ['SYNAPTIQ', 'THINK FASTER', '神経'],
  ['KUROSHIO', 'HEAVY INDUSTRIES', '黒潮重工'], ['ORBIT//9', 'LOW ORBIT LIVING', '軌道'], ['HALCYON', 'DREAMS ON DEMAND', '夢'],
  ['MERIDIAN', 'PRIVATE BANKING', '銀行'], ['ZENITH', 'AIRBORNE BY DESIGN', '天頂'], ['NOVA NOODLE', 'HOT IN 9 SECONDS', 'ラーメン'],
  ['AURA', 'SYNTHETIC SKIN', '肌'], ['BLISS', 'FEEL EVERYTHING', '至福'], ['DEEPFIELD', 'CAPITAL MARKETS', '資本'],
  ['KITSUNE', 'PREMIUM SAKE', '狐'], ['HOSHI HOTEL', 'SLEEP ABOVE THE CLOUDS', '星'], ['PULSE', 'ENERGY // 400MG', 'パルス'],
  ['CHROMA', 'OPTICS FOR A NEW YOU', '色彩'], ['MIRAI RAIL', 'THE CITY IN MOTION', '未来'], ['GHOSTLINE', 'ENCRYPTED LIFE', '幽霊'],
  ['LOTUS', 'SPA & LONGEVITY', '蓮'], ['RAVENWATCH', 'SECURITY SYSTEMS', '警備'], ['OKAMI', 'CYBERNETICS', '義体'],
  ['NEON TIDE', 'LIVE TONIGHT', '音楽'], ['TESSERA', 'FLOOR 300 AND ABOVE', '住宅'], ['AXIOM', 'PHARMACEUTICALS', '製薬'],
  ['SHINSEKAI', 'A NEW WORLD AWAITS', '新世界'], ['KAIJU BREW', 'MONSTROUSLY COLD', '怪獣'], ['VOLT//AGE', 'CHARGE EVERYTHING', '電力'],
  ['ECHO', 'SHE REMEMBERS', '記憶'], ['SOLACE', 'INSURE YOUR FUTURE SELF', '保険'], ['HEX ARCADE', 'PLAY FOREVER', '電脳'],
  ['IRIS', 'SEE WHAT OTHERS CANNOT', '瞳'], ['NIMBUS', 'CLOUD CITY ESTATES', '雲'], ['TOKAI', 'SYNTH WHISKY', '酒'],
  ['PARALLAX', 'IMMERSIVE CINEMA', '映画'], ['VERTEX', 'ORBITAL FREIGHT', '宇宙'], ['MOCHA//7', 'CAFFEINE ARCHITECTS', '珈琲'],
  ['SABLE', 'NIGHTWEAR', '夜'], ['HYDRA', 'PURE WATER CO.', '水'], ['ONYX', 'MEMORY VAULTS', '金庫'], ['LUMEN', 'DAYLIGHT, DELIVERED', '光'],
];
const TEMPLATES = ['word', 'product', 'eye', 'kanji', 'word', 'rings', 'data', 'word', 'kanji', 'product', 'word', 'data', 'kanji', 'rings', 'product', 'eye'];
const ASPECTS = [0.4, 1.8, 0.7, 0.4, 3.2, 1.0, 1.8, 0.7, 0.4, 1.8, 1.0, 3.2, 0.7, 1.8, 0.4, 1.0, 1.8, 0.4, 0.7, 3.2];

const NEON_SIGNS = [
  ['ラーメン', '#ff2bd6', 1], ['BAR', '#19e6ff', 0], ['居酒屋', '#ff7a18', 1], ['HOTEL', '#ff5ac8', 0],
  ['薬局', '#2affb0', 1], ['OPEN 24H', '#19e6ff', 0], ['寿司', '#ff2d55', 1], ['カラオケ', '#a06bff', 1],
  ['NOODLES', '#ffc21f', 0], ['質屋', '#ffc21f', 1], ['CLUB VOID', '#ff2bd6', 0], ['電脳', '#19e6ff', 1],
  ['TATTOO', '#ff2d55', 0], ['麺', '#ff7a18', 1], ['CAFÉ', '#ff5ac8', 0], ['ARCADE', '#a06bff', 0],
];

function fit(ctx, text, font, weight, maxW, maxSize) {
  let s = maxSize;
  for (;;) {
    ctx.font = `${weight} ${s}px ${font}`;
    if (ctx.measureText(text).width <= maxW || s < 10) return s;
    s *= 0.94;
  }
}
function glowText(ctx, text, x, y, color, blur, passes = 2) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.fillStyle = color;
  for (let i = 0; i < passes; i++) ctx.fillText(text, x, y);
  ctx.restore();
}
function vtext(ctx, chars, x, y0, step, draw) { [...chars].forEach((ch, i) => draw(ch, x, y0 + i * step)); }

function drawAd(ctx, W, H, brand, tpl, pal, rng) {
  const [name, tag, jp] = brand; const [c1, c2, acc, fg] = pal;
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const m = Math.min(W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // background tech grid
  ctx.globalAlpha = 0.12; ctx.strokeStyle = acc; ctx.lineWidth = 2;
  const gs = m / 8;
  for (let x = gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  const tall = H > W * 1.3, wide = W > H * 1.3;
  const cx = W / 2;

  if (tpl === 'rings' || tpl === 'word') {
    const rx = wide ? W * 0.2 : cx, ry = tall ? H * 0.3 : H * (wide ? 0.5 : 0.36), R = m * (tpl === 'rings' ? 0.36 : 0.3);
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.9 - i * 0.16; ctx.strokeStyle = i % 2 ? fg : acc; ctx.lineWidth = m * 0.012 * (5 - i);
      ctx.beginPath(); ctx.arc(rx, ry, R * (1 - i * 0.17), rng.range(0, 6), rng.range(3.5, 9)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, R * 0.5);
    rg.addColorStop(0, acc); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(rx - R, ry - R, R * 2, R * 2);
  }
  if (tpl === 'eye') {
    const ex = wide ? W * 0.22 : cx, ey = tall ? H * 0.3 : H * (wide ? 0.5 : 0.36), R = m * 0.3;
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2, r0 = R * 0.34, r1 = R * rng.range(0.7, 1);
      ctx.strokeStyle = i % 3 ? acc : fg; ctx.globalAlpha = rng.range(0.3, 1); ctx.lineWidth = m * 0.006;
      ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0); ctx.lineTo(ex + Math.cos(a) * r1, ey + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, R * 0.32, 0, 7); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(ex + R * 0.1, ey - R * 0.1, R * 0.07, 0, 7); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = m * 0.01; ctx.beginPath(); ctx.arc(ex, ey, R * 1.08, 0, 7); ctx.stroke();
  }
  if (tpl === 'product') {
    const px = wide ? W * 0.2 : cx, py = tall ? H * 0.32 : H * (wide ? 0.5 : 0.38), s = m * 0.4;
    const kind = rng.int(0, 2);
    ctx.save(); ctx.translate(px, py); ctx.rotate(rng.range(-0.25, 0.25));
    const pg = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
    pg.addColorStop(0, acc); pg.addColorStop(0.45, fg); pg.addColorStop(0.55, acc); pg.addColorStop(1, c1);
    ctx.fillStyle = pg; ctx.shadowColor = acc; ctx.shadowBlur = m * 0.12;
    ctx.beginPath();
    if (kind === 0) ctx.roundRect(-s * 0.26, -s * 0.5, s * 0.52, s, s * 0.08);                       // can
    else if (kind === 1) { ctx.roundRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.72, s * 0.08); ctx.roundRect(-s * 0.08, -s * 0.52, s * 0.16, s * 0.36, s * 0.03); } // bottle
    else ctx.roundRect(-s * 0.5, -s * 0.2, s, s * 0.4, s * 0.2);                                       // capsule
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = c1; ctx.globalAlpha = 0.75;
    if (kind === 2) ctx.fillRect(0, -s * 0.2, s * 0.5, s * 0.4); else ctx.fillRect(-s * 0.26, -s * 0.08, s * 0.52, s * 0.2);
    ctx.restore();
  }
  if (tpl === 'data') {
    const n = 22, bw = W / (n + 2);
    let v = 0.3;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      v = Math.min(0.9, Math.max(0.1, v + rng.range(-0.12, 0.17)));
      const x = bw * (i + 1), y = H * (0.62 - v * 0.42);
      ctx.fillStyle = acc; ctx.globalAlpha = 0.35; ctx.fillRect(x - bw * 0.3, y, bw * 0.6, H * 0.64 - y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = fg; ctx.lineWidth = m * 0.014; ctx.shadowColor = acc; ctx.shadowBlur = m * 0.05; ctx.stroke(); ctx.shadowBlur = 0;
    const s = fit(ctx, '+00.0%', F_DISPLAY, 900, W * 0.5, m * 0.16);
    ctx.font = `900 ${s}px ${F_DISPLAY}`; ctx.textAlign = 'left';
    glowText(ctx, `+${rng.range(2, 38).toFixed(1)}%`, W * 0.06, H * 0.14, acc, m * 0.04);
    ctx.textAlign = 'center';
  }
  if (tpl === 'kanji') {
    const chars = [...jp];
    if (tall) {
      const s = Math.min(W * 0.62, (H * 0.62) / chars.length);
      ctx.font = `900 ${s}px ${F_JP}`;
      vtext(ctx, jp, cx, H * 0.08 + s * 0.6, s * 1.05, (ch, x, y) => { glowText(ctx, ch, x, y, acc, s * 0.25, 2); ctx.fillStyle = fg; ctx.fillText(ch, x, y); });
    } else {
      const s = fit(ctx, jp, F_JP, 900, W * (wide ? 0.42 : 0.8), H * 0.5);
      ctx.font = `900 ${s}px ${F_JP}`;
      const x = wide ? W * 0.26 : cx, y = wide ? H * 0.5 : H * 0.36;
      glowText(ctx, jp, x, y, acc, s * 0.25, 2); ctx.fillStyle = fg; ctx.fillText(jp, x, y);
    }
  }
  // wordmark + tagline
  const tx = wide ? W * 0.64 : cx, tw = wide ? W * 0.62 : W * 0.86;
  const ty = wide ? H * 0.42 : tall ? H * 0.74 : H * 0.72;
  if (tall && name.length > 6) {
    // stack the name vertically on tall formats
    const letters = name.replace(/[^A-Z0-9]/g, '');
    const s = Math.min(W * 0.34, (H * 0.34) / letters.length * 1.0);
    ctx.font = `900 ${s}px ${F_DISPLAY}`;
    if (tpl !== 'kanji') vtext(ctx, letters, cx, H * 0.58, s * 1.02, (ch, x, y) => { glowText(ctx, ch, x, y, acc, s * 0.3, 1); ctx.fillStyle = fg; ctx.fillText(ch, x, y); });
    else { const s2 = fit(ctx, name, F_DISPLAY, 900, W * 0.86, H * 0.08); ctx.font = `900 ${s2}px ${F_DISPLAY}`; ctx.fillStyle = fg; ctx.fillText(name, cx, H * 0.84); }
  } else {
    const s = fit(ctx, name, F_DISPLAY, 900, tw, m * (wide ? 0.34 : 0.2));
    ctx.font = `900 ${s}px ${F_DISPLAY}`;
    glowText(ctx, name, tx, ty, acc, s * 0.35, 2); ctx.fillStyle = fg; ctx.fillText(name, tx, ty);
    const s2 = fit(ctx, tag, F_TEXT, 600, tw * 0.9, s * 0.42);
    ctx.font = `600 ${s2}px ${F_TEXT}`; ctx.fillStyle = acc; ctx.fillText(tag, tx, ty + s * 0.82);
    if (!wide && tpl !== 'kanji') { ctx.font = `700 ${s * 0.5}px ${F_JP}`; ctx.fillStyle = fg; ctx.globalAlpha = 0.8; ctx.fillText(jp, tx, ty + s * 1.6); ctx.globalAlpha = 1; }
  }
  // frame + corner marks
  ctx.strokeStyle = acc; ctx.lineWidth = m * 0.012; ctx.strokeRect(m * 0.03, m * 0.03, W - m * 0.06, H - m * 0.06);
  ctx.fillStyle = acc; ctx.fillRect(m * 0.03, H - m * 0.075, W * 0.3, m * 0.02);
  ctx.font = `700 ${m * 0.035}px ${F_TEXT}`; ctx.textAlign = 'left'; ctx.fillStyle = fg; ctx.globalAlpha = 0.7;
  ctx.fillText(`//${(rng.int(100, 999))}-${name.slice(0, 3)}`, m * 0.06, m * 0.075); ctx.globalAlpha = 1;
}

function drawNeon(ctx, W, H, text, color, vertical) {
  ctx.fillStyle = '#020203'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const m = Math.min(W, H);
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = m * 0.12; ctx.lineWidth = m * 0.035;
  ctx.beginPath(); ctx.roundRect(m * 0.08, m * 0.08, W - m * 0.16, H - m * 0.16, m * 0.1); ctx.stroke(); ctx.stroke();
  const paint = (ch, x, y, s) => {
    ctx.shadowBlur = s * 0.35; ctx.fillStyle = color; ctx.fillText(ch, x, y); ctx.fillText(ch, x, y);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(ch, x, y);
  };
  if (vertical) {
    const chars = [...text], s = Math.min(W * 0.62, (H * 0.8) / chars.length);
    ctx.font = `900 ${s}px ${F_JP}`;
    chars.forEach((ch, i) => paint(ch, W / 2, H / 2 + (i - (chars.length - 1) / 2) * s * 1.08, s));
  } else {
    const s = fit(ctx, text, F_DISPLAY, 900, W * 0.78, H * 0.55);
    ctx.font = `900 ${s}px ${F_DISPLAY}`; paint(text, W / 2, H / 2, s);
  }
}

const MISC = [
  { key: 'ticker', a: 8, draw(ctx, W, H) {
    ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `700 ${H * 0.52}px ${F_DISPLAY}`;
    const t = 'MIRAI RAIL LINE 7 +4 MIN  ///  AIR QUALITY 212 POOR  ///  DEEPFIELD ▲ 12.4  ///  ';
    glowText(ctx, t, H * 0.2, H / 2, '#ffb020', H * 0.1, 2);
  } },
  { key: 'ticker', a: 8, draw(ctx, W, H) {
    ctx.fillStyle = '#060208'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `700 ${H * 0.5}px ${F_JP}`;
    glowText(ctx, '新世界へようこそ  ///  WELCOME TO HALCYON DISTRICT  ///  雨 100%  ///  ', H * 0.2, H / 2, '#19e6ff', H * 0.1, 2);
  } },
  { key: 'vend', a: 0.5, draw(ctx, W, H, rng) { drawVend(ctx, W, H, rng, '#19e6ff', 'VANTA') ; } },
  { key: 'vend', a: 0.5, draw(ctx, W, H, rng) { drawVend(ctx, W, H, rng, '#ff2bd6', 'PULSE'); } },
  { key: 'metro', a: 4, draw(ctx, W, H) {
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = '#19e6ff'; ctx.shadowColor = '#19e6ff'; ctx.shadowBlur = H * 0.15;
    ctx.beginPath(); ctx.arc(H * 0.5, H * 0.5, H * 0.36, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#02040a'; ctx.font = `900 ${H * 0.46}px ${F_DISPLAY}`; ctx.fillText('M', H * 0.5, H * 0.53);
    ctx.textAlign = 'left'; ctx.font = `900 ${H * 0.34}px ${F_DISPLAY}`; glowText(ctx, 'METRO', H * 1.05, H * 0.33, '#eaffff', H * 0.06, 1);
    ctx.font = `700 ${H * 0.26}px ${F_JP}`; glowText(ctx, '地下鉄 · HALCYON AVE', H * 1.05, H * 0.72, '#19e6ff', H * 0.06, 1);
  } },
  { key: 'lift', a: 3, draw(ctx, W, H) {
    ctx.fillStyle = '#080206'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = `900 ${H * 0.4}px ${F_DISPLAY}`; glowText(ctx, '▲ SKY DECK', W / 2, H * 0.36, '#ff5ac8', H * 0.1, 2);
    ctx.font = `700 ${H * 0.22}px ${F_TEXT}`; glowText(ctx, 'HOSHI HOTEL · LIFT TO FLOOR 48', W / 2, H * 0.76, '#ffe9ef', H * 0.05, 1);
  } },
  { key: 'emblem', a: 1, draw(ctx, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const c = W / 2;
    ctx.shadowColor = '#19e6ff'; ctx.shadowBlur = 30;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 ? '#ff2bd6' : '#19e6ff'; ctx.lineWidth = 10 - i;
      ctx.beginPath(); ctx.arc(c, c, W * (0.44 - i * 0.055), i * 0.9, i * 0.9 + 4.6); ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const r = W * 0.13; ctx[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); }
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 8; ctx.stroke();
  } },
  { key: 'dir', a: 3, draw(ctx, W, H) {
    ctx.fillStyle = '#03060a'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = `900 ${H * 0.34}px ${F_JP}`; glowText(ctx, '出口 EXIT →', W / 2, H * 0.36, '#2affb0', H * 0.08, 2);
    ctx.font = `700 ${H * 0.22}px ${F_TEXT}`; glowText(ctx, 'PLATFORMS 1–4 · 東口', W / 2, H * 0.76, '#eafff6', H * 0.05, 1);
  } },
];

function drawVend(ctx, W, H, rng, col, name) {
  ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fillRect(W * 0.06, H * 0.03, W * 0.88, H * 0.11); ctx.globalAlpha = 1;
  ctx.fillStyle = '#05070c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${H * 0.07}px ${F_DISPLAY}`; ctx.fillText(name, W / 2, H * 0.088);
  const cols = ['#ff2bd6', '#19e6ff', '#ffc21f', '#2affb0', '#ff7a18', '#eaffff', '#8f5bff'];
  for (let r = 0; r < 4; r++) {
    ctx.fillStyle = 'rgba(220,240,255,0.22)'; ctx.fillRect(W * 0.08, H * (0.17 + r * 0.14), W * 0.84, H * 0.125);
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = rng.pick(cols); ctx.beginPath();
      ctx.roundRect(W * (0.11 + c * 0.135), H * (0.185 + r * 0.14), W * 0.085, H * 0.095, W * 0.02); ctx.fill();
    }
  }
  ctx.fillStyle = col; ctx.fillRect(W * 0.62, H * 0.76, W * 0.28, H * 0.08);
  ctx.fillStyle = '#10141c'; ctx.fillRect(W * 0.1, H * 0.86, W * 0.8, H * 0.09);
}

export async function buildAtlas(maxAniso = 8) {
  // make sure web fonts are available to the 2D canvas before painting
  const jpAll = BRANDS.map((b) => b[2]).join('') + NEON_SIGNS.map((n) => n[0]).join('') + '新世界へようこそ雨地下鉄出口東口';
  try {
    await Promise.all([
      document.fonts.load(`900 64px ${F_DISPLAY}`, 'ABC'), document.fonts.load(`700 64px ${F_DISPLAY}`, 'ABC'),
      document.fonts.load(`600 64px ${F_TEXT}`, 'ABC'), document.fonts.load(`700 64px ${F_TEXT}`, 'ABC'),
      document.fonts.load(`900 64px ${F_JP}`, jpAll), document.fonts.load(`700 64px ${F_JP}`, jpAll),
    ]);
  } catch (e) { /* fall back to system fonts */ }

  const cv = document.createElement('canvas'); cv.width = cv.height = CELL * GRID;
  const ctx = cv.getContext('2d');
  const rng = new RNG(9917);
  const atlas = { big: [], neon: [], ticker: [], vend: [], metro: null, lift: null, emblem: null, dir: null };
  const rect = (i) => [(i % GRID) / GRID, 1 - (Math.floor(i / GRID) + 1) / GRID, 1 / GRID, 1 / GRID];
  const cell = (i, a, fn) => {
    const W = a >= 1 ? CELL * a : CELL, H = a >= 1 ? CELL : CELL / a;
    ctx.save();
    ctx.translate((i % GRID) * CELL, Math.floor(i / GRID) * CELL);
    ctx.beginPath(); ctx.rect(0, 0, CELL, CELL); ctx.clip();
    ctx.scale(CELL / W, CELL / H);
    fn(ctx, W, H);
    ctx.restore();
  };
  let id = 0;
  for (let i = 0; i < 40; i++, id++) {
    const a = ASPECTS[i % ASPECTS.length], tpl = TEMPLATES[i % TEMPLATES.length], pal = PALS[(i * 7 + 3) % PALS.length];
    cell(id, a, (c, W, H) => drawAd(c, W, H, BRANDS[i], tpl, pal, rng));
    atlas.big.push({ rect: rect(id), a, color: pal[2] });
  }
  for (let i = 0; i < 16; i++, id++) {
    const [t, col, v] = NEON_SIGNS[i]; const a = v ? 0.32 : 2.8;
    cell(id, a, (c, W, H) => drawNeon(c, W, H, t, col, v));
    atlas.neon.push({ rect: rect(id), a, color: col });
  }
  for (const mi of MISC) {
    cell(id, mi.a, (c, W, H) => mi.draw(c, W, H, rng));
    const e = { rect: rect(id), a: mi.a };
    if (Array.isArray(atlas[mi.key])) atlas[mi.key].push(e); else atlas[mi.key] = e;
    id++;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.texture = tex;
  // pick the ad whose aspect ratio is closest to the wanted one
  atlas.pickBig = (r, aspect) => {
    const la = Math.log(aspect);
    const sorted = atlas.big.map((b) => [Math.abs(Math.log(b.a) - la) + r.next() * 0.25, b]).sort((p, q) => p[0] - q[0]);
    return sorted[0][1];
  };
  return atlas;
}
