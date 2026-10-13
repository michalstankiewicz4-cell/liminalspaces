// Multiplayer screens: lobby (name, STUN opt-in), host invite flow, join flow, same-browser room.
// Codes are exchanged by the players themselves (copy/paste), so there is no matchmaking server.
import { h, btn, tx } from './dom.js';
import { bind } from '../i18n/index.js';
import { checkbox } from './options/widgets.js';
import { createInvite, createJoin, webrtcAvailable } from '../net/transport.js';

function copyButton(area) {
  const ok = h('span', { class: 'note', hidden: true }, tx('common.copied'));
  const b = btn('common.copy', async () => {
    try { await navigator.clipboard.writeText(area.value); } catch (e) { area.select(); document.execCommand && document.execCommand('copy'); }
    ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 1800);
  });
  return h('div', { class: 'btns' }, b, ok);
}
const codeArea = (readonly) => h('textarea', { class: 'code', rows: 3, spellcheck: 'false', readonly: readonly || undefined });
const status = () => h('p', { class: 'info status' });
const say = (el, key, params) => { el.hidden = !key; if (key) bind(el, key, undefined, params); };

// nav: { go(name), back() -> a Back button, pop() -> goes back one screen, show(name) }
export function buildMultiScreens(app, nav) {
  const S = app.settings;
  const rtc = webrtcAvailable();
  const out = [];

  /* ---- lobby ---- */
  const name = h('input', { type: 'text', maxlength: 16, class: 'field', on: { change: () => S.update((d) => { d.net.name = name.value; }) } });
  const stun = checkbox({ label: 'multi.stun', get: () => S.data.net.stun, set: (v) => S.update((d) => { d.net.stun = v; }) });
  const hostB = btn('multi.host', () => { S.update((d) => { d.net.name = name.value; }); app.startHost(); });
  const joinB = btn('multi.join', () => { S.update((d) => { d.net.name = name.value; }); nav.go('join'); });
  hostB.disabled = joinB.disabled = !rtc;
  out.push(['multi', [
    tx('multi.title', 'h2'),
    h('label', { class: 'fieldrow' }, tx('multi.name'), name),
    h('div', { class: 'stack' }, hostB, joinB, btn('multi.room', () => { S.update((d) => { d.net.name = name.value; }); nav.go('room'); }), nav.back()),
    rtc ? null : tx('multi.noRtc', 'p'),
    stun.el,
    h('p', { class: 'note' }, tx('multi.note'))],
  () => { name.value = S.data.net.name; stun.refresh(); }]);

  /* ---- host: invite players (opened from the pause menu or right after hosting) ---- */
  const inv = codeArea(true), reply = codeArea(false), hStat = status(), players = h('p', { class: 'note' });
  let pending = null;
  const create = btn('host.create', async () => {
    if (pending) pending.cancel();
    pending = createInvite({ stun: S.data.net.stun });
    inv.value = ''; reply.value = ''; say(hStat, 'host.wait');
    try { inv.value = await pending.code(); say(hStat, null); } catch (e) { say(hStat, 'host.fail'); }
  });
  const connect = btn('host.connect', async () => {
    if (!pending) return;
    const p = pending;
    try {
      const link = await Promise.race([p.accept(reply.value), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
      pending = null;
      app.addGuest(link);
      inv.value = ''; reply.value = ''; say(hStat, 'host.ok');
    } catch (e) { say(hStat, e && e.message === 'code' ? 'host.bad' : 'host.fail'); }
  });
  const showPlayers = () => bind(players, 'host.players', undefined, { list: app.playerNames().join(', ') });
  app.onPlayers = () => { showPlayers(); };
  out.push(['host', [
    tx('host.title', 'h2'),
    tx('host.step1', 'p'), h('div', { class: 'btns' }, create), inv, copyButton(inv),
    tx('host.step2', 'p'), reply, h('div', { class: 'btns' }, connect),
    hStat, players,
    h('div', { class: 'stack' }, btn('host.resume', () => app.resume()))],
  () => { say(hStat, null); showPlayers(); }]);

  /* ---- join ---- */
  const jIn = codeArea(false), jOut = codeArea(true), jStat = status();
  const step2 = h('div', { hidden: true }, tx('join.step2', 'p'), jOut, copyButton(jOut));
  let joining = null;
  const makeReply = btn('join.reply', async () => {
    if (joining) joining.cancel();
    const j = joining = createJoin({ stun: S.data.net.stun });
    step2.hidden = true; say(jStat, null);
    try {
      jOut.value = await j.reply(jIn.value);
      step2.hidden = false; say(jStat, 'join.wait');
      const link = await j.connected;
      if (joining !== j) { link.close(); return; }
      joining = null;
      app.joinAsGuest(link, (key) => say(jStat, key));
    } catch (e) { if (joining === j) say(jStat, e && e.message === 'code' ? 'join.bad' : 'join.fail'); }
  });
  app.onJoinError = (key) => say(jStat, key);
  out.push(['join', [
    tx('join.title', 'h2'),
    tx('join.step1', 'p'), jIn, h('div', { class: 'btns' }, makeReply),
    step2, jStat,
    h('div', { class: 'stack' }, btn('common.back', () => { if (joining) { joining.cancel(); joining = null; } nav.pop(); }, 'sub'))],
  () => { if (!joining) { jIn.value = ''; jOut.value = ''; step2.hidden = true; say(jStat, null); } }]);

  /* ---- same-browser room ---- */
  const room = h('input', { type: 'text', maxlength: 24, class: 'field', placeholder: 'lobby', on: { keydown: (e) => { if (e.key === 'Enter') app.startRoom(room.value || 'lobby'); } } });
  out.push(['room', [
    tx('room.title', 'h2'),
    h('label', { class: 'fieldrow' }, tx('room.name'), room),
    h('div', { class: 'stack' }, btn('room.go', () => app.startRoom(room.value || 'lobby')), nav.back()),
    h('p', { class: 'note' }, tx('room.note'))]]);

  return out;
}
