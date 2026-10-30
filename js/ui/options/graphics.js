// Options > Graphics: each world has its own graphics (pixel-art filter, field of view, view distance, head bob);
// a switch at the top picks the world whose settings are shown — the one you are in when opened during a walk.
// The FPS counter is shared.
import { h, btn, tx } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildGraphics({ settings }) {
  const rowsFor = (sec, pixRange, levRange) => {
    const g = () => settings.data[sec];
    const set = (k) => (v) => settings.update((d) => { d[sec][k] = v; });
    return [
      slider({ label: 'gfx.pixelH', range: pixRange, get: () => g().pixelH, set: set('pixelH'), fmt: (v) => String(v) }),
      slider({ label: 'gfx.levels', range: levRange, get: () => g().levels, set: set('levels'), fmt: (v) => String(v) }),
      slider({ label: 'gfx.dither', range: RANGES.dither, get: () => g().dither, set: set('dither') }),
      slider({ label: 'gfx.edge', range: RANGES.edge, get: () => g().edge, set: set('edge') }),
      slider({ label: 'gfx.edgeW', range: RANGES.edgeW, get: () => g().edgeW, set: set('edgeW'), fmt: (v) => v.toFixed(1) }),
      slider({ label: 'gfx.bright', range: RANGES.bright, get: () => g().bright, set: set('bright') }),
      slider({ label: 'gfx.fov', range: RANGES.fov, get: () => g().fov, set: set('fov'), fmt: (v) => v + '°' }),
      slider({ label: 'gfx.viewDist', range: RANGES.viewDist, get: () => g().viewDist, set: set('viewDist'), fmt: (v) => String(v) }),
      checkbox({ label: 'gfx.bob', get: () => g().headBob, set: set('headBob') }),
    ];
  };
  const endless = rowsFor('gfx', RANGES.pixelH, RANGES.levels);
  const path = [
    ...rowsFor('gfxPath', RANGES.pixelHPath, RANGES.levelsPath),
    checkbox({ label: 'gfx.grain', get: () => settings.data.gfxPath.grain, set: (v) => settings.update((d) => { d.gfxPath.grain = v; }) }),
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
