// Scary events in the Great Path world (no people, nothing ever seen clearly): the director waits a random time
// that depends on the place, then picks an event that fits where you are. Each event combines sound, light and
// screen effects. Dread builds up while you stand in the dark without the flashlight (heartbeat, closing edges).
const ZONE_LEVEL = {
  plaza: 0.15, cafeteria: 0.2, guild: 0.15, seniorOffice: 0.3, library: 0.35, machine: 0.5, court: 0.2, gardens: 0.2, market: 0.2,
  factory: 0.45, offices: 0.35, avenue: 0.3, ring1: 0.7, mine: 1.0, ring2: 0.75, gate: 0.4, booth: 0.6, wastes: 0.8, cluster: 1.0,
  doors: 1.1, deadend: 1.2, blue: 0.9, chapel: 0.5, greatPath: 0.75, westPath: 0.85,
};

export function createDirector({ story, audio, pipe, hand, hud, t }) {
  let next = 40, cooldown = 0, current = null, dark = 0, beatT = 0, glitchT = 0;
  const shake = { x: 0, y: 0, k: 0 };
  const recent = [];                     // avoid repeating the same event

  const fwd = (w) => ({ x: -Math.sin(w.yaw), z: -Math.cos(w.yaw) });
  const at = (w, ahead, side, y) => { const f = fwd(w); return { x: w.x + f.x * ahead + f.z * side, y, z: w.z + f.z * ahead - f.x * side }; };

  /* ---- events: test(ctx) -> bool, start(ctx) -> { update(dt) -> done? } ---- */
  const EVENTS = {
    // the lights die, buzz, and come back
    powerCut: {
      w: 1, test: (c) => story.power > 0.9 && !['chapel', 'mine'].includes(c.zone),
      start() {
        audio.clunk(); let t0 = 0; const hold = 3 + Math.random() * 4;
        return { update(dt) {
          t0 += dt;
          let k;
          if (t0 < 0.5) k = Math.random() < 0.5 ? 0.15 : 0.8;            // flicker down
          else if (t0 < 0.5 + hold) k = 0.08;
          else if (t0 < 1.4 + hold) k = Math.random() < 0.5 ? 0.2 : 1;     // flicker back
          else { story.setPower(1); audio.setPower(1); return true; }
          story.setPower(k); audio.setPower(k);
          return false;
        } };
      },
    },
    // footsteps behind you that copy your pace and stop when you turn around
    followed: {
      w: 1, test: (c) => c.moving && !['plaza', 'cafeteria', 'market'].includes(c.zone),
      start(c) {
        let t0 = 0, steps = 0; const yaw0 = c.walker.yaw, dur = 7 + Math.random() * 5;
        const onStep = () => {
          const p = at(c.walker, -6 - Math.random() * 2, (Math.random() - 0.5) * 0.6, c.walker.y + 0.05);
          audio.shot('step', p, { mat: c.stepMat, delay: 0.18 + Math.random() * 0.08 }); steps++;
        };
        c.addStepListener(onStep);
        return { update(dt) {
          t0 += dt;
          let d = Math.abs(((c.walker.yaw - yaw0 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
          if (t0 > dur || d > 2.2) { c.removeStepListener(onStep); if (steps > 2 && d <= 2.2) audio.shot('step', at(c.walker, -5, 0, c.walker.y), { mat: c.stepMat }); return true; }
          return false;
        } };
      },
    },
    // a door slams somewhere far away
    doorSlam: {
      w: 1, test: () => true,
      start(c) {
        const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 12;
        audio.shot('door', { x: c.walker.x + Math.cos(a) * d, y: c.walker.y + 1.2, z: c.walker.z + Math.sin(a) * d }, { ref: 4 });
        return null;
      },
    },
    // three knocks from inside the nearest wall
    knocks: {
      w: 1, test: (c) => !!story.wallNear(c.walker),
      start(c) { const wpt = story.wallNear(c.walker); audio.shot('knock', { x: wpt.x, y: c.walker.y + 1.3, z: wpt.z }); return null; },
    },
    // something runs across, above the ceiling; dust falls where it passes
    ceilingRun: {
      w: 1, test: (c) => story.ceilAt(c.walker.x, c.walker.z) < c.walker.y + 4 && !['chapel'].includes(c.zone),
      start(c) {
        const y = story.ceilAt(c.walker.x, c.walker.z) + 0.4;
        const a = at(c.walker, 6, -5, y), b = at(c.walker, -7, 6, y), sec = 2.2 + Math.random();
        audio.run(a, b, sec);
        let t0 = 0, dropped = 0;
        return { update(dt) {
          t0 += dt;
          const k = Math.min(1, t0 / sec);
          if (dropped < 5 && k > dropped / 5) { dropped++; story.particles('dust', a.x + (b.x - a.x) * k, y - 0.45, a.z + (b.z - a.z) * k, 40); }
          return t0 > sec;
        } };
      },
    },
    // a nearby tube bursts in sparks
    lampPop: {
      w: 0.8, test: (c) => !!story.nearestLamp(c.walker, 9, fwd(c.walker)),
      start(c) {
        const l = story.nearestLamp(c.walker, 9, fwd(c.walker));
        audio.shot('pop', { x: l.x, y: l.y, z: l.z });
        story.flash(l.x, l.y - 0.2, l.z, 0xfff0c8, 14);
        story.particles('spark', l.x, l.y - 0.1, l.z, 50);
        glitchT = 0.15;
        return null;
      },
    },
    // the flashlight fails for a few seconds
    flashFail: {
      w: 0.8, test: (c) => c.flashOn && c.light < 0.25,
      start() {
        let t0 = 0; const dur = 2.5 + Math.random() * 2.5;
        audio.staticBurst(0.15);
        return { update(dt) {
          t0 += dt;
          if (t0 > dur) { hand.setOn(true); return true; }
          hand.setOn(t0 < 0.6 ? Math.random() < 0.4 : t0 > dur - 0.5 ? Math.random() < 0.5 : false);
          return false;
        }, end() { hand.setOn(true); } };
      },
    },
    // the Vibra-cable twangs three times: the signal (story 14:09)
    cableSignal: {
      w: 2, test: (c) => c.zone === 'wastes' && Math.abs(c.walker.x) < 2 && c.walker.z > 162 && c.walker.z < 380,
      start(c) { audio.shot('twang', { x: -1.45, y: 1.35, z: c.walker.z + 3 }); return null; },
    },
    // the structure groans; dust from the ceiling; the view shakes
    groan: {
      w: 1, test: (c) => ['mine', 'ring1', 'deadend', 'chapel', 'cluster'].includes(c.zone),
      start(c) {
        audio.shot(c.zone === 'mine' ? 'rumble' : 'creak', { x: c.walker.x + 3, y: c.walker.y + 2.5, z: c.walker.z - 2 }, { ref: 4 });
        let t0 = 0; const dur = c.zone === 'mine' ? 3 : 1.6;
        for (let k = 0; k < 3; k++) { const p = at(c.walker, 1 + Math.random() * 4, (Math.random() - 0.5) * 4, 0); story.particles('dust', p.x, story.ceilAt(p.x, p.z) - 0.05, p.z, 50); }
        return { update(dt) { t0 += dt; shake.k = Math.max(shake.k, (c.zone === 'mine' ? 0.025 : 0.01) * Math.sin(Math.min(1, t0 / dur) * Math.PI)); return t0 > dur; } };
      },
    },
    // the picture tears like a bad tape, with static
    glitch: {
      w: 0.6, test: (c) => ['doors', 'deadend', 'blue', 'cluster', 'machine'].includes(c.zone),
      start() { audio.staticBurst(0.5); glitchT = 0.6; return null; },
    },
  };

  function pick(c) {
    const opts = [];
    for (const [k, e] of Object.entries(EVENTS)) if (!recent.includes(k) && e.test(c)) opts.push([k, e.w]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
    return opts[0][0];
  }

  return {
    shake,
    reset(first = 35) { next = first + Math.random() * 20; cooldown = 0; if (current && current.end) current.end(); current = null; dark = 0; recent.length = 0; story.setPower(1); audio.setPower(1); },
    // force an event (tests)
    trigger(name, c) { const s = EVENTS[name].start(c); if (s) current = s; return !!s; },
    // c: { walker, zone, moving, light (0..), flashOn, stepMat, addStepListener, removeStepListener, enabled }
    update(dt, c) {
      // screen effects decay
      glitchT = Math.max(0, glitchT - dt);
      pipe.glitch = glitchT > 0 ? 0.6 + Math.random() * 0.4 : 0;
      shake.k *= Math.exp(-dt * 3);
      shake.x = (Math.random() - 0.5) * shake.k; shake.y = (Math.random() - 0.5) * shake.k;
      // dread in the dark: heartbeat and closing edges
      const inDark = c.light < 0.08 && !c.flashOn && dt > 0;
      dark = inDark ? Math.min(1, dark + dt / 10) : Math.max(0, dark - dt / 3);
      beatT -= dt;
      if (dark > 0.3 && beatT <= 0) { beatT = 1.3 - dark * 0.6; audio.heartbeat(dark); pipe.fear = dark * 0.9; }
      else pipe.fear = Math.max(dark * 0.5, pipe.fear - dt * 0.6);
      if (current) { if (current.update(dt)) current = null; return; }
      if (!c.enabled || dt === 0) return;
      cooldown -= dt; next -= dt * (ZONE_LEVEL[c.zone] ?? 0.3);
      if (next > 0 || cooldown > 0) return;
      next = 45 + Math.random() * 60; cooldown = 20;
      const k = pick(c);
      if (!k) return;
      recent.push(k); if (recent.length > 3) recent.shift();
      const s = EVENTS[k].start(c);
      if (s) current = s;
    },
  };
}
