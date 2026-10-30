// User settings (graphics, keys, mouse, audio, language, multiplayer), persisted locally and always sanitised.
import { read, write, KEYS } from './storage.js';
import { clamp } from './util.js';
import { sanitizeKeys } from '../input/bindings.js';

export const DEFAULTS = {
  lang: 'en',
  // graphics profiles, one per game, with the same options: the endless world (the pixel-art look) and the Great Path
  // world (fine-grained). showFps lives in gfx and is shared.
  gfx: { pixelH: 200, levels: 7, dither: 0.8, edge: 0.6, edgeW: 1, bright: 1.15, fov: 60, viewDist: 2, headBob: true, grain: false, round: 12, cove: 8, showFps: false, scan: false, crt: false },
  // the caves of Tumithak (dark: lit by the lamps of the cities and your flashlight)
  gfxTumi: { pixelH: 540, levels: 40, dither: 0.25, edge: 0.3, edgeW: 1, bright: 1.15, fov: 60, viewDist: 2, headBob: true, grain: true, round: 12, cove: 8, scan: false, crt: false },
  gfxPath: { pixelH: 720, levels: 40, dither: 0.25, edge: 0.3, edgeW: 1, bright: 1.15, fov: 60, viewDist: 2, headBob: true, grain: true, round: 12, cove: 8, scan: false, crt: false },
  mouse: { sens: 1, invertY: false },
  audio: { volume: 0.6, steps: 0.5, hum: true, scratch: true },
  hud: { show: true },
  story: { guide: true, events: true },
  net: { name: '', stun: false },
};
// numeric ranges used by both the sanitiser and the option sliders
export const RANGES = {
  pixelH: [100, 720, 10], levels: [3, 64, 1], dither: [0, 1, 0.05], edge: [0, 1, 0.05], edgeW: [0, 2, 0.1], round: [0, 24, 1], cove: [0, 20, 1], bright: [0.5, 3, 0.05], fov: [50, 110, 1],
  viewDist: [1, 3, 1], sens: [0.2, 3, 0.1], volume: [0, 1, 0.05], steps: [0, 1, 0.05],
};
const num = (v, key, d) => { const [lo, hi] = RANGES[key]; v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };

// Player names: letters, digits, spaces, - and _ only, at most 16 characters.
export const cleanName = (s) => (typeof s === 'string' ? s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) : '');

// Settings format version. v2 (0.6.0): the default field of view went from 75° to 60°; an old save that still
// has the old default is moved to the new one (a value the player chose stays).
// v3 (0.14.0): each world has its own graphics (gfx: endless, gfxPath: the Great Path). An older save keeps its
// field of view, brightness and head bob for both; "detailed rendering" off becomes the pixel-art values for the path.
// v4 (0.18.0): both worlds run on one engine, so both profiles have the same options (the endless world gains film
// grain, off, and the rounded edges, 12 / 8 cm) and the same ranges; nothing saved changes meaning.
export const SETTINGS_VERSION = 4;

export function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (!(r.v >= 2) && r.gfx && +r.gfx.fov === 75) r.gfx = { ...r.gfx, fov: DEFAULTS.gfx.fov };
  if (!(r.v >= 3) && r.gfx && !r.gfxPath) {
    const o = r.gfx, retro = o.fine === false;
    r.gfxPath = { ...DEFAULTS.gfxPath, fov: o.fov, bright: o.bright, headBob: o.headBob, grain: o.grain !== false,
      ...(retro ? { pixelH: o.pixelH, levels: o.levels, dither: o.dither, edge: o.edge } : {}) };
  }
  const g = r.gfx || {}, gp = r.gfxPath || {}, m = r.mouse || {}, a = r.audio || {}, u = r.hud || {}, n = r.net || {}, D = DEFAULTS;
  // one graphics profile (the same fields for every game; D0: that game's defaults)
  const profile = (o, D0) => ({
    pixelH: Math.round(num(o.pixelH, 'pixelH', D0.pixelH) / 10) * 10, levels: Math.round(num(o.levels, 'levels', D0.levels)),
    dither: num(o.dither, 'dither', D0.dither), edge: num(o.edge, 'edge', D0.edge), edgeW: Math.round(num(o.edgeW, 'edgeW', D0.edgeW) * 10) / 10, bright: num(o.bright, 'bright', D0.bright),
    fov: Math.round(num(o.fov, 'fov', D0.fov)), viewDist: Math.round(num(o.viewDist, 'viewDist', D0.viewDist)),
    headBob: o.headBob !== false, grain: typeof o.grain === 'boolean' ? o.grain : D0.grain, scan: o.scan === true, crt: o.crt === true,
    round: Math.round(num(o.round, 'round', D0.round)), cove: Math.round(num(o.cove, 'cove', D0.cove)),
  });
  return {
    v: SETTINGS_VERSION,
    lang: r.lang === 'pl' ? 'pl' : 'en',
    gfx: { ...profile(g, D.gfx), showFps: g.showFps === true },
    gfxPath: profile(gp, D.gfxPath),
    gfxTumi: profile(r.gfxTumi || {}, D.gfxTumi),
    mouse: { sens: num(m.sens, 'sens', 1), invertY: m.invertY === true },
    audio: { volume: num(a.volume, 'volume', D.audio.volume), steps: num(a.steps, 'steps', D.audio.steps), hum: a.hum !== false, scratch: a.scratch !== false },
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
