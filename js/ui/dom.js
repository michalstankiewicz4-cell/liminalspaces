// Minimal DOM helpers (no innerHTML anywhere: the CSP-friendly, injection-safe way to build UI).
import { bind } from '../i18n/index.js';

// h('div', { class: 'x', on: { click: fn }, hidden: true }, child, 'text', [more])
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'hidden') el.hidden = !!v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (Array.isArray(c)) c.forEach(add);
    else if (c !== undefined && c !== null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
export const $ = (id) => document.getElementById(id);

// Element whose text follows the current language.
export const tx = (key, tag = 'span', params) => bind(h(tag), key, undefined, params);
// Button with translated text. Releases focus after a click so Space/Enter never re-trigger it during play.
export function btn(key, onClick, cls = '') {
  const b = h('button', { type: 'button', class: cls });
  bind(b, key);
  b.addEventListener('click', (e) => { onClick(e); b.blur(); });
  return b;
}
