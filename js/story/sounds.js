// Scratching at the skylights (story 04:17–04:23: ghost stories of creatures scratching at the indestructible
// skylights). The only sound in the Great Path world: synthesised (Web Audio, no files), positioned at a skylight
// near the player, muffled by the glass. Events are rare and irregular; each one also dims that skylight's sunbeam
// and slides a dark shape across the glass (see story/index.js scratchVisual).
export function createScratches(settings) {
  let ctx = null, out = null, noise = null;
  let next = 30, active = null;

  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain(); out.connect(ctx.destination);
    // a few seconds of noise, slightly pink
    const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = 0.92 * l + 0.08 * w; d[i] = w * 0.55 + l * 1.4; }
    noise = b;
    apply();
  }
  function apply() {
    if (!ctx) return;
    const a = settings.data.audio;
    out.gain.setTargetAtTime(a.scratch ? a.volume : 0, ctx.currentTime, 0.1);
  }
  settings.onChange(apply);

  // One stroke of claws on glass: band-passed noise with a pitch sweep, through the "glass" low-pass and the panner.
  function stroke(at, dur, dest, strength) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5 + Math.random() * 3;
    const f0 = 1800 + Math.random() * 1800;
    bp.frequency.setValueAtTime(f0, at); bp.frequency.linearRampToValueAtTime(f0 * (0.6 + Math.random() * 0.8), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.5 * strength, at + dur * 0.15);
    // rough, juddering contact
    for (let t = at + dur * 0.15; t < at + dur * 0.85; t += 0.018 + Math.random() * 0.02) g.gain.linearRampToValueAtTime((0.25 + Math.random() * 0.5) * strength, t);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(at, Math.random() * 2, dur + 0.05);
  }
  // A tap (nail on glass) and a dull knock (palm).
  function tap(at, dest, strength) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7 * strength, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    src.connect(hp).connect(g).connect(dest); src.start(at, Math.random() * 2, 0.06);
  }
  function knock(at, dest, strength) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * strength, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(g).connect(dest); o.start(at); o.stop(at + 0.35);
  }

  // Plays one scratching episode at world position p; returns its duration (s).
  function episode(p) {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.5; panner.rolloffFactor = 1.3;
    panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z;
    const glass = ctx.createBiquadFilter(); glass.type = 'lowpass'; glass.frequency.value = 2600; glass.Q.value = 0.7;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 900; body.gain.value = 5;
    glass.connect(body).connect(panner).connect(out);
    let t = ctx.currentTime + 0.1;
    const groups = 2 + Math.floor(Math.random() * 3);
    for (let gI = 0; gI < groups; gI++) {
      const strength = 0.5 + Math.random() * 0.6;
      const n = 2 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        const dur = 0.18 + Math.random() * 0.5;
        stroke(t, dur, glass, strength);
        if (Math.random() < 0.3) tap(t + dur + 0.02, glass, strength);
        t += dur + 0.05 + Math.random() * 0.25;
      }
      if (Math.random() < 0.35) { knock(t + 0.1, glass, strength); t += 0.4; }
      t += 0.6 + Math.random() * 1.8;               // silence between groups
    }
    setTimeout(() => { try { panner.disconnect(); } catch (e) { /* ignore */ } }, (t - ctx.currentTime + 1) * 1000);
    return t - ctx.currentTime;
  }

  return {
    // call from a user gesture
    unlock() { if (!ctx) start(); else if (ctx.state === 'suspended') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    reset(first = 20) { next = first + Math.random() * 15; active = null; },
    get active() { return active; },
    // dt: seconds; cam: camera (position + orientation for the listener); pick(): nearest skylight {x, y, z, beam} or null;
    // often: true on the Great Path / West Path (more frequent there)
    update(dt, cam, pick, often) {
      if (active) { active.t += dt; if (active.t > active.dur) active = null; }
      if (!ctx || ctx.state !== 'running') return null;
      const L = ctx.listener, p = cam.position;
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        const e = cam.matrixWorld.elements;
        L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10];
        L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
      }
      if (active || !settings.data.audio.scratch) return null;
      next -= dt;
      if (next > 0) return null;
      next = often ? 25 + Math.random() * 35 : 70 + Math.random() * 80;
      const sky = pick();
      if (!sky) { next = 6; return null; }
      const dur = episode(sky);
      active = { sky, t: 0, dur };
      return active;
    },
    // force an episode now (tests)
    trigger(sky) { if (!ctx) return null; const dur = episode(sky); active = { sky, t: 0, dur }; return active; },
  };
}
