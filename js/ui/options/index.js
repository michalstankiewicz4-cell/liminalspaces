// Options screen: tabbed panel (Graphics, Controls, Mouse, Audio, Language, Privacy & data).
import { h, tx } from '../dom.js';
import { buildGraphics } from './graphics.js';
import { buildControls } from './controls.js';
import { buildMouse } from './mouse.js';
import { buildAudio } from './audio.js';
import { buildLanguage } from './language.js';
import { buildPrivacy } from './privacy.js';

export function buildOptions(ctx) {
  const tabs = [
    ['graphics', 'opt.tab.graphics', buildGraphics],
    ['controls', 'opt.tab.controls', buildControls],
    ['mouse', 'opt.tab.mouse', buildMouse],
    ['audio', 'opt.tab.audio', buildAudio],
    ['language', 'opt.tab.language', buildLanguage],
    ['privacy', 'opt.tab.privacy', buildPrivacy],
  ];
  const bar = h('div', { class: 'tabs' });
  const body = h('div', { class: 'tabhost' });
  const entries = tabs.map(([id, key, build]) => {
    const page = build(ctx); page.hidden = true;
    const b = h('button', { type: 'button', class: 'tab', on: { click: () => select(id) } }, tx(key));
    bar.append(b); body.append(page);
    return { id, b, page };
  });
  function select(id) {
    for (const e of entries) { e.page.hidden = e.id !== id; e.b.classList.toggle('on', e.id === id); }
  }
  select('graphics');
  return { el: h('div', { class: 'options' }, bar, body), select };
}
