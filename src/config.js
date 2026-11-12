// Global constants, palettes and presets for Neon City.

export const SEED = 20771;

// Street grid: streets repeat every 90 m; the two axes through the origin are the wide ones.
export const PITCH = 90;
export const CORE = 187;            // half-extent of the fully detailed, walkable core
export const BOUND = 190;           // player is kept inside +/- BOUND
export const SIDEWALK_H = 0.15;
export const EYE = 1.7;

// half width of the whole street corridor (road + sidewalks) for a street centred on c
export const streetHalf = (c, axis) => (c === 0 ? (axis === 'x' ? 12 : 10) : 7);
// half width of the carriageway only
export const roadHalf = (c, axis) => (c === 0 ? (axis === 'x' ? 7.5 : 6.5) : 4);

// Neon palette (linear-ish RGB, used with HDR multipliers)
export const NEON = {
  cyan: [0.05, 0.85, 1.0],
  blue: [0.1, 0.35, 1.0],
  magenta: [1.0, 0.08, 0.55],
  pink: [1.0, 0.25, 0.6],
  violet: [0.55, 0.2, 1.0],
  purple: [0.35, 0.1, 0.8],
  orange: [1.0, 0.42, 0.08],
  amber: [1.0, 0.65, 0.2],
  red: [1.0, 0.07, 0.1],
  green: [0.2, 1.0, 0.55],
  white: [0.9, 0.95, 1.0],
};
export const NEON_KEYS = ['cyan', 'magenta', 'violet', 'orange', 'blue', 'pink', 'amber', 'cyan', 'magenta', 'red', 'green', 'purple'];

export const WALLS = [
  [0.10, 0.10, 0.115], [0.07, 0.085, 0.11], [0.13, 0.085, 0.065], [0.05, 0.095, 0.10],
  [0.19, 0.185, 0.175], [0.035, 0.035, 0.045], [0.10, 0.08, 0.13], [0.075, 0.075, 0.08],
  [0.15, 0.13, 0.10], [0.06, 0.07, 0.085],
];

export const QUALITY = {
  low:    { label: 'Low',    pixelRatio: 0.75, msaa: 0, reflection: 0,    bloom: true, shadows: false, shadowSize: 1024, rain: 2500, lights: 6 },
  medium: { label: 'Medium', pixelRatio: 1.0,  msaa: 2, reflection: 0.5,  bloom: true, shadows: false, shadowSize: 1024, rain: 5000, lights: 8 },
  high:   { label: 'High',   pixelRatio: 1.25, msaa: 4, reflection: 0.6,  bloom: true, shadows: true,  shadowSize: 2048, rain: 8000, lights: 12 },
  ultra:  { label: 'Ultra',  pixelRatio: 2.0,  msaa: 4, reflection: 1.0,  bloom: true, shadows: true,  shadowSize: 4096, rain: 12000, lights: 12 },
};

// fog: base extinction per metre at street level; wet: surface wetness; rain: particle intensity
export const WEATHER = {
  clear: { label: 'Clear night', rain: 0.0, wet: 0.45, fog: 0.0016, wind: 0.3 },
  drizzle: { label: 'Light rain', rain: 0.35, wet: 0.8, fog: 0.0026, wind: 0.6 },
  storm: { label: 'Heavy rain', rain: 1.0, wet: 1.0, fog: 0.0046, wind: 1.4 },
  fog: { label: 'Dense fog', rain: 0.0, wet: 0.65, fog: 0.015, wind: 0.2 },
};
