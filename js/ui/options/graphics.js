// Options > Graphics: each game has its own graphics profile with the same options (pixel-art filter, outlines,
// field of view, view distance, rounded edges, grain, scan lines, CRT…); a switch at the top picks the game whose
// profile is shown — the one you are in when opened during a walk.
// The FPS counter is shared.
import { h, btn, tx } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildGraphics({ settings }) {
  // the same rows for every game's profile (sec: 'gfx' = endless, 'gfxPath' = the Great Path)
  const rowsFor = (sec, rounding = true) => {
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
      ...(rounding ? [
        slider({ label: 'gfx.round', range: RANGES.round, get: () => g().round, set: set('round'), fmt: (v) => v + ' cm' }),
        slider({ label: 'gfx.cove', range: RANGES.cove, get: () => g().cove, set: set('cove'), fmt: (v) => v + ' cm' })] : []),
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
  const tumi = rowsFor('gfxTumi', false);            // the caves are round by nature: no rounding sliders
  const fps = checkbox({ label: 'gfx.fps', get: () => settings.data.gfx.showFps, set: (v) => settings.update((d) => { d.gfx.showFps = v; }) });
  const all = [...endless, ...path, ...tumi, fps];
  settings.onChange(() => all.forEach((r) => r.refresh()));

  // one box of rows and one tab per game; SEC: the settings section of each
  const SEC = { endless: 'gfx', path: 'gfxPath', tumi: 'gfxTumi' };
  const boxes = { endless: h('div', {}, endless.map((r) => r.el)), path: h('div', {}, path.map((r) => r.el)), tumi: h('div', {}, tumi.map((r) => r.el)) };
  const tabs = {};
  for (const w of Object.keys(SEC)) tabs[w] = h('button', { type: 'button', class: 'tab', on: { click: () => setWorld(w) } }, tx('tile.' + w));
  let world = 'endless';
  function setWorld(w) {
    world = SEC[w] ? w : 'endless';
    for (const k of Object.keys(SEC)) { boxes[k].hidden = k !== world; tabs[k].classList.toggle('on', k === world); }
  }
  setWorld('endless');
  const el = h('div', { class: 'tabbody' },
    h('div', { class: 'tabs worldtabs' }, tx('gfx.world', 'span'), ...Object.values(tabs)),
    ...Object.values(boxes), fps.el,
    h('div', { class: 'btns' }, btn('gfx.reset', () => settings.resetSection(SEC[world]))));
  el.onSelect = (o) => { if (o && o.world) setWorld(o.world); };
  return el;
}
