// Options > Graphics: pixel-art filter parameters, field of view, view distance, head bob and the FPS counter.
import { h, btn } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildGraphics({ settings }) {
  const g = () => settings.data.gfx;
  const set = (k) => (v) => settings.update((d) => { d.gfx[k] = v; });
  const rows = [
    slider({ label: 'gfx.pixelH', range: RANGES.pixelH, get: () => g().pixelH, set: set('pixelH'), fmt: (v) => String(v) }),
    slider({ label: 'gfx.levels', range: RANGES.levels, get: () => g().levels, set: set('levels'), fmt: (v) => String(v) }),
    slider({ label: 'gfx.dither', range: RANGES.dither, get: () => g().dither, set: set('dither') }),
    slider({ label: 'gfx.edge', range: RANGES.edge, get: () => g().edge, set: set('edge') }),
    slider({ label: 'gfx.bright', range: RANGES.bright, get: () => g().bright, set: set('bright') }),
    slider({ label: 'gfx.fov', range: RANGES.fov, get: () => g().fov, set: set('fov'), fmt: (v) => v + '°' }),
    slider({ label: 'gfx.viewDist', range: RANGES.viewDist, get: () => g().viewDist, set: set('viewDist'), fmt: (v) => String(v) }),
    checkbox({ label: 'gfx.bob', get: () => g().headBob, set: set('headBob') }),
    checkbox({ label: 'gfx.fps', get: () => g().showFps, set: set('showFps') }),
  ];
  settings.onChange(() => rows.forEach((r) => r.refresh()));
  return h('div', { class: 'tabbody' }, rows.map((r) => r.el), h('div', { class: 'btns' }, btn('gfx.reset', () => settings.resetSection('gfx'))));
}
