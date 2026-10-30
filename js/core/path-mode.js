// The Great Path world as a game mode: builds the world on first use (story/*), and owns what happens while you
// walk there — the walker and flashlight, sun exposure, the story guide, statues, sound, scary events, reading
// notes, the map, teleporting, and the HUD lines of this world. The app shell (core/app.js) switches to it.
import { moveLabel, firstKey } from '../input/bindings.js';
import { read, write, KEYS } from './storage.js';
import { t } from '../i18n/index.js';
import { createWalker } from '../story/walker.js';
import { createHand } from '../story/hand.js';
import { createPathAudio } from '../story/audio.js';
import { MAT_NAMES } from '../story/textures.js';
import { nextPaint } from '../ui/loader.js';

// zones with scripted events of their own (no random scares there)
const SCRIPTED = new Set(['gpBlackout', 'gpSqueeze', 'gpRound', 'gpMirror']);
const STEPS_END = 999;

// shared: { renderer, camera, pipe, input, hud, mapUi, settings, progress }
export function createPathMode(shared) {
  const { renderer, camera, pipe, input, hud, mapUi, settings, progress } = shared;
  const hand = createHand();
  const sound = createPathAudio(settings);
  hand.group.visible = false; hand.spot.visible = false;
  camera.add(hand.group, hand.spot, hand.spot.target);

  let story = null, walker = null, director = null, guide = null, statues = null;
  let journey = null, surface = null, epilogue = null, SY = 0, onSurface = false, readT = 0, inscRead = false;
  const stepListeners = new Set();
  let sun = 0, sunWarned = 0, lightT = 0, lastLight = 1, stepMat = 'carpet', hudT = 0, lastDist = 0;

  // Builds the world (textures, layout, worker, statues…) once, in steps; stage(key, fraction) reports progress and
  // gets a paint in between. Resolves when ready.
  let loading = null;
  function load(stage = () => {}) {
    if (loading) return loading;
    stage('load.code', 0.05);
    loading = Promise.all([import('../story/index.js'), import('../story/events.js'), import('../story/route.js'), import('../story/statues.js'),
      import('../story/journey-run.js'), import('../story/surface.js'), import('../story/epilogue.js'), import('../story/journey.js')])
      .then(async ([ix, ev, rt, st, jr, sf, ep, jy]) => {
        stage('load.world', 0.25); await nextPaint();
        story = ix.createStory(renderer);
        stage('load.details', 0.7); await nextPaint();
        walker = createWalker(story);
        story.onZone = (id, first) => { if (first) hud.toast(t('gp.newPlace', { place: t('gp.z.' + story.zones[id].key), time: story.zones[id].t || '' }), 4.5); };
        story.importSeen(read(KEYS.pathMap));
        director = ev.createDirector({ story, audio: sound, pipe, hand, hud, t });
        guide = rt.createGuide(story);
        statues = st.createStatues(story, story.stoneMaps);
        // statues are not solid: you walk through them (they stand in passages)
        mapUi.attach(story);
        mapUi.setGuide(guide);
        walker.onStep = () => {
          const [c, k] = story.grid.at(Math.floor(walker.x / 0.5), Math.floor(walker.z / 0.5));
          stepMat = c ? MAT_NAMES[c.fm[k]] : 'carpet';
          sound.step(stepMat);
          for (const f of stepListeners) f();
        };
        walker.onLand = (v) => { sound.land(stepMat); if (v > 10) { director.shake.k = 0.05; pipe.glitch = 0.3; hud.toast(t('gp.j.fall'), 4); } };
        journey = jr.createJourney({ story, walker, hand, sound, pipe, hud, t, progress });
        stage('load.surface', 0.85); await nextPaint();
        surface = sf.createSurface(story.materials);
        epilogue = ep.createEpilogue();
        SY = jy.SURFACE_Y;
      });
    loading.catch(() => { loading = null; });
    return loading;
  }

  // Enter the world. where: 'gate' (the story starts there, as in the film) | 'hub' | 'wastes' | 'continue'
  function start(where) {
    const saved = progress.path;
    let sp = story.starts[where] || story.starts.gate;
    if (where === 'continue' && saved) { sp = saved; for (const id of saved.seen) story.visited.set(id, story.visited.size + 1); }
    else story.resetVisits();
    const js = (where === 'continue' && saved && saved.j) || {};
    setSurface(!!js.surface, true);
    inscRead = !!js.read; readT = 0;
    walker.place(sp.x, sp.z, sp.yaw);
    story.preload(walker.x, walker.z);
    guide.set(where === 'continue' && saved ? saved.step || 0 : 0);
    director.reset(where === 'continue' ? 30 : 45);
    journey.reset();
    if (where === 'gate') story.startGate(); else story.setGate(true);
    story.setWorkLights(false);
    (onSurface ? surface.scene : story.scene).add(camera);
    hand.group.visible = true; hand.setOn(true);
    mapUi.show(true); mapUi.setOpen(false);
    sound.unlock(); sound.resume(); sound.reset(where === 'continue' ? 15 : 25);
    sun = 0; sunWarned = 0; pipe.heat = 0; lastDist = 0;
    const k = settings.data.keys;
    hud.setHint(t('hud.pathHint', { move: moveLabel(k), light: firstKey(k, 'flashlight'), work: firstKey(k, 'workLights'), map: firstKey(k, 'map'), guide: firstKey(k, 'guide'), use: firstKey(k, 'use') }), 14);
  }
  // Leave the world (back to the menu).
  function leave() {
    hand.group.visible = false; hand.spot.visible = false;
    mapUi.show(false); hud.setSign(null); hud.setGoal(null); hud.setPrompt(null); hud.setFade(null, 0);
    if (epilogue) epilogue.stop();
    if (onSurface) setSurface(false);
    sound.suspend();
    if (story) story.scratchVisual(null);
    pipe.heat = 0; pipe.fear = 0; pipe.glitch = 0;
    if (director) director.reset();
    if (guide) guide.hide();
    stepListeners.clear();
  }
  // Saved state of the walk (progress.path) and the explored map.
  function remember() {
    progress.path = { x: +walker.x.toFixed(2), z: +walker.z.toFixed(2), yaw: +walker.yaw.toFixed(3), seen: [...story.visited.keys()], step: guide ? guide.step : 0,
      j: { ...journey.save(), surface: onSurface, read: inscRead } };
    if (story.seenDirty) write(KEYS.pathMap, story.exportSeen());
  }
  // the roof over the halls: its own scene and its own ground for the walker
  function setSurface(on, quiet) {
    if (!surface || on === onSurface) return;
    onSurface = on;
    walker.world = on ? surface.world : story;
    (on ? surface.scene : story.scene).add(camera);
    if (on && !quiet) hud.toast(t('gp.j.roof'), 6);
  }
  // The nearest spot where a person can stand: an open cell with a floor under it (not open sky, not a pit) and room
  // to stand, and no prop collider in the way. Teleport targets (place labels) can lie on walls or above drops.
  function standable(x, z) {
    const g = story.grid, CS = 0.5, gx0 = Math.floor(x / CS), gz0 = Math.floor(z / CS);
    const ok = (gx, gz) => {
      const [c, k] = g.at(gx, gz);
      if (!c || !c.open[k] || (c.flags[k] & 32) || c.ceil[k] - c.floor[k] < 0.7) return false;   // 32 = F.OUT; low places: you crawl
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const [n, nk] = g.at(gx + dx, gz + dz); if (!n || !n.open[nk] || Math.abs(n.floor[nk] - c.floor[k]) > 0.45) return false; }
      const px = (gx + 0.5) * CS, pz = (gz + 0.5) * CS, f = c.floor[k];
      return !story.blocked(px - 0.27, pz - 0.27, px + 0.27, pz + 0.27, f + 0.05, f + Math.min(1.75, c.ceil[k] - f - 0.02));
    };
    for (let r = 0; r <= 80; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (ok(gx0 + dx, gz0 + dz)) return { x: (gx0 + dx + 0.5) * CS, z: (gz0 + dz + 0.5) * CS };
    }
    return null;
  }
  let safe = null;                      // the last place the walker stood on the ground (fall rescue)
  function teleport(x, z) {
    if (onSurface) setSurface(false, true);
    const p = standable(x, z);
    if (!p) return;
    x = p.x; z = p.z;
    walker.place(x, z, walker.yaw);
    story.preload(x, z);
    mapUi.setOpen(false); input.clear(); input.lock();
    pipe.glitch = 0.8; sound.staticBurst(0.25);
    hud.toast(t('map.teleported'), 2);
  }
  mapUi.onTeleport = (x, z) => teleport(x, z);

  // Keys of this world. Returns true when handled.
  function onPress(act) {
    if (epilogue && epilogue.active) return true;
    if (act === 'flashlight') { if (journey && journey.flashBlocked) hud.toast(t('gp.j.noBattery'), 2); else hand.setOn(!hand.spot.visible); }
    else if (act === 'use') {
      if (onSurface && inscRead && !surface.underDome(walker)) { epilogue.start(); mapUi.show(false); hud.setPrompt(null); hud.setSign(null); hud.setGoal(null); }
      else journey.use();
    }
    else if (act === 'workLights') { story.setWorkLights(!story.workLights); hud.toast(t(story.workLights ? 'hud.workOn' : 'hud.workOff'), 2); }
    else if (act === 'guide') { settings.update((d) => { d.story.guide = !d.story.guide; }); hud.toast(t(settings.data.story.guide ? 'hud.guideOn' : 'hud.guideOff'), 2); }
    else if (act === 'map') { const o = !mapUi.open; mapUi.setOpen(o); input.clear(); if (o) input.unlock(); else input.lock(); }
    else return false;
    return true;
  }

  // One frame. ctl: walker controls (or the "still" controls when not walking).
  function frame(dt, t0, walking, ctl, onReached) {
    if (epilogue.active) { cutScene(dt); return; }
    // the sun through the glass: standing in it slowly burns (story 05:40-05:58); on the roof it does not (1:47:52)
    const sunHere = onSurface ? 0 : story.sunAt(walker.x, walker.z);
    if (walking) sun = sunHere > 0 ? Math.min(1, sun + dt * sunHere / 14) : Math.max(0, sun - dt / 5);
    pipe.heat = sun;
    if (sunHere > 0 && sun > 0.3 && sunWarned < 1) { sunWarned = 1; hud.toast(t('gp.sunWarm'), 4); }
    if (sunHere > 0 && sun > 0.75 && sunWarned < 2) { sunWarned = 2; hud.toast(t('gp.sunBurn'), 4); }
    if (sun < 0.1) sunWarned = 0;
    if (walking && sun > 0.6) ctl = { ...ctl, move: { x: ctl.move.x * (1.6 - sun), z: ctl.move.z * (1.6 - sun) }, sprint: false };
    walker.update(dt, ctl, settings.data.mouse);
    // fall rescue: never fall out of the world (the deepest floor is about −40 m)
    if (walker.ground && !onSurface) safe = { x: walker.x, z: walker.z };
    if (walker.y < -60 && !onSurface) { const p = standable(safe ? safe.x : 0, safe ? safe.z : 7) || { x: 0, z: 7 }; walker.place(p.x, p.z, walker.yaw); story.preload(p.x, p.z); pipe.glitch = 0.6; }
    if (walking) { progress.dist += walker.dist - lastDist; lastDist = walker.dist; }
    // story guide
    const showGuide = settings.data.story.guide;
    const reached = guide.update(walking ? dt : 0, walker, showGuide);
    if (reached) { hud.toast(t('gp.reached', { time: reached.t, place: t('gp.s.' + reached.key) }) + '\n' + t('gp.sd.' + reached.key), 9); onReached(); }
    // climbing out of a stair hole onto the roof, or back down
    const hole = journey.holeAt(walker.x, walker.z);
    if (!onSurface && hole && walker.y >= SY - 0.65) setSurface(true);
    else if (onSurface && hole && walker.y < SY - 0.9) setSurface(false);
    story.stream(walker.x, walker.z, 1);
    if (!onSurface) story.update(dt, t0, walker); else surface.update(dt, t0, walker);
    statues.update(walker);
    const promptKey = onSurface ? (inscRead && !surface.underDome(walker) ? 'gp.j.lie' : null) : journey.update(dt, walking, { move: ctl.move, shake: director.shake });
    const k = settings.data.keys;
    hud.setPrompt(promptKey && walking ? t(promptKey, { key: firstKey(k, 'use') }) : null);
    // camera (with event shake) and the far plane at the fog distance (nothing beyond is visible)
    const eye = walker.eye(settings.data.gfx.headBob);
    camera.position.set(eye.x + director.shake.x, eye.y + director.shake.y, eye.z);
    camera.rotation.set(walker.pitch, walker.yaw, 0);
    const far = onSurface ? 700 : story.scene.fog.far + 6;
    if (Math.abs(camera.far - far) > 2) { camera.far = far; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    hand.fit(camera.fov);
    hand.sway(t0, walker.bob, walker.bobAmp);
    lightT -= dt;
    if (lightT <= 0) { lightT = 0.2; lastLight = onSurface ? 1.6 : story.lightAt(walker.x, eye.y - 0.3, walker.z) * (story.workLights ? 2 : 1) * (0.1 + 0.9 * story.power); hand.setLight(lastLight + (hand.spot.visible ? 0.15 : 0)); }
    // sound (more scratching along the Great Path and the West Path) and scary events
    const zk = onSurface ? 'surface' : (story.zones[story.zone] || {}).key;
    sound.update(walking ? dt : 0, camera, zk, story.emittersNear(walker), () => story.pickSkylight(walker), zk === 'greatPath' || zk === 'westPath');
    story.scratchVisual(sound.active);
    director.update(walking ? dt : 0, {
      walker, zone: zk, moving: walker.moving, light: lastLight, flashOn: hand.spot.visible, stepMat,
      enabled: settings.data.story.events && !onSurface && !SCRIPTED.has(zk), addStepListener: (f) => stepListeners.add(f), removeStepListener: (f) => stepListeners.delete(f),
    });
    pipe.render(onSurface ? surface.scene : story.scene, camera);
    mapUi.update(dt, walker);
    // HUD: the note being read (on the roof: the inscription under the dome), the place line, the guide arrow
    if (onSurface) {
      const under = walking && surface.underDome(walker);
      hud.setSign(under ? t('gp.j.inscription') : null);
      if (under) { readT += dt; if (readT > 4) inscRead = true; }
    } else {
      const sg = walking ? story.signNear(walker, -Math.sin(walker.yaw), -Math.cos(walker.yaw)) : null;
      hud.setSign(sg ? story.signText(sg) : null);
    }
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      const zd = onSurface ? { key: 'surface', t: '1:47:27' } : story.zones[story.zone] || story.zones[0];
      hud.setLine(t('hud.pathLine', { zone: t('gp.z.' + zd.key), time: zd.t || '—', m: Math.round(walker.dist) }) + (story.workLights ? t('hud.workTag') : ''));
    }
    if (showGuide && walking && guide.target) {
      const hd = guide.heading(walker);
      if (hd) hud.setGoal(t('hud.goal', { time: guide.target.t, place: t('gp.s.' + guide.target.key), m: Math.round(hd.dist) }), hd.ang - walker.yaw);
    } else if (showGuide && walking && guide.done) hud.setGoal(t('hud.goalDone'), null);
    else hud.setGoal(null);
  }

  // the ending (1:51:47): the epilogue renders instead of the world; afterwards you lie on the roof again
  function cutScene(dt) {
    const r = epilogue.update(dt, camera.aspect);
    if (r.line) hud.toast(t(r.line), 8);
    hud.setFade(r.fade[0], r.fade[1]);
    hud.setGoal(null); hud.setSign(null); hud.setPrompt(null);
    sound.update(dt, camera, 'surface', [], () => null, false);
    pipe.heat = 0;
    pipe.render(r.scene, epilogue.camera);
    if (r.done) { hud.setFade(null, 0); hud.toast(t('gp.e.end'), 10); guide.set(STEPS_END); mapUi.show(true); }
  }

  return {
    load, start, leave, remember, teleport, onPress, frame,
    get onSurface() { return onSurface; }, get journey() { return journey; }, get surface() { return surface; }, get epilogue() { return epilogue; },
    pause() { sound.suspend(); },
    resume() { sound.resume(); },
    info: () => ({ path: true, zone: story.zones[story.zone].key, time: story.zones[story.zone].t || '—', dist: walker.dist, places: story.visited.size, total: story.zones.length - 1 }),
    clearSeen() { if (story) for (const c of story.grid.chunks.values()) { c.seen.fill(0); c.seenV = (c.seenV || 0) + 1; } },
    get ready() { return !!story; }, get story() { return story; }, get walker() { return walker; }, get guide() { return guide; },
    get director() { return director; }, get statues() { return statues; }, hand, sound,
    get loadedCount() { return story ? story.loadedCount : 0; },
  };
}
