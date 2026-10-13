// Options > Controls: click a key slot, press a key to rebind. Esc cancels, Backspace clears. Duplicates move the key.
import { h, btn, tx } from '../dom.js';
import { t, onLang } from '../../i18n/index.js';
import { ACTIONS, RESERVED, keyLabel } from '../../input/bindings.js';

export function buildControls({ settings, input }) {
  const slots = [];                       // [button, actionId, slotIndex]
  let capturing = null;                   // { btn, id, slot }

  function render() {
    for (const [b, id, i] of slots) {
      const on = capturing && capturing.btn === b;
      b.textContent = on ? t('ctl.press') : keyLabel(settings.data.keys[id][i]);
      b.classList.toggle('on', !!on);
    }
  }
  function stop() {
    if (!capturing) return;
    capturing = null; input.suspended = false;
    removeEventListener('keydown', onKey, true); removeEventListener('mousedown', onOutside, true);
    render();
  }
  function onKey(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    const { id, slot } = capturing;
    if (e.code === 'Escape') { stop(); return; }
    if (e.repeat || ['Meta', 'OS'].includes(e.key)) return;
    settings.update((d) => {
      if (e.code === 'Backspace') { d.keys[id][slot] = null; return; }
      if (RESERVED.has(e.code)) return;
      for (const a of ACTIONS) d.keys[a.id] = d.keys[a.id].map((c) => (c === e.code ? null : c));   // a key belongs to one slot only
      d.keys[id][slot] = e.code;
    });
    stop();
  }
  function onOutside(e) { if (!capturing || e.target !== capturing.btn) stop(); }

  const rows = ACTIONS.map((a) => h('div', { class: 'orow keyrow' }, tx('act.' + a.id), h('div', { class: 'keys' },
    [0, 1].map((i) => {
      const b = h('button', { type: 'button', class: 'key', on: { click: (e) => {
        stop();
        capturing = { btn: e.currentTarget, id: a.id, slot: i };
        input.suspended = true; input.clear();
        addEventListener('keydown', onKey, true); addEventListener('mousedown', onOutside, true);
        render();
        e.currentTarget.blur();
      } } });
      slots.push([b, a.id, i]);
      return b;
    }))));
  settings.onChange(render); onLang(render);
  render();
  return h('div', { class: 'tabbody' }, h('p', { class: 'note' }, tx('ctl.hint')), rows, h('p', { class: 'note' }, tx('ctl.fixed')),
    h('div', { class: 'btns' }, btn('ctl.reset', () => settings.resetSection('keys'))));
}
