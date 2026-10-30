// Options > Graphics: each game has its own graphics profile with the same options (pixel-art filter, outlines,
// field of view, view distance, rounded edges, grain, scan lines, CRT…); a switch at the top picks the game whose
// profile is shown — the one you are in when opened during a walk.
// The FPS counter is shared.
import { h, btn, tx } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildGraphics({ settings }) {
  // the same rows for every game's profile (sec: 'gfx' = endless, 'gfxPath' = the Great Path)
  const rowsFor = (sec) => {
    const g = () => settings.data[sec];
    const set = (k) => (v) => settings.update((d) => { d[sec][k] = v; });
    return [
      slider({ label: 'gfx.pixelH', range: RANGES.pixelH, get: () => g().pixelH, set: set('pixelH'), fmt: (v) => String(v) }),
      slider({ label: 'gfx.levels', range: RANGES.levels, get: () => g().levels, set: set('levels'), fmt: (v) => String(v) }),
      slider({ label: 'gfx.dither', range: RANGES.dither, get: () => g().dither, set: set('dither') }),
      slider({ label: 'gfx.edge', range: RANGES.edge, get: () => g().edge, set: set('edge') }),
      slider({ label: 'gfx.edgeW', range: RANGES.edgeW, get: () => g().edgeW, set: set('edgeW'), fmt: (v) => v.toFixed(1) }),
      slider({ label: 'gfx.bright', range: RANGES.bright, get: () => g().bright, set: set('bright') }),
      slider({ label: 'gfx.fov', range: RANGES.fov, get: () => g().fov, set: set('fov'), fmt: (v) => v + '°' }),
      slider({ label: 'gfx.viewDist', range: RANGES.viewDist, get: () => g().viewDist, set: set('viewDist'), fmt: (v) => String(v) }),
      slider({ label: 'gfx.round', range: RANGES.round, get: () => g().round, set: set('round'), fmt: (v) => v + ' cm' }),
      slider({ label: 'gfx.cove', range: RANGES.cove, get: () => g().cove, set: set('cove'), fmt: (v) => v + ' cm' }),
      checkbox({ label: 'gfx.bob', get: () => g().headBob, set: set('headBob') }),
      checkbox({ label: 'gfx.grain', get: () => g().grain, set: set('grain') }),
      checkbox({ label: 'gfx.scan', get: () => g().scan, set: set('scan') }),
      checkbox({ label: 'gfx.crt', get: () => g().crt, set: set('crt') }),
    ];
  };
  const endless = rowsFor('gfx');
  const path = [
    ...rowsFor('gfxPath'),
    checkbox({ label: 'story.guide', get: () => settings.data.story.guide, set: (v) => settings.update((d) => { d.story.guide = v; }) }),
    checkbox({ label: 'story.events', get: () => settings.data.story.events, set: (v) => settings.update((d) => { d.story.events = v; }) }),
  ];
  const fps = checkbox({ label: 'gfx.fps', get: () => settings.data.gfx.showFps, set: (v) => settings.update((d) => { d.gfx.showFps = v; }) });
  const all = [...endless, ...path, fps];
  settings.onChange(() => all.forEach((r) => r.refresh()));

  const boxE = h('div', {}, endless.map((r) => r.el)), boxP = h('div', {}, path.map((r) => r.el));
  let world = 'endless';
  const bE = h('button', { type: 'button', class: 'tab', on: { click: () => setWorld('endless') } }, tx('tile.endless'));
  const bP = h('button', { type: 'button', class: 'tab', on: { click: () => setWorld('path') } }, tx('tile.path'));
  function setWorld(w) {
    world = w === 'path' ? 'path' : 'endless';
    boxE.hidden = world !== 'endless'; boxP.hidden = world !== 'path';
    bE.classList.toggle('on', world === 'endless'); bP.classList.toggle('on', world === 'path');
  }
  setWorld('endless');
  const el = h('div', { class: 'tabbody' },
    h('div', { class: 'tabs worldtabs' }, tx('gfx.world', 'span'), bE, bP),
    boxE, boxP, fps.el,
    h('div', { class: 'btns' }, btn('gfx.reset', () => settings.resetSection(world === 'path' ? 'gfxPath' : 'gfx'))));
  el.onSelect = (o) => { if (o && o.world) setWorld(o.world); };
  return el;
}
