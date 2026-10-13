// Network transports. Nothing here runs unless the player opens a multiplayer screen.
//  - WebRTC DataChannel with manual signalling: the host creates an invite code, the guest answers with a reply code
//    (copy/paste through any messenger). No game server. Optional public STUN server (opt-in setting) helps
//    connections across different networks; without it only the local network / direct connections work.
//  - BroadcastChannel "same browser" rooms: several tabs of this game in one browser (testing, demos).
// A link object: { send(obj), onmessage = (obj) => {}, onclose = () => {}, close(), open }

const PREFIX = 'LS1.';
const MAX_MSG = 4000;
export const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];

// Parses an incoming message: JSON object with a string `t`, limited size. Anything else is dropped.
export function parse(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MSG) return null;
  try { const m = JSON.parse(raw); return m && typeof m === 'object' && !Array.isArray(m) && typeof m.t === 'string' ? m : null; } catch (e) { return null; }
}

const encode = (desc) => PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ t: desc.type, s: desc.sdp }))));
function decode(code, type) {
  const s = String(code || '').replace(/\s+/g, '');
  if (!s.startsWith(PREFIX) || s.length > 20000) throw new Error('code');
  const o = JSON.parse(decodeURIComponent(escape(atob(s.slice(PREFIX.length)))));
  if (!o || o.t !== type || typeof o.s !== 'string') throw new Error('code');
  return { type: o.t, sdp: o.s };
}

// Resolves when ICE gathering is complete (or after a timeout, with whatever candidates exist).
function gathered(pc, ms = 5000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((res) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(tm); res(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', check);
    const tm = setTimeout(done, ms);
  });
}

function wrapChannel(dc, pc) {
  const link = {
    onmessage: null, onclose: null,
    get open() { return dc.readyState === 'open'; },
    send(obj) { if (dc.readyState === 'open') dc.send(JSON.stringify(obj)); },
    close() { try { dc.close(); } catch (e) { /* ignore */ } try { pc.close(); } catch (e) { /* ignore */ } },
  };
  dc.onmessage = (e) => { const m = parse(e.data); if (m && link.onmessage) link.onmessage(m); };
  let closed = false;
  const closeOnce = () => { if (closed) return; closed = true; if (link.onclose) link.onclose(); };
  dc.onclose = closeOnce;
  pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed'].includes(pc.connectionState)) closeOnce(); });
  return link;
}

export const webrtcAvailable = () => typeof RTCPeerConnection === 'function';

// Host side of one invitation. invite() -> code; accept(replyCode) -> Promise<link> (resolves when the channel opens).
export function createInvite({ stun }) {
  const pc = new RTCPeerConnection({ iceServers: stun ? STUN : [] });
  const dc = pc.createDataChannel('ls');
  const opened = new Promise((res, rej) => {
    dc.onopen = () => res(wrapChannel(dc, pc));
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') rej(new Error('failed')); });
  });
  return {
    async code() { await pc.setLocalDescription(await pc.createOffer()); await gathered(pc); return encode(pc.localDescription); },
    async accept(reply) { await pc.setRemoteDescription(decode(reply, 'answer')); return opened; },
    cancel() { try { pc.close(); } catch (e) { /* ignore */ } },
  };
}

// Guest side: reply(inviteCode) -> reply code; connected -> Promise<link>.
export function createJoin({ stun }) {
  const pc = new RTCPeerConnection({ iceServers: stun ? STUN : [] });
  const connected = new Promise((res, rej) => {
    pc.ondatachannel = (e) => { const dc = e.channel; if (dc.readyState === 'open') res(wrapChannel(dc, pc)); else dc.onopen = () => res(wrapChannel(dc, pc)); };
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') rej(new Error('failed')); });
  });
  return {
    async reply(invite) {
      await pc.setRemoteDescription(decode(invite, 'offer'));
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      return encode(pc.localDescription);
    },
    connected,
    cancel() { try { pc.close(); } catch (e) { /* ignore */ } },
  };
}

// Same-browser room over BroadcastChannel. Every tab is a peer; messages carry the sender id.
export function joinLocalRoom(room, id) {
  const ch = new BroadcastChannel('liminal-room:' + room);
  const link = {
    onmessage: null, onclose: null, open: true,
    send(obj) { ch.postMessage(JSON.stringify({ ...obj, from: id })); },
    close() { link.open = false; ch.close(); },
  };
  ch.onmessage = (e) => { const m = parse(e.data); if (m && m.from !== id && link.onmessage) link.onmessage(m); };
  return link;
}
