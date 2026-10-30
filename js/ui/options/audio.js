// Options > Audio: master volume, footstep volume and the fluorescent hum.
import { h, btn } from '../dom.js';
import { RANGES } from '../../core/settings.js';
import { slider, checkbox } from './widgets.js';

export function buildAudio({ settings }) {
  const a = () => settings.data.audio;
  const set = (k) => (v) => settings.update((d) => { d.audio[k] = v; });
  const rows = [
    slider({ label: 'audio.volume', range: RANGES.volume, get: () => a().volume, set: set('volume'), fmt: (v) => Math.round(v * 100) + '%' }),
    slider({ label: 'audio.steps', range: RANGES.steps, get: () => a().steps, set: set('steps'), fmt: (v) => Math.round(v * 100) + '%' }),
    checkbox({ label: 'audio.hum', get: () => a().hum, set: set('hum') }),
    checkbox({ label: 'audio.scratch', get: () => a().scratch, set: set('scratch') }),
  ];
  settings.onChange(() => rows.forEach((r) => r.refresh()));
  return h('div', { class: 'tabbody' }, rows.map((r) => r.el), h('div', { class: 'btns' }, btn('audio.reset', () => settings.resetSection('audio'))));
}
