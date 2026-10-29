// Sound for the Great Path world, all synthesised with Web Audio (no files):
//  - ambience beds per zone (mains hum, tube buzz, room tone, wind, drone, rumble) cross-faded on zone change,
//  - three reverbs (small room, hall, huge space) mixed per zone, plus a damp one for the mine,
//  - positional emitters near the player (map machine, factory machines, dripping rain collectors and mine water,
//    Vibra-cable stations, vents),
//  - footsteps by floor surface, landing thuds,
//  - one-shot event sounds at world positions (door slam, knocks, lamp pop, cable twangs, ceiling run, creaks,
//    rumble, echo steps, glitch static, clunks, heartbeat),
//  - scratching at the skylights (story 04:17).
const BEDS = {
  //            hum  buzz room roomHz wind drone rumble space
  quiet:      [0.6, 0.6, 0.5, 700, 0.0, 0.0, 0.05, 'small'],
  hall:       [0.5, 0.5, 0.45, 600, 0.15, 0.0, 0.08, 'hall'],
  factory:    [0.7, 0.4, 0.6, 400, 0.0, 0.0, 0.35, 'hall'],
  ring:       [0.15, 0.2, 0.4, 300, 0.45, 0.0, 0.2, 'hall'],
  mine:       [0.0, 0.0, 0.3, 200, 0.25, 0.0, 0.6, 'damp'],
  wastes:     [0.45, 0.6, 0.45, 650, 0.2, 0.05, 0.1, 'hall'],
  blue:       [0.3, 0.3, 0.35, 500, 0.3, 0.35, 0.1, 'hall'],
  chapel:     [0.0, 0.0, 0.25, 350, 0.55, 0.9, 0.12, 'huge'],
  path:       [0.4, 0.5, 0.45, 650, 0.25, 0.1, 0.08, 'hall'],
};
const ZONE_BED = {
  plaza: 'quiet', cafeteria: 'quiet', guild: 'quiet', seniorOffice: 'quiet', library: 'quiet', machine: 'quiet', court: 'quiet',
  gardens: 'quiet', market: 'quiet', offices: 'quiet', booth: 'quiet', factory: 'factory', avenue: 'hall',
  ring1: 'ring', ring2: 'ring', mine: 'mine', gate: 'wastes', wastes: 'wastes', cluster: 'wastes', doors: 'wastes', deadend: 'ring',
  blue: 'blue', chapel: 'chapel', greatPath: 'path', westPath: 'path',
};
const SPACES = { small: [0.6, 0.18], hall: [1.9, 0.3], huge: [5.5, 0.55], damp: [1.2, 0.22] };
// footstep sounds per floor material: [filter type, freq, Q, duration, gain, click]
const STEPS = {
  carpet: ['lowpass', 520, 0.7, 0.11, 0.55, 0], tile: ['bandpass', 1900, 1.4, 0.07, 0.5, 1], metal: ['bandpass', 2600, 6, 0.18, 0.45, 1],
  grit: ['bandpass', 3200, 0.8, 0.12, 0.42, 0], wood: ['bandpass', 900, 1.6, 0.08, 0.55, 1], water: ['bandpass', 1300, 0.7, 0.25, 0.4, 0],
};
const MAT_STEP = {
  carpet: 'carpet', carpetGrey: 'carpet', tile: 'tile', stone: 'tile', plaster: 'tile', whitepanel: 'tile', concrete: 'grit', subfloor: 'grit',
  soil: 'grit', rock: 'grit', earth: 'grit', steel: 'metal', agarite: 'metal', parquet: 'wood', wood: 'wood', drywall: 'grit',
};

