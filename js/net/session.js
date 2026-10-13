// Multiplayer session: shares the world seed and player poses. The world is generated identically from the seed on
// every client, so nothing else needs to be synchronised.
// Roles:
//  - host: owns the seed, accepts guests (WebRTC links), relays their poses to everyone (star topology),
//  - guest: one link to the host,
//  - local: same-browser room (BroadcastChannel); the seed comes from the room name, every tab broadcasts.
// Every incoming message is validated; unknown or malformed messages are ignored.
import { cleanName } from '../core/settings.js';
import { seedFrom } from '../core/util.js';
import { joinLocalRoom } from './transport.js';

export const PROTOCOL = 1;
export const MAX_PLAYERS = 4;
const LIMIT = 1e7;
const TIMEOUT = 6000;      // ms without a message before a peer counts as gone

const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < LIMIT;
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,12}$/.test(v);
function pose(m) {
  if (!okNum(m.x) || !okNum(m.y) || !okNum(m.z) || !okNum(m.yaw)) return null;
  return { x: m.x, y: Math.max(-5, Math.min(10, m.y)), z: m.z, yaw: m.yaw };
}
const newId = () => Math.random().toString(36).slice(2, 10);

// ev: { onWelcome(seed, spawn), onPose(id, pose), onJoin(id, name), onLeave(id, name), onClosed() }
export function createSession({ role, name, seed, room, ev }) {
  const me = { id: newId(), name: cleanName(name) || 'Player' };
  const peers = new Map();        // id -> { name, link (host only), seen }
  const links = new Set();
  let hostLink = null, local = null, closed = false, hostSeen = performance.now();

  const S = {
    role, get id() { return me.id; }, get name() { return me.name; }, seed,
    peers,
    get count() { return peers.size + 1; },
  };

  function addPeer(id, nm, link) {
    if (peers.has(id)) return;
    peers.set(id, { name: cleanName(nm) || 'Player', link, seen: performance.now() });
    ev.onJoin && ev.onJoin(id, peers.get(id).name);
  }
  function dropPeer(id) {
    const p = peers.get(id);
    if (!p) return;
    peers.delete(id);
    ev.onLeave && ev.onLeave(id, p.name);
  }
  const broadcast = (msg, except) => { for (const l of links) if (l !== except) l.send(msg); };

  /* ---- host ---- */
  // Registers a freshly opened guest link (from transport.createInvite().accept()).
  S.addGuest = (link, spawn) => {
    links.add(link);
    let gid = null;
    link.onmessage = (m) => {
      if (m.t === 'hello' && !gid) {
        if (m.v !== PROTOCOL) { link.send({ t: 'bye', why: 'version' }); return; }
        if (peers.size + 1 >= MAX_PLAYERS) { link.send({ t: 'bye', why: 'full' }); return; }
        gid = newId();
        const players = [{ id: me.id, name: me.name }, ...[...peers].map(([id, p]) => ({ id, name: p.name }))];
        link.send({ t: 'welcome', v: PROTOCOL, id: gid, seed: S.seed, spawn: spawn(), players });
        broadcast({ t: 'join', id: gid, name: cleanName(m.name) || 'Player' }, link);
        addPeer(gid, m.name, link);
      } else if (m.t === 'pose' && gid) {
        const p = pose(m);
        if (!p) return;
        peers.get(gid).seen = performance.now();
        ev.onPose && ev.onPose(gid, p);
        broadcast({ t: 'pose', id: gid, ...p }, link);
      }
    };
    link.onclose = () => { links.delete(link); if (gid) { dropPeer(gid); broadcast({ t: 'leave', id: gid }); } };
  };

  /* ---- guest ---- */
  S.attachHost = (link) => {
    hostLink = link;
    link.onmessage = (m) => {
      hostSeen = performance.now();
      if (m.t === 'welcome' && m.v === PROTOCOL && okId(m.id) && Number.isInteger(m.seed) && m.spawn) {
        me.id = m.id;
        S.seed = m.seed;
        if (Array.isArray(m.players)) for (const p of m.players.slice(0, MAX_PLAYERS)) if (p && okId(p.id) && p.id !== me.id) addPeer(p.id, p.name);
        const sp = { x: okNum(m.spawn.x) ? m.spawn.x : 0, z: okNum(m.spawn.z) ? m.spawn.z : 0, yaw: okNum(m.spawn.yaw) ? m.spawn.yaw : 0 };
        ev.onWelcome && ev.onWelcome(S.seed, sp);
      } else if (m.t === 'join' && okId(m.id) && m.id !== me.id) addPeer(m.id, m.name);
      else if (m.t === 'leave' && okId(m.id)) dropPeer(m.id);
      else if (m.t === 'pose' && okId(m.id) && m.id !== me.id) {
        const p = pose(m);
        if (p) { if (!peers.has(m.id)) addPeer(m.id, '?'); peers.get(m.id).seen = performance.now(); ev.onPose && ev.onPose(m.id, p); }
      } else if (m.t === 'bye') { ev.onRefused && ev.onRefused(m.why === 'full' ? 'full' : 'version'); }
    };
    link.onclose = () => { if (!closed) { closed = true; ev.onClosed && ev.onClosed(); } };
    link.send({ t: 'hello', v: PROTOCOL, name: me.name });
  };

  /* ---- same-browser room ---- */
  if (role === 'local') {
    S.seed = seedFrom('room:' + room);
    local = joinLocalRoom(room, me.id);
    local.onmessage = (m) => {
      if (!okId(m.from)) return;
      if (m.t === 'leave') { dropPeer(m.from); return; }
      if (m.t === 'pose') {
        const p = pose(m);
        if (!p) return;
        if (!peers.has(m.from)) { if (peers.size + 1 >= MAX_PLAYERS) return; addPeer(m.from, m.name); }
        peers.get(m.from).seen = performance.now();
        ev.onPose && ev.onPose(m.from, p);
      }
    };
  }

  // Sends our pose (call ~12 times per second). Local rooms also drop peers silent for 5 s.
  S.sendPose = (p) => {
    const msg = { t: 'pose', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3) };
    if (role === 'host') broadcast({ ...msg, id: me.id });
    else if (role === 'guest' && hostLink) hostLink.send(msg);
    else if (local) local.send({ ...msg, name: me.name });
    // peers silent for TIMEOUT are gone (closing a tab does not always close the channel quickly)
    const now = performance.now();
    for (const [id, pr] of peers) {
      if (now - pr.seen < TIMEOUT) continue;
      if (role === 'host' && pr.link) pr.link.close();      // its onclose drops the peer and tells the others
      if (role === 'guest') continue;                        // the host announces leaves
      dropPeer(id);
    }
    if (role === 'guest' && hostLink && now - hostSeen > TIMEOUT * 1.5) hostLink.close();
  };

  S.close = () => {
    closed = true;
    if (local) { local.send({ t: 'leave' }); local.close(); }
    for (const l of links) l.close();
    if (hostLink) hostLink.close();
    links.clear(); peers.clear();
  };
  return S;
}
