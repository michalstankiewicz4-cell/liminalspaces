// Hotbar at the bottom of the screen (like Minecraft's, in this game's style): eight slots with the things you
// carry — the flashlight, the map (Great Path) — and empty slots for things to come. Number keys (rebindable:
// hotbar1…hotbar8) or the mouse wheel select a slot; a slot key also uses its item (flashlight on/off, map open).
// Icons are drawn as 16×16 pixel art on canvases (no image files).
import { h } from './dom.js';
import { t, onLang } from '../i18n/index.js';

export const SLOTS = 8;

// 16x16 pixel icons from strings: each char is a palette index ('.' = transparent)
const PAL = { g: '#4f6b44', G: '#6f8f5e', d: '#2c3a27', k: '#141614', y: '#ffe9a0', Y: '#fff6d0', o: '#c8b48c', p: '#e8dfc4', P: '#cbbf9c', r: '#b0402c', b: '#5a7ac8', l: '#8a7a50' };
const ICONS = {
  flashlight: [
    '................',
    '................',
    '...........kk...',
    '..........kook..',
    '.........kooook.',
    '........kgoook..',
    '.......kgGgkk...',
    '......kgGgk.....',
    '.....kgGgk......',
    '....kgdgk.......',
    '...kgGgk........',
    '..kgGgk.........',
    '..kggk..........',
    '...kk...........',
    '................',
    '................'],
  flashlightOn: [
    '..........Y.Y..Y',
    '...........YYYY.',
    '...........kkYYY',
    '..........kyykY.',
    '.........kyyyyk.',
    '........kgyyyk..',
    '.......kgGgkk...',
    '......kgGgk.....',
    '.....kgGgk......',
    '....kgdgk.......',
    '...kgGgk........',
    '..kgGgk.........',
    '..kggk..........',
    '...kk...........',
    '................',
    '................'],
  map: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kppPppPPppPk..',
    '..kplllPpPbbPk..',
    '..kpPplPppbPPk..',
    '..kPppllllPppk..',
    '..kpPpPPplPPpk..',
    '..kppPppPplPPk..',
    '..kPpprpPPlppk..',
    '..kpPrrrPpllPk..',
    '..kppPrPpPPlpk..',
    '..kPppPPppPplk..',
    '..kppPppPPpPPk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................'],
};
function iconUrl(name) {
  const rows = ICONS[name], c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const p = PAL[r[x]]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } } });
  return c.toDataURL();
}

export function createHotbar(root) {
  const urls = {};
  const url = (n) => (urls[n] = urls[n] || iconUrl(n));
  const slots = [], label = h('div', { class: 'hb-label' });
  const bar = h('div', { id: 'hotbar', hidden: true });
  for (let i = 0; i < SLOTS; i++) {
    const img = h('img', { alt: '', draggable: 'false', hidden: true });
    const el = h('div', { class: 'hb-slot' }, img, h('span', { class: 'hb-n' }, String(i + 1)));
    slots.push({ el, img, item: null, on: false });
    bar.append(el);
  }
  root.append(h('div', { id: 'hotbarwrap' }, label, bar));
  let sel = 0, labelT = 0;

  function draw(s) {
    const icon = s.item ? (s.item === 'flashlight' && s.on ? 'flashlightOn' : s.item) : null;
    s.img.hidden = !icon;
    if (icon) s.img.src = url(icon);
    s.el.classList.toggle('on', !!s.on);
    s.el.title = s.item ? t('item.' + s.item) : '';
  }
  function showLabel() {
    const s = slots[sel];
    label.textContent = s.item ? t('item.' + s.item) : t('item.empty');
    label.classList.remove('fade'); labelT = 2;
  }
  onLang(() => slots.forEach(draw));

  return {
    // items: list of item ids for the first slots (the rest stay empty)
    setItems(items) { slots.forEach((s, i) => { s.item = items[i] || null; s.on = false; draw(s); }); },
    get selected() { return slots[sel].item; },
    select(i) {
      sel = ((i % SLOTS) + SLOTS) % SLOTS;
      slots.forEach((s, k) => s.el.classList.toggle('sel', k === sel));
      showLabel();
      return slots[sel].item;
    },
    scroll(d) { return this.select(sel + d); },
    // the state shown on an item's slot (the flashlight's light)
    setOn(item, on) { for (const s of slots) if (s.item === item && s.on !== on) { s.on = on; draw(s); } },
    show(on) { bar.hidden = !on; if (!on) label.textContent = ''; },
    tick(dt) { if (labelT > 0) { labelT -= dt; if (labelT <= 0.6) label.classList.add('fade'); } },
  };
}
