// User settings (graphics, keys, mouse, audio, language, multiplayer), persisted locally and always sanitised.
import { read, write, KEYS } from './storage.js';
import { clamp } from './util.js';
import { sanitizeKeys } from '../input/bindings.js';

export const DEFAULTS = {
  lang: 'en',
  gfx: { pixelH: 200, levels: 7, dither: 0.8, edge: 0.6, bright: 1.15, fov: 60, viewDist: 2, headBob: true, showFps: false, fine: true, grain: true },
  mouse: { sens: 1, invertY: false },
  audio: { volume: 0.6, hum: true, scratch: true },
  hud: { show: true },
  story: { guide: true, events: true },
  net: { name: '', stun: false },
};
// numeric ranges used by both the sanitiser and the option sliders
export const RANGES = {
  pixelH: [100, 400, 10], levels: [3, 16, 1], dither: [0, 1, 0.05], edge: [0, 1, 0.05], bright: [0.5, 3, 0.05], fov: [50, 110, 1],
  viewDist: [1, 3, 1], sens: [0.2, 3, 0.1], volume: [0, 1, 0.05],
};
const num = (v, key, d) => { const [lo, hi] = RANGES[key]; v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };

// Player names: letters, digits, spaces, - and _ only, at most 16 characters.
export const cleanName = (s) => (typeof s === 'string' ? s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) : '');

// Settings format version. v2 (0.6.0): the default field of view went from 75° to 60°; an old save that still
// has the old default is moved to the new one (a value the player chose stays).
export const SETTINGS_VERSION = 2;

export function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (!(r.v >= 2) && r.gfx && +r.gfx.fov === 75) r.gfx = { ...r.gfx, fov: DEFAULTS.gfx.fov };
  const g = r.gfx || {}, m = r.mouse || {}, a = r.audio || {}, u = r.hud || {}, n = r.net || {}, D = DEFAULTS;
  return {
    v: SETTINGS_VERSION,
    lang: r.lang === 'pl' ? 'pl' : 'en',
    gfx: {
      pixelH: Math.round(num(g.pixelH, 'pixelH', D.gfx.pixelH) / 10) * 10, levels: Math.round(num(g.levels, 'levels', D.gfx.levels)),
      dither: num(g.dither, 'dither', D.gfx.dither), edge: num(g.edge, 'edge', D.gfx.edge), bright: num(g.bright, 'bright', D.gfx.bright),
      fov: Math.round(num(g.fov, 'fov', D.gfx.fov)), viewDist: Math.round(num(g.viewDist, 'viewDist', D.gfx.viewDist)),
      headBob: g.headBob !== false, showFps: g.showFps === true, fine: g.fine !== false, grain: g.grain !== false,
    },
    mouse: { sens: num(m.sens, 'sens', 1), invertY: m.invertY === true },
    audio: { volume: num(a.volume, 'volume', D.audio.volume), hum: a.hum !== false, scratch: a.scratch !== false },
    hud: { show: u.show !== false },
    story: { guide: !(r.story && r.story.guide === false), events: !(r.story && r.story.events === false) },
    net: { name: cleanName(n.name), stun: n.stun === true },
    keys: sanitizeKeys(r.keys),
  };
}

export function createSettings() {
  let data = sanitize(read(KEYS.settings));
  const subs = new Set();
  const api = {
    get data() { return data; },
    // Mutates a draft, validates the result, saves and notifies listeners.
    update(fn) {
      const draft = structuredClone(data);
      fn(draft);
      data = sanitize(draft);
      write(KEYS.settings, data);
      subs.forEach((f) => f(data));
    },
    // Restores one section ('gfx' | 'mouse' | 'audio' | 'keys') to defaults.
    resetSection(name) {
      api.update((d) => { d[name] = name === 'keys' ? undefined : structuredClone(DEFAULTS[name]); });
    },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}
