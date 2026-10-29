// Menu overlay: main menu, single player, multiplayer (host / join / same-browser room), pause and options screens.
import { h, btn, tx } from './dom.js';
import { t, bind } from '../i18n/index.js';
import { buildOptions } from './options/index.js';
import { buildMultiScreens } from './multi.js';
import { VERSION } from '../version.js';

// app: { newWalk, continueWalk, seedWalk(text), resume, quit, info() -> {...}, progress, settings, ... }
export function createMenu(root, app) {
  const screens = {};
  const onShow = {};
  const history = [];
  let current = null;

  const screen = (name, kids, show) => {
    screens[name] = h('section', { class: 'screen', hidden: true }, ...kids);
    if (show) onShow[name] = show;
    return screens[name];
  };
  const back = () => btn('common.back', () => menu.back(), 'sub');

  // shown when the server has a newer version than the files running now (see core/app.js)
  const updText = h('span');
  const update = h('p', { class: 'info update', hidden: true }, updText, ' ', btn('menu.reload', () => location.reload()));

  /* ---- main: two tiles, one per world ---- */
  const stats = h('p', { class: 'info' });
  const tile = (img, title, desc, onClick) => h('button', { type: 'button', class: 'tile', on: { click: (e) => { e.currentTarget.blur(); onClick(); } } },
    h('img', { src: img, alt: '', draggable: 'false' }), h('span', { class: 'ttl' }, tx(title)), h('span', { class: 'dsc' }, tx(desc)));
  screen('main', [
    h('h1', { class: 'logo' }, 'LIMINAL', h('br'), 'SPACES'),
    tx('menu.tagline', 'p'),
    h('div', { class: 'tiles' },
      tile('assets/tile-endless.png', 'tile.endless', 'tile.endlessDesc', () => menu.go('endless')),
      tile('assets/tile-path.png', 'tile.path', 'tile.pathDesc', () => menu.go('path'))),
    h('div', { class: 'stack' }, btn('menu.options', () => menu.go('options'))),
    stats,
    update,
    h('p', { class: 'foot' }, 'v' + VERSION, ' · ', tx('menu.foot'))],
  () => bind(stats, 'menu.stats', undefined, { km: (app.progress.dist / 1000).toFixed(2), odd: app.progress.odd }));

  /* ---- world 1: endless ---- */
  screen('endless', [
    tx('tile.endless', 'h2'), tx('tile.endlessDesc', 'p'),
    h('div', { class: 'stack' }, btn('menu.single', () => menu.go('single')), btn('menu.multi', () => menu.go('multi')), back())]);

  /* ---- world 2: the Great Path ---- */
  const pathCont = h('button', { type: 'button', on: { click: () => { pathCont.blur(); app.startPath('continue'); } } });
  const pathStatus = h('p', { class: 'info status' });
  screen('path', [
    tx('tile.path', 'h2'), tx('path.intro', 'p'),
    h('div', { class: 'stack' },
      btn('path.gate', () => app.startPath('gate')),
      pathCont,
      btn('path.hub', () => app.startPath('hub')),
      btn('path.wastes', () => app.startPath('wastes')),
      back()),
    pathStatus,
    h('p', { class: 'note' }, tx('path.keys')),
    h('p', { class: 'foot' }, tx('path.credit'))],
  () => {
    pathCont.hidden = !app.progress.path;
    bind(pathCont, 'path.continue');
    pathStatus.hidden = true;
  });
  app.onPathStatus = (key) => { pathStatus.hidden = !key; if (key) bind(pathStatus, key); };

  /* ---- single player ---- */
  const cont = h('button', { type: 'button', on: { click: () => { cont.blur(); app.continueWalk(); } } });
  const seedIn = h('input', { type: 'text', maxlength: 32, class: 'field', placeholder: '12345', on: { keydown: (e) => { if (e.key === 'Enter') app.seedWalk(seedIn.value); } } });
  screen('single', [
    tx('single.title', 'h2'),
    h('div', { class: 'stack' },
      btn('single.new', () => app.newWalk()),
      cont),
    h('label', { class: 'fieldrow' }, tx('single.seed'), seedIn),
    h('div', { class: 'stack' }, btn('single.seedGo', () => app.seedWalk(seedIn.value)), back()),
    tx('single.note', 'p')],
  () => {
    const last = app.progress.last;
    cont.hidden = !last;
    if (last) bind(cont, 'single.continue', undefined, { seed: last.seed });
  });

  /* ---- multiplayer ---- */
  for (const [name, kids, show] of buildMultiScreens(app, { go: (n) => menu.go(n), back, pop: () => menu.back(), show: (n) => menu.show(n) })) screen(name, kids, show);

  /* ---- pause ---- */
  const pauseInfo = h('p', { class: 'info' });
  const invite = btn('pause.invite', () => menu.go('host'));
  screen('pause', [
    tx('pause.title', 'h2'),
    h('div', { class: 'stack' }, btn('pause.resume', () => app.resume()), invite, btn('menu.options', () => menu.go('options')), btn('pause.quit', () => app.quit())),
    pauseInfo],
  () => {
    const i = app.info();
    invite.hidden = !i.host;
    if (i.path) bind(pauseInfo, 'pause.pathInfo', undefined, { zone: t('gp.z.' + i.zone), time: i.time, m: Math.round(i.dist), n: i.places, total: i.total });
    else bind(pauseInfo, 'pause.info', undefined, { seed: i.seed, zone: t('zone.' + i.zone), m: Math.round(i.dist), odd: i.odd });
  });

  /* ---- options ---- */
  const options = buildOptions({ settings: app.settings, input: app.input, progress: app.progress });
  screen('options', [tx('opt.title', 'h2'), options.el, h('div', { class: 'stack' }, back())], () => options.select('graphics'));

  const overlay = h('div', { id: 'menu', hidden: true }, Object.values(screens));
  root.append(overlay);

  const menu = {
    get current() { return current; },
    get open() { return !overlay.hidden; },
    // Opens a screen without history (the first screen of a flow).
    show(name) { history.length = 0; menu.switchTo(name); },
    switchTo(name) {
      for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
      current = name; overlay.hidden = false;
      overlay.dataset.screen = name;
      if (onShow[name]) onShow[name]();
    },
    go(name) { history.push(current); menu.switchTo(name); },
    // Back one screen; returns false when there is nothing to go back to.
    back() {
      if (!history.length) return false;
      menu.switchTo(history.pop()); return true;
    },
    hide() { overlay.hidden = true; current = null; history.length = 0; },
    refresh() { if (current && onShow[current]) onShow[current](); },
    showUpdate(v) { update.hidden = false; bind(updText, 'menu.update', undefined, { v, cur: VERSION }); },
  };
  return menu;
}
