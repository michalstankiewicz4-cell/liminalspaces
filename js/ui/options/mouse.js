// Options > Mouse: look sensitivity and vertical inversion.
import { h, btn } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildMouse({ settings }) {
  const m = () => settings.data.mouse;
  const set = (k) => (v) => settings.update((d) => { d.mouse[k] = v; });
  const rows = [
    slider({ label: 'mouse.sens', range: RANGES.sens, get: () => m().sens, set: set('sens'), fmt: (v) => v.toFixed(1) + '×' }),
    checkbox({ label: 'mouse.invY', get: () => m().invertY, set: set('invertY') }),
  ];
  settings.onChange(() => rows.forEach((r) => r.refresh()));
  return h('div', { class: 'tabbody' }, rows.map((r) => r.el), h('div', { class: 'btns' }, btn('mouse.reset', () => settings.resetSection('mouse'))));
}
