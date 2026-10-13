// Options > Privacy & data: what is stored and shared, and a progress reset.
import { h, tx } from '../dom.js';
import { bind } from '../../i18n/index.js';

export function buildPrivacy({ progress }) {
  // Two-step confirmation instead of a blocking confirm() dialog.
  const wipe = h('button', { type: 'button' });
  let armed = false, timer = 0;
  const label = () => bind(wipe, armed ? 'priv.wipeSure' : 'priv.wipe');
  label();
  const done = h('p', { class: 'note', hidden: true }, tx('priv.wiped'));
  wipe.addEventListener('click', () => {
    clearTimeout(timer);
    if (!armed) { armed = true; label(); timer = setTimeout(() => { armed = false; label(); }, 4000); wipe.blur(); return; }
    armed = false; label(); progress.wipe(); done.hidden = false; setTimeout(() => { done.hidden = true; }, 2500); wipe.blur();
  });
  return h('div', { class: 'tabbody' },
    h('h3', {}, tx('priv.title')),
    h('p', { class: 'note' }, tx('priv.note')),
    h('p', { class: 'note' }, tx('priv.net')),
    h('div', { class: 'btns' }, wipe), done);
}
