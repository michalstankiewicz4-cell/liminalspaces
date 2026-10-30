// Synthesised sound (Web Audio, no audio files): fluorescent hum, room tone per zone, footsteps, a find chime.
// The audio context starts on the first user gesture (browser autoplay rules).

const ZONE = {
  //            hum   buzz  room  roomHz water rumble step [freq, q, dur]
  office:    { hum: 1, buzz: 1, room: 0.5, roomHz: 700, water: 0, rumble: 0.1, step: [420, 1.2, 0.09] },
  corridors: { hum: 0.4, buzz: 0.3, room: 0.35, roomHz: 450, water: 0, rumble: 0.15, step: [300, 1.0, 0.08] },
  garage:    { hum: 0.25, buzz: 0.6, room: 0.4, roomHz: 220, water: 0, rumble: 1, step: [1400, 2.5, 0.06] },
  pools:     { hum: 0.5, buzz: 0.4, room: 0.3, roomHz: 1600, water: 1, rumble: 0, step: [2200, 2.0, 0.07] },
};

export function createAudio(settings) {
  let ctx = null, master = null, nodes = null, noiseBuf = null;
  let zone = 'office', muted = false;

  function noise(seconds = 2) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    return b;
  }
  const loop = (filterType, freq, q) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return { f, g };
  };

  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    noiseBuf = noise();
    // mains hum: 60 Hz fundamental + a buzzy 120 Hz saw through a low-pass
    const hum = ctx.createGain(); hum.gain.value = 0; hum.connect(master);
    const o1 = ctx.createOscillator(); o1.frequency.value = 60; const g1 = ctx.createGain(); g1.gain.value = 0.5; o1.connect(g1).connect(hum); o1.start();
    const buzz = ctx.createGain(); buzz.gain.value = 0; buzz.connect(master);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 120;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    o2.connect(lp).connect(buzz); o2.start();
    nodes = { hum, buzz, room: loop('lowpass', 700, 0.5), water: loop('bandpass', 900, 0.6), rumble: loop('lowpass', 120, 0.8) };
    apply();
  }

  // Applies volume, zone mix and the hum switch (smoothly).
  function apply() {
    if (!ctx) return;
    const a = settings.data.audio, z = ZONE[zone], now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : a.volume, now, 0.15);
    const hum = a.hum ? 1 : 0;
    nodes.hum.gain.setTargetAtTime(0.05 * z.hum * hum, now, 0.6);
    nodes.buzz.gain.setTargetAtTime(0.012 * z.buzz * hum, now, 0.6);
    nodes.room.g.gain.setTargetAtTime(0.05 * z.room, now, 0.8);
    nodes.room.f.frequency.setTargetAtTime(z.roomHz, now, 0.8);
    nodes.water.g.gain.setTargetAtTime(0.06 * z.water, now, 0.8);
    nodes.rumble.g.gain.setTargetAtTime(0.12 * z.rumble, now, 0.8);
  }
  settings.onChange(apply);

  function burst(freq, q, dur, gain, type = 'bandpass') {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq * (0.9 + Math.random() * 0.2); f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(f).connect(g).connect(master);
    src.start(now, Math.random() * 1.5); src.stop(now + dur + 0.05);
  }
  function tone(freq, at, dur, gain) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
  }

  return {
    // Call from a user gesture; safe to call repeatedly.
    unlock() { if (!ctx) start(); else if (ctx.state === 'suspended') ctx.resume(); },
    setZone(z) { if (z !== zone && ZONE[z]) { zone = z; apply(); } },
    setMuted(m) { if (m !== muted) { muted = m; apply(); } },
    // Flickering tubes buzz harder when they drop out.
    setFlicker(v) { if (ctx && nodes && settings.data.audio.hum) nodes.buzz.gain.setTargetAtTime(0.012 * ZONE[zone].buzz * (v < 0.5 ? 2.5 : 1), ctx.currentTime, 0.02); },
    step(inWater) {
      const k = settings.data.audio.steps;                  // footstep volume (Options > Audio)
      if (k <= 0) return;
      if (inWater) { burst(1300, 0.7, 0.28, 0.35 * k); return; }
      const [f, q, d] = ZONE[zone].step; burst(f, q, d, 0.5 * k);
    },
    land() { if (settings.data.audio.steps > 0) burst(260, 0.8, 0.16, 0.7 * settings.data.audio.steps); },
    click() { burst(3200, 4, 0.03, 0.25); },
    chime() { if (!ctx || muted) return; const t = ctx.currentTime; tone(660, t, 0.9, 0.08); tone(990, t + 0.14, 1.1, 0.06); },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
}
