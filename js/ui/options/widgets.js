// Reusable option controls.
import { h, tx } from '../dom.js';

// Labelled range slider: get() returns the current value, set(v) stores it, fmt(v) formats the readout.
export function slider({ label, range, get, set, fmt = (v) => String(+v.toFixed(2)) }) {
  const [min, max, step] = range;
  const out = h('span', { class: 'val' });
  const input = h('input', { type: 'range', min, max, step });
  const refresh = () => { input.value = get(); out.textContent = fmt(+input.value); };
  input.addEventListener('input', () => { set(+input.value); out.textContent = fmt(+input.value); });
  refresh();
  return { el: h('label', { class: 'orow' }, tx(label), input, out), refresh };
}

export function checkbox({ label, get, set }) {
  const input = h('input', { type: 'checkbox' });
  const refresh = () => { input.checked = !!get(); };
  input.addEventListener('change', () => set(input.checked));
  refresh();
  return { el: h('label', { class: 'orow chk' }, input, tx(label)), refresh };
}

// Row of mutually exclusive buttons (e.g. mouse buttons, languages).
export function choice({ label, items, get, set }) {
  const row = h('div', { class: 'choices' });
  const buttons = items.map((it) => {
    const b = h('button', { type: 'button', on: { click: () => { set(it.value); refresh(); } } }, it.key ? tx(it.key) : it.text);
    row.append(b); return [it.value, b];
  });
  const refresh = () => { for (const [v, b] of buttons) b.classList.toggle('on', v === get()); };
  refresh();
  return { el: h('div', { class: 'orow col' }, label ? tx(label) : null, row), refresh };
}
