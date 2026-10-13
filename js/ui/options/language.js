// Options > Language.
import { h, tx } from '../dom.js';
import { LANGS } from '../../i18n/index.js';
import { choice } from './widgets.js';

export function buildLanguage({ settings }) {
  const c = choice({
    label: 'lang.label',
    items: LANGS.map((l) => ({ value: l.id, text: l.name })),
    get: () => settings.data.lang,
    set: (v) => settings.update((d) => { d.lang = v; }),
  });
  settings.onChange(c.refresh);
  return h('div', { class: 'tabbody' }, c.el, h('p', { class: 'note' }, tx('lang.note')));
}