export function createPathAudio(settings) {
  let ctx = null, master, dry, buses = {}, noise, pink, brown, beds = null, bedKey = '', power = 1;
  const emit = new Map();          // emitter object -> { panner, nodes, next }

  function buffer(seconds, kind) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.03; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
      else { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
    }
    return b;
  }
  // Generated impulse response: decaying noise with a slight low-pass over time.
  function impulse(seconds) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / n, w = Math.random() * 2 - 1; lp += (w - lp) * (0.9 - t * 0.75); d[i] = lp * Math.pow(1 - t, 2.4); }
    }
    return b;
  }

  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    dry = ctx.createGain(); dry.connect(master);
    for (const [k, [sec]] of Object.entries(SPACES)) {
      const conv = ctx.createConvolver(); conv.buffer = impulse(sec);
      const send = ctx.createGain(); send.gain.value = 0;
      send.connect(conv).connect(master);
      buses[k] = send;
    }
    noise = buffer(3, 'white'); pink = buffer(4, 'pink'); brown = buffer(4, 'brown');
    beds = makeBeds();
    applyVolume();
  }
  // `wet`: the bus everything audible goes into (dry + the reverb sends)
  let wet = null;
  function makeBeds() {
    wet = ctx.createGain(); wet.connect(dry);
    for (const send of Object.values(buses)) wet.connect(send);
    const loop = (buf, type, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl).connect(g).connect(wet); s.start(0, Math.random() * 2);
      return { f: fl, g };
    };
    const hum = ctx.createGain(); hum.gain.value = 0; hum.connect(wet);
    const o1 = ctx.createOscillator(); o1.frequency.value = 50; o1.connect(hum); o1.start();
    const buzz = ctx.createGain(); buzz.gain.value = 0; buzz.connect(wet);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 100;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; o2.connect(lp).connect(buzz); o2.start();
    // drone: two detuned low tones through a slowly moving filter (the chapel)
    const drone = ctx.createGain(); drone.gain.value = 0; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 300; dl.Q.value = 4;
    dl.connect(drone).connect(wet);
    for (const f of [55, 55.4, 82.6]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(dl); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg).connect(dl.frequency); lfo.start();
    // wind: band-passed pink noise with a slow sweep
    const wind = loop(pink, 'bandpass', 500, 0.6);
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07; const wg = ctx.createGain(); wg.gain.value = 300; wl.connect(wg).connect(wind.f.frequency); wl.start();
    return { hum, buzz, drone, wind, room: loop(pink, 'lowpass', 600, 0.5), rumble: loop(brown, 'lowpass', 90, 0.7) };
  }
  function applyVolume() { if (ctx) master.gain.setTargetAtTime(settings.data.audio.volume, ctx.currentTime, 0.1); }
  settings.onChange(applyVolume);

  function setBed(key) {
    if (!ctx || key === bedKey) return;
    bedKey = key;
    const [hum, buzz, room, roomHz, wind, drone, rumble, space] = BEDS[key] || BEDS.quiet, n = ctx.currentTime, T = 1.2;
    const on = settings.data.audio.hum ? 1 : 0;
    beds.hum.gain.setTargetAtTime(0.035 * hum * on * power, n, T);
    beds.buzz.gain.setTargetAtTime(0.008 * buzz * on * power, n, T);
    beds.room.g.gain.setTargetAtTime(0.05 * room, n, T); beds.room.f.frequency.setTargetAtTime(roomHz, n, T);
    beds.wind.g.gain.setTargetAtTime(0.05 * wind, n, T);
    beds.drone.gain.setTargetAtTime(0.05 * drone, n, T * 2);
    beds.rumble.g.gain.setTargetAtTime(0.14 * rumble, n, T);
    for (const [k, send] of Object.entries(buses)) send.gain.setTargetAtTime(k === space ? SPACES[k][1] : 0, n, T);
  }
  // Power cuts: the hum and buzz follow the lights.
  function setPower(k) {
    power = k;
    if (!ctx) return;
    const [hum, buzz] = BEDS[bedKey] || BEDS.quiet, on = settings.data.audio.hum ? 1 : 0;
    beds.hum.gain.setTargetAtTime(0.035 * hum * on * k, ctx.currentTime, 0.03);
    beds.buzz.gain.setTargetAtTime(0.008 * buzz * on * k, ctx.currentTime, 0.03);
  }

  /* ---- building blocks ---- */
  const now = () => ctx.currentTime;
  function panner(p, ref = 2) {
    const pn = ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = ref; pn.rolloffFactor = 1.2;
    pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z;
    pn.connect(wet);
    return pn;
  }
  function burst(dest, at, { buf = noise, type = 'bandpass', f = 1000, q = 1, dur = 0.1, gain = 0.5, attack = 0.005, sweep = 1 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, at); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f * sweep), at + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    s.connect(fl).connect(g).connect(dest); s.start(at, Math.random() * 2, dur + 0.05);
  }
  function tone(dest, at, { f = 100, f2 = f, type = 'sine', dur = 0.3, gain = 0.5, attack = 0.005 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(Math.max(10, f2), at + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.05);
  }
  const later = (dest, ms) => setTimeout(() => { try { dest.disconnect(); } catch (e) { /* ignore */ } }, ms);

  /* ---- positional emitters (looping sources near the player) ---- */
  const EMIT = {
    machine(pn) { // electrical whine and a soft 50 Hz under it
      const g = ctx.createGain(); g.gain.value = 0.05; g.connect(pn);
      const o = ctx.createOscillator(); o.frequency.value = 1240; const o2 = ctx.createOscillator(); o2.frequency.value = 50;
      const g2 = ctx.createGain(); g2.gain.value = 0.5; o.connect(g); o2.connect(g2).connect(g); o.start(); o2.start();
      return { stop: () => { o.stop(); o2.stop(); } };
    },
    factory(pn, e) { e.tick = (t) => { burst(pn, t, { type: 'bandpass', f: 380, q: 3, dur: 0.25, gain: 0.5 }); burst(pn, t + 0.06, { type: 'highpass', f: 2500, q: 1, dur: 0.05, gain: 0.25 }); return 1.1 + Math.random() * 0.4; }; },
    drip(pn, e) { e.tick = (t) => { tone(pn, t, { f: 1400 + Math.random() * 900, f2: 700, dur: 0.07, gain: 0.25 }); return 0.6 + Math.random() * 2.5; }; },
    station(pn) { // the cable hums faintly
      const g = ctx.createGain(); g.gain.value = 0.012; g.connect(pn);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 220; o.connect(g); o.start();
      return { stop: () => o.stop() };
    },
    vent(pn) {
      const s = ctx.createBufferSource(); s.buffer = pink; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0.06; s.connect(f).connect(g).connect(pn); s.start(0, Math.random() * 3);
      return { stop: () => s.stop() };
    },
  };
  function updateEmitters(list, pos) {
    const keep = new Set();
    for (const e of list) {
      const d = Math.hypot(e.x - pos.x, e.z - pos.z);
      if (d > 22) continue;
      keep.add(e);
      let s = emit.get(e);
      if (!s) {
        const pn = panner(e, e.kind === 'drip' ? 1 : 2);
        s = { pn, next: now() + Math.random() };
        const r = EMIT[e.kind] && EMIT[e.kind](pn, s);
        s.stop = r && r.stop;
        emit.set(e, s);
      }
      if (s.tick && now() > s.next - 0.1) s.next = Math.max(s.next, now()) + s.tick(Math.max(s.next, now()));
    }
    for (const [e, s] of emit) if (!keep.has(e)) { if (s.stop) s.stop(); later(s.pn, 3000); emit.delete(e); }
  }

  /* ---- one-shots at positions (events) ---- */
  const SHOT = {
    door(pn, t) { burst(pn, t, { buf: brown, type: 'lowpass', f: 400, dur: 0.6, gain: 1.4, attack: 0.002 }); burst(pn, t, { type: 'bandpass', f: 900, q: 2, dur: 0.12, gain: 0.6 }); burst(pn, t + 0.05, { type: 'highpass', f: 3000, dur: 0.08, gain: 0.25 }); },
    knock(pn, t) { for (let k = 0; k < 3; k++) { const a = t + k * (0.32 + Math.random() * 0.08); tone(pn, a, { f: 140, f2: 70, dur: 0.18, gain: 0.9 }); burst(pn, a, { type: 'bandpass', f: 500, q: 2, dur: 0.06, gain: 0.5 }); } },
    pop(pn, t) { burst(pn, t, { type: 'highpass', f: 1500, dur: 0.12, gain: 1.0, attack: 0.001 }); burst(pn, t + 0.02, { type: 'bandpass', f: 5000, q: 1, dur: 0.5, gain: 0.25 }); tone(pn, t, { f: 120, f2: 40, dur: 0.2, gain: 0.4 }); },
    twang(pn, t) { for (let k = 0; k < 3; k++) { const a = t + k * 0.55; tone(pn, a, { f: 196, f2: 186, type: 'sawtooth', dur: 1.2, gain: 0.12 }); tone(pn, a, { f: 392, f2: 380, dur: 0.9, gain: 0.1 }); burst(pn, a, { type: 'highpass', f: 3000, dur: 0.03, gain: 0.3 }); } },
    creak(pn, t) { const o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 8;
      o.frequency.setValueAtTime(60, t); for (let k = 1; k < 16; k++) o.frequency.linearRampToValueAtTime(50 + Math.random() * 40, t + k * 0.09);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.5);
      o.connect(f).connect(g).connect(pn); o.start(t); o.stop(t + 1.6); },
    rumble(pn, t) { burst(pn, t, { buf: brown, type: 'lowpass', f: 120, dur: 3.5, gain: 1.6, attack: 0.6 }); for (let k = 0; k < 8; k++) burst(pn, t + 0.4 + Math.random() * 2.5, { type: 'bandpass', f: 2500 + Math.random() * 2000, q: 2, dur: 0.05, gain: 0.08 }); },
    step(pn, t, o) { const s = STEPS[o.mat || 'carpet']; burst(pn, t, { type: s[0], f: s[1], q: s[2], dur: s[3], gain: s[4] * 0.9 }); },
    thud(pn, t) { tone(pn, t, { f: 90, f2: 40, dur: 0.25, gain: 0.8 }); burst(pn, t, { type: 'lowpass', f: 300, dur: 0.2, gain: 0.6 }); },
  };
  function shot(kind, p, o = {}) {
    if (!ctx) return;
    const pn = panner(p, o.ref || 2), t = now() + (o.delay || 0) + 0.02;
    SHOT[kind](pn, t, o);
    later(pn, 6000 + (o.delay || 0) * 1000);
  }
  // A sound moving along a line (something running above the ceiling): thumps along the way.
  function run(from, to, seconds) {
    if (!ctx) return;
    const pn = panner(from, 3), t0 = now() + 0.05;
    for (const ax of ['X', 'Y', 'Z']) { const k = ax.toLowerCase(); pn['position' + ax].setValueAtTime(from[k], t0); pn['position' + ax].linearRampToValueAtTime(to[k], t0 + seconds); }
    const n = Math.floor(seconds / 0.16);
    for (let i = 0; i < n; i++) { const t = t0 + i * 0.16 + Math.random() * 0.03; tone(pn, t, { f: 70, f2: 35, dur: 0.12, gain: 0.9 }); burst(pn, t, { type: 'bandpass', f: 300, q: 1.5, dur: 0.07, gain: 0.5 }); }
    later(pn, (seconds + 4) * 1000);
  }
  // non-positional
  function clunk() { if (!ctx) return; const t = now(); tone(wet, t, { f: 70, f2: 30, dur: 0.4, gain: 0.8 }); burst(wet, t, { type: 'bandpass', f: 800, q: 3, dur: 0.15, gain: 0.5 }); burst(wet, t + 0.03, { type: 'highpass', f: 4000, dur: 0.3, gain: 0.15 }); }
  function staticBurst(dur = 0.4) { if (!ctx) return; burst(dry, now(), { type: 'highpass', f: 1800, dur, gain: 0.3, attack: 0.01 }); }
  function heartbeat(strength) { if (!ctx) return; const t = now(); tone(dry, t, { f: 60, f2: 40, dur: 0.16, gain: 0.7 * strength }); tone(dry, t + 0.22, { f: 55, f2: 38, dur: 0.18, gain: 0.5 * strength }); }

  /* ---- footsteps ---- */
  function step(mat, wet2) {
    if (!ctx) return;
    const s = STEPS[wet2 ? 'water' : MAT_STEP[mat] || 'carpet'], t = now();
    burst(wet, t, { type: s[0], f: s[1] * (0.9 + Math.random() * 0.2), q: s[2], dur: s[3], gain: s[4] * 0.55 });
    if (s[5]) burst(wet, t, { type: 'highpass', f: 4000, dur: 0.02, gain: 0.12 });
  }
  function land(mat) { if (!ctx) return; tone(wet, now(), { f: 80, f2: 40, dur: 0.18, gain: 0.5 }); step(mat); }

  /* ---- scratching at the skylights ---- */
  let next = 30, active = null;
  function scratchEpisode(p) {
    const pn = panner(p, 2.5);
    const glass = ctx.createBiquadFilter(); glass.type = 'lowpass'; glass.frequency.value = 2600;
    glass.connect(pn);
    let t = now() + 0.1;
    const groups = 2 + Math.floor(Math.random() * 3);
    for (let gI = 0; gI < groups; gI++) {
      const st = 0.5 + Math.random() * 0.6, n = 2 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        const dur = 0.18 + Math.random() * 0.5, f0 = 1800 + Math.random() * 1800;
        burst(glass, t, { f: f0, q: 2.5 + Math.random() * 3, dur, gain: 0.45 * st, attack: dur * 0.15, sweep: 0.6 + Math.random() * 0.8 });
        if (Math.random() < 0.3) burst(glass, t + dur + 0.02, { type: 'highpass', f: 2500, dur: 0.04, gain: 0.6 * st, attack: 0.001 });
        t += dur + 0.05 + Math.random() * 0.25;
      }
      if (Math.random() < 0.35) { tone(glass, t + 0.1, { f: 90, f2: 45, dur: 0.3, gain: 0.9 * st }); t += 0.4; }
      t += 0.6 + Math.random() * 1.8;
    }
    later(pn, (t - now() + 1) * 1000);
    return t - now();
  }

  return {
    unlock() { if (!ctx) start(); else if (ctx.state === 'suspended') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    reset(first = 20) { next = first + Math.random() * 15; active = null; },
    get active() { return active; },
    // cam: camera; zoneKey; emitters: list near the player; pick(): skylight for scratching; often: on the paths
    update(dt, cam, zoneKey, emitters, pick, often) {
      if (active) { active.t += dt; if (active.t > active.dur) active = null; }
      if (!ctx || ctx.state !== 'running') return;
      setBed(ZONE_BED[zoneKey] || 'quiet');
      const L = ctx.listener, p = cam.position, e = cam.matrixWorld.elements;
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10];
        L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
      }
      updateEmitters(emitters, p);
      if (active || !settings.data.audio.scratch || dt === 0) return;
      next -= dt;
      if (next > 0) return;
      next = often ? 25 + Math.random() * 35 : 70 + Math.random() * 80;
      const sky = pick();
      if (!sky) { next = 6; return; }
      active = { sky, t: 0, dur: scratchEpisode(sky) };
    },
    trigger(sky) { if (!ctx) return null; active = { sky, t: 0, dur: scratchEpisode(sky) }; return active; },
    step, land, shot, run, clunk, staticBurst, heartbeat, setPower,
  };
}
