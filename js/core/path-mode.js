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

// shared: { renderer, camera, pipe, input, hud, mapUi, settings, progress }
export function createPathMode(shared) {
  const { renderer, camera, pipe, input, hud, mapUi, settings, progress } = shared;
  const hand = createHand();
  const sound = createPathAudio(settings);
  hand.group.visible = false; hand.spot.visible = false;
  camera.add(hand.group, hand.spot, hand.spot.target);

  let story = null, walker = null, director = null, guide = null, statues = null;
  const stepListeners = new Set();
  let sun = 0, sunWarned = 0, lightT = 0, lastLight = 1, stepMat = 'carpet', hudT = 0, lastDist = 0;

  // Builds the world (textures, layout, worker, statues…) once. Resolves when ready.
  let loading = null;
  function load() {
    if (loading) return loading;
    loading = Promise.all([import('../story/index.js'), import('../story/events.js'), import('../story/route.js'), import('../story/statues.js')])
      .then(([ix, ev, rt, st]) => {
        story = ix.createStory(renderer);
        walker = createWalker(story);
        story.onZone = (id, first) => { if (first) hud.toast(t('gp.newPlace', { place: t('gp.z.' + story.zones[id].key), time: story.zones[id].t || '' }), 4.5); };
        story.importSeen(read(KEYS.pathMap));
        director = ev.createDirector({ story, audio: sound, pipe, hand, hud, t });
        guide = rt.createGuide(story);
        statues = st.createStatues(story, story.stoneMaps);
        story.addSolids(statues.solids());
        mapUi.attach(story);
        mapUi.setGuide(guide);
        walker.onStep = () => {
          const [c, k] = story.grid.at(Math.floor(walker.x / 0.5), Math.floor(walker.z / 0.5));
          stepMat = c ? MAT_NAMES[c.fm[k]] : 'carpet';
          sound.step(stepMat);
          for (const f of stepListeners) f();
        };
        walker.onLand = () => sound.land(stepMat);
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
    walker.place(sp.x, sp.z, sp.yaw);
    story.preload(walker.x, walker.z);
    guide.set(where === 'continue' && saved ? saved.step || 0 : 0);
    director.reset(where === 'continue' ? 30 : 45);
    if (where === 'gate') story.startGate(); else story.setGate(true);
    story.setWorkLights(false);
    story.scene.add(camera);
    hand.group.visible = true; hand.setOn(true);
    mapUi.show(true); mapUi.setOpen(false);
    sound.unlock(); sound.resume(); sound.reset(where === 'continue' ? 15 : 25);
    sun = 0; sunWarned = 0; pipe.heat = 0; lastDist = 0;
    const k = settings.data.keys;
    hud.setHint(t('hud.pathHint', { move: moveLabel(k), light: firstKey(k, 'flashlight'), work: firstKey(k, 'workLights'), map: firstKey(k, 'map'), guide: firstKey(k, 'guide') }), 14);
  }
  // Leave the world (back to the menu).
  function leave() {
    hand.group.visible = false; hand.spot.visible = false;
    mapUi.show(false); hud.setSign(null); hud.setGoal(null);
    sound.suspend();
    if (story) story.scratchVisual(null);
    pipe.heat = 0; pipe.fear = 0; pipe.glitch = 0;
    if (director) director.reset();
    if (guide) guide.hide();
    stepListeners.clear();
  }
  // Saved state of the walk (progress.path) and the explored map.
  function remember() {
    progress.path = { x: +walker.x.toFixed(2), z: +walker.z.toFixed(2), yaw: +walker.yaw.toFixed(3), seen: [...story.visited.keys()], step: guide ? guide.step : 0 };
    if (story.seenDirty) write(KEYS.pathMap, story.exportSeen());
  }
  function teleport(x, z) {
    walker.place(x, z, walker.yaw);
    story.preload(x, z);
    mapUi.setOpen(false); input.clear(); input.lock();
    pipe.glitch = 0.8; sound.staticBurst(0.25);
    hud.toast(t('map.teleported'), 2);
  }
  mapUi.onTeleport = (x, z) => teleport(x, z);

  // Keys of this world. Returns true when handled.
  function onPress(act) {
    if (act === 'flashlight') hand.setOn(!hand.spot.visible);
    else if (act === 'workLights') { story.setWorkLights(!story.workLights); hud.toast(t(story.workLights ? 'hud.workOn' : 'hud.workOff'), 2); }
    else if (act === 'guide') { settings.update((d) => { d.story.guide = !d.story.guide; }); hud.toast(t(settings.data.story.guide ? 'hud.guideOn' : 'hud.guideOff'), 2); }
    else if (act === 'map') { const o = !mapUi.open; mapUi.setOpen(o); input.clear(); if (o) input.unlock(); else input.lock(); }
    else return false;
    return true;
  }

  // One frame. ctl: walker controls (or the "still" controls when not walking).
  function frame(dt, t0, walking, ctl, onReached) {
    // the sun through the glass: standing in it slowly burns (story 05:40-05:58)
    const sunHere = story.sunAt(walker.x, walker.z);
    if (walking) sun = sunHere > 0 ? Math.min(1, sun + dt * sunHere / 14) : Math.max(0, sun - dt / 5);
    pipe.heat = sun;
    if (sunHere > 0 && sun > 0.3 && sunWarned < 1) { sunWarned = 1; hud.toast(t('gp.sunWarm'), 4); }
    if (sunHere > 0 && sun > 0.75 && sunWarned < 2) { sunWarned = 2; hud.toast(t('gp.sunBurn'), 4); }
    if (sun < 0.1) sunWarned = 0;
    if (walking && sun > 0.6) ctl = { ...ctl, move: { x: ctl.move.x * (1.6 - sun), z: ctl.move.z * (1.6 - sun) }, sprint: false };
    walker.update(dt, ctl, settings.data.mouse);
    if (walking) { progress.dist += walker.dist - lastDist; lastDist = walker.dist; }
    // story guide
    const showGuide = settings.data.story.guide;
    const reached = guide.update(walking ? dt : 0, walker, showGuide);
    if (reached) { hud.toast(t('gp.reached', { time: reached.t, place: t('gp.s.' + reached.key) }) + '\n' + t('gp.sd.' + reached.key), 9); onReached(); }
    story.stream(walker.x, walker.z, 1);
    story.update(dt, t0, walker);
    statues.update(walker);
    // camera (with event shake) and the far plane at the fog distance (nothing beyond is visible)
    const eye = walker.eye(settings.data.gfx.headBob);
    camera.position.set(eye.x + director.shake.x, eye.y + director.shake.y, eye.z);
    camera.rotation.set(walker.pitch, walker.yaw, 0);
    const far = story.scene.fog.far + 6;
    if (Math.abs(camera.far - far) > 2) { camera.far = far; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    hand.fit(camera.fov);
    hand.sway(t0, walker.bob, walker.bobAmp);
    lightT -= dt;
    if (lightT <= 0) { lightT = 0.2; lastLight = story.lightAt(walker.x, eye.y - 0.3, walker.z) * (story.workLights ? 2 : 1) * (0.1 + 0.9 * story.power); hand.setLight(lastLight + (hand.spot.visible ? 0.15 : 0)); }
    // sound (more scratching along the Great Path and the West Path) and scary events
    const zk = (story.zones[story.zone] || {}).key;
    sound.update(walking ? dt : 0, camera, zk, story.emittersNear(walker), () => story.pickSkylight(walker), zk === 'greatPath' || zk === 'westPath');
    story.scratchVisual(sound.active);
    director.update(walking ? dt : 0, {
      walker, zone: zk, moving: walker.moving, light: lastLight, flashOn: hand.spot.visible, stepMat,
      enabled: settings.data.story.events, addStepListener: (f) => stepListeners.add(f), removeStepListener: (f) => stepListeners.delete(f),
    });
    pipe.render(story.scene, camera);
    mapUi.update(dt, walker);
    // HUD: the note being read, the place line, the guide arrow
    const sg = walking ? story.signNear(walker, -Math.sin(walker.yaw), -Math.cos(walker.yaw)) : null;
    hud.setSign(sg ? story.signText(sg) : null);
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      const zd = story.zones[story.zone] || story.zones[0];
      hud.setLine(t('hud.pathLine', { zone: t('gp.z.' + zd.key), time: zd.t || '—', m: Math.round(walker.dist) }) + (story.workLights ? t('hud.workTag') : ''));
    }
    if (showGuide && walking && guide.target) {
      const hd = guide.heading(walker);
      if (hd) hud.setGoal(t('hud.goal', { time: guide.target.t, place: t('gp.s.' + guide.target.key), m: Math.round(hd.dist) }), hd.ang - walker.yaw);
    } else if (showGuide && walking && guide.done) hud.setGoal(t('hud.goalDone'), null);
    else hud.setGoal(null);
  }

  return {
    load, start, leave, remember, teleport, onPress, frame,
    pause() { sound.suspend(); },
    resume() { sound.resume(); },
    info: () => ({ path: true, zone: story.zones[story.zone].key, time: story.zones[story.zone].t || '—', dist: walker.dist, places: story.visited.size, total: story.zones.length - 1 }),
    clearSeen() { if (story) for (const c of story.grid.chunks.values()) { c.seen.fill(0); c.seenV = (c.seenV || 0) + 1; } },
    get ready() { return !!story; }, get story() { return story; }, get walker() { return walker; }, get guide() { return guide; },
    get director() { return director; }, get statues() { return statues; }, hand, sound,
    get loadedCount() { return story ? story.loadedCount : 0; },
  };
}
