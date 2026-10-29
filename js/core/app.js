// Application shell: renderer, both worlds, players, audio, UI, multiplayer session and the frame loop.
// Worlds ('kind'): 'endless' (procedural liminal spaces) and 'path' (the Great Path / Luceron, built on demand).
// Modes: 'menu' (start screen with a slowly turning view of a generated place) and 'play' (a walk), with pause.
import * as THREE from '../../vendor/three.module.js';
import { PixelPipeline } from '../render/pixel-pipeline.js';
import { createWorld } from '../world/index.js';
import { createPlayer } from '../world/player.js';
import { Input } from '../input/input.js';
import { moveLabel, firstKey } from '../input/bindings.js';
import { createSettings } from './settings.js';
import { read, write, KEYS } from './storage.js';
import { randomSeed, seedFrom } from './util.js';
import { setLang, onLang, t } from '../i18n/index.js';
import { createHud } from '../ui/hud.js';
import { createMenu } from '../ui/menu.js';
import { createAudio } from '../audio/audio.js';
import { createSession } from '../net/session.js';
import { VERSION } from '../version.js';
import { createWalker } from '../story/walker.js';
import { createHand } from '../story/hand.js';
import { createMapUi } from '../ui/map.js';
import { createScratches } from '../story/sounds.js';

const MENU_SEED = 20251031;
const TITLE = 'Liminal Spaces — Endless Liminal Space Exploration Game';

export function createApp({ appEl, uiEl }) {
  const settings = createSettings();
  setLang(settings.data.lang);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  appEl.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 140);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // flashlight: a spot light carried by the camera (casts shadows)
  const flash = new THREE.SpotLight(0xfff1d6, 9, 26, 0.48, 0.55, 1.4);
  flash.position.set(0.18, -0.15, 0);
  flash.target.position.set(0.1, -0.2, -1);
  flash.castShadow = true;
  flash.shadow.mapSize.set(1024, 1024);
  flash.shadow.bias = -0.0004; flash.shadow.normalBias = 0.03; flash.shadow.camera.near = 0.15;
  camera.add(flash, flash.target);
  flash.visible = false;
  // Great Path world: created the first time it is opened (textures and layout take a moment)
  let story = null, walker = null, kind = 'endless';
  const hand = createHand();
  const scratches = createScratches(settings);
  let sun = 0, sunWarned = 0;                 // sun exposure under skylights (0..1)
  hand.group.visible = false;
  camera.add(hand.group, hand.spot, hand.spot.target);
  hand.spot.visible = false;

  const input = new Input(canvas, settings);
  const pipe = new PixelPipeline(renderer);
  const audio = createAudio(settings);
  const player = createPlayer();
  player.onStep = (wet) => audio.step(wet);
  player.onLand = () => audio.land();

  /* ---- persistent progress: totals and the last single-player walk ---- */
  const progress = {
    dist: 0, odd: 0, last: null, path: null,
    save() { write(KEYS.save, { dist: Math.round(this.dist), odd: this.odd, last: this.last, path: this.path }); },
    load() {
      const d = read(KEYS.save);
      if (!d || typeof d !== 'object') return;
      this.dist = Math.max(0, +d.dist || 0);
      this.odd = Math.max(0, Math.floor(+d.odd) || 0);
      const l = d.last;
      this.last = l && Number.isInteger(l.seed) && [l.x, l.z, l.yaw].every(Number.isFinite) ? { seed: l.seed, x: l.x, z: l.z, yaw: l.yaw } : null;
      const p = d.path;
      this.path = p && [p.x, p.z, p.yaw].every(Number.isFinite) && Math.abs(p.x) < 1e7 && Math.abs(p.z) < 1e7
        ? { x: p.x, z: p.z, yaw: p.yaw, seen: Array.isArray(p.seen) ? p.seen.filter((n) => Number.isInteger(n) && n > 0 && n < 64).slice(0, 64) : [] } : null;
    },
    wipe() {
      this.dist = 0; this.odd = 0; this.last = null; this.path = null; this.save(); write(KEYS.pathMap, null);
      if (story) for (const c of story.grid.chunks.values()) { c.seen.fill(0); c.seenV = (c.seenV || 0) + 1; }
      menu.refresh();
    },
  };
  progress.load();

  /* ---- state ---- */
  let mode = 'menu', paused = false, seed = MENU_SEED, session = null, hudOn = settings.data.hud.show;
  let lockPauseAt = 0, lastDist = 0, saveT = 0, poseT = 0;
  const hud = createHud(uiEl);
  const mapUi = createMapUi(uiEl);

  world.onFind = (kind) => {
    progress.odd++;
    audio.chime();
    hud.toast(t('hud.found', { what: t('odd.' + kind) }));
  };

  function closeSession() {
    if (session) { session.close(); session = null; }
    world.avatars.clear();
  }

  // Starts a walk in the world of `seed`. spawn: { x, z, yaw } or null for the world's spawn point.
  function startWalk(s, spawn, sess = null) {
    useWorld('endless');
    if (session && session !== sess) closeSession();
    session = sess;
    seed = s;
    world.setSeed(seed);
    const sp = spawn || { ...world.gen.spawn, yaw: 0 };
    player.place(sp.x, sp.z, sp.yaw || 0);
    world.setViewDist(settings.data.gfx.viewDist);
    world.preload(player.x, player.z);
    mode = 'play'; paused = false; lastDist = 0;
    input.clear(); menu.hide();
    audio.unlock(); audio.setMuted(false);
    input.lock();
    const k = settings.data.keys;
    hud.setHint(t('hud.hint', { move: moveLabel(k), run: firstKey(k, 'sprint'), jump: firstKey(k, 'jump'), light: firstKey(k, 'flashlight') }));
    rememberWalk();
  }
  function rememberWalk() {
    if (mode === 'play' && kind === 'path') {
      progress.path = { x: +walker.x.toFixed(2), z: +walker.z.toFixed(2), yaw: +walker.yaw.toFixed(3), seen: [...story.visited.keys()] };
      if (story.seenDirty) write(KEYS.pathMap, story.exportSeen());     // explored map cells, kept for good
    }
    else if (mode === 'play' && !session) progress.last = { seed, x: +player.x.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3) };
    progress.save();
  }

  /* ---- switching worlds ---- */
  function useWorld(k) {
    if (kind === k) return;
    kind = k;
    const sc = k === 'path' ? story.scene : scene;
    sc.add(camera);
    hand.group.visible = k === 'path';
    if (k !== 'path') { hand.spot.visible = false; mapUi.show(false); }
    applySettings();
  }
  // Starts a walk in the Great Path world. where: 'gate' | 'hub' | 'wastes' | 'continue'
  function startPath(where) {
    if (!story) {
      if (app.onPathStatus) app.onPathStatus('path.loading');
      // let the message paint before the (synchronous) build
      setTimeout(() => {
        import('../story/index.js').then(({ createStory }) => {
          story = createStory(renderer);
          walker = createWalker(story);
          story.onZone = (id, first) => { if (first && mode === 'play') hud.toast(t('gp.newPlace', { place: t('gp.z.' + story.zones[id].key), time: story.zones[id].t || '' }), 4.5); };
          story.importSeen(read(KEYS.pathMap));
          mapUi.attach(story);
          startPath(where);
        }).catch((e) => { console.error(e); if (app.onPathStatus) app.onPathStatus('path.failed'); });
      }, 30);
      return;
    }
    closeSession();
    useWorld('path');
    const saved = progress.path;
    let sp = story.starts[where] || story.starts.gate;
    if (where === 'continue' && saved) { sp = saved; for (const id of saved.seen) story.visited.set(id, story.visited.size + 1); }
    else story.resetVisits();
    walker.place(sp.x, sp.z, sp.yaw);
    story.preload(walker.x, walker.z);
    if (where === 'gate') story.startGate(); else story.setGate(true);
    story.setWorkLights(false);
    hand.setOn(true);
    mode = 'play'; paused = false; lastDist = 0;
    input.clear(); menu.hide(); mapUi.show(true); mapUi.setOpen(false);
    audio.setMuted(true);                                          // the only sound here: scratching at the skylights
    scratches.unlock(); scratches.resume(); scratches.reset(where === 'continue' ? 15 : 25);
    sun = 0; sunWarned = 0; pipe.heat = 0;
    input.lock();
    const k = settings.data.keys;
    hud.setHint(t('hud.pathHint', { move: moveLabel(k), light: firstKey(k, 'flashlight'), work: firstKey(k, 'workLights'), map: firstKey(k, 'map') }), 14);
    rememberWalk();
  }

  function goMenu() {
    if (mode === 'play') rememberWalk();
    closeSession();
    useWorld('endless');
    mapUi.show(false); hud.setSign(null);
    scratches.suspend(); story && story.scratchVisual(null); pipe.heat = 0;
    mode = 'menu'; paused = false;
    flash.visible = false;
    seed = MENU_SEED;
    world.setSeed(MENU_SEED);
    world.setViewDist(Math.min(2, settings.data.gfx.viewDist));
    const sp = world.gen.spawn;
    player.place(sp.x, sp.z, 0.6);
    world.preload(sp.x, sp.z);
    input.unlock(); input.clear();
    menu.show('main');
  }
  function pause() {
    if (mode !== 'play' || paused) return;
    mapUi.setOpen(false);
    if (kind === 'path') scratches.suspend();
    paused = true; input.clear(); input.unlock();
    rememberWalk();
    menu.show('pause');
  }
  function resume() {
    paused = false; input.clear(); menu.hide();
    audio.unlock(); if (kind === 'path') { audio.setMuted(true); scratches.resume(); }
    input.lock();
  }

  /* ---- multiplayer ---- */
  const sessionEvents = {
    onPose: (id, p) => world.avatars.set(id, p),
    onJoin: (id, name) => { hud.toast(t('hud.join', { name })); if (app.onPlayers) app.onPlayers(); },
    onLeave: (id, name) => { world.avatars.remove(id); hud.toast(t('hud.leave', { name })); if (app.onPlayers) app.onPlayers(); },
  };
  const app = {
    settings, input, progress,
    onPlayers: null, onJoinError: null,
    newWalk: () => startWalk(randomSeed()),
    continueWalk: () => { const l = progress.last; if (l) startWalk(l.seed, l); },
    seedWalk: (text) => startWalk(String(text).trim() ? seedFrom(text) : randomSeed()),
    resume, quit: goMenu, startPath, onPathStatus: null,
    info: () => kind === 'path'
      ? { path: true, zone: story.zones[story.zone].key, time: story.zones[story.zone].t || '—', dist: walker.dist, places: story.visited.size, total: story.zones.length - 1 }
      : { seed, zone: world.zone, dist: player.dist, odd: world.foundCount, host: !!session && session.role === 'host' },
    // host: start a walk and open the invite screen
    startHost() {
      const s = randomSeed();
      const sess = createSession({ role: 'host', name: settings.data.net.name, seed: s, ev: sessionEvents });
      startWalk(s, null, sess);
      pause(); menu.go('host');
    },
    addGuest(link) { if (session && session.role === 'host') session.addGuest(link, () => ({ x: player.x, z: player.z, yaw: player.yaw })); else link.close(); },
    playerNames() { return session ? [session.name + ' (you)', ...[...session.peers.values()].map((p) => p.name)] : []; },
    // guest: the link is open; wait for the host's welcome (seed + spawn) and start walking
    joinAsGuest(link, sayFn) {
      const sess = createSession({
        role: 'guest', name: settings.data.net.name, ev: {
          ...sessionEvents,
          onWelcome: (s, spawn) => startWalk(s, { x: spawn.x + 0.6, z: spawn.z + 0.6, yaw: spawn.yaw }, sess),
          onRefused: (why) => { sayFn('join.' + why); link.close(); },
          onClosed: () => {
            if (session === sess) { session = null; world.avatars.clear(); hud.toast(t('join.closed'), 5); }
            else sayFn('join.fail');
          },
        },
      });
      sess.attachHost(link);
    },
    startRoom(room) {
      const sess = createSession({ role: 'local', name: settings.data.net.name, room: String(room).trim().slice(0, 24) || 'lobby', ev: sessionEvents });
      startWalk(sess.seed, null, sess);
    },
  };
  const menu = createMenu(uiEl, app);

  /* ---- input ---- */
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.repeat) return;
    e.preventDefault();
    if (mode === 'menu') { menu.back(); return; }
    if (performance.now() - lockPauseAt < 250) return;        // this Esc already paused (pointer lock was released)
    if (mapUi.open) { mapUi.setOpen(false); input.lock(); return; }
    if (!paused) pause();
    else if (!menu.back()) resume();                          // inside Options/Invite: back; on the pause menu: resume
  });
  input.onLockChange = (locked) => {
    if (!locked && mode === 'play' && !paused && !mapUi.open) { lockPauseAt = performance.now(); pause(); }
  };
  canvas.addEventListener('mousedown', () => { audio.unlock(); if (mode === 'play' && !paused && !input.locked) input.lock(); });
  input.onPress = (act) => {
    if (mode !== 'play' || paused) return;
    if (act === 'flashlight') {
      if (kind === 'path') hand.setOn(!hand.spot.visible);
      else { flash.visible = !flash.visible; audio.click(); }
    } else if (act === 'toggleHud') settings.update((d) => { d.hud.show = !d.hud.show; });
    else if (act === 'workLights' && kind === 'path') { story.setWorkLights(!story.workLights); hud.toast(t(story.workLights ? 'hud.workOn' : 'hud.workOff'), 2); }
    else if (act === 'map' && kind === 'path') {
      const o = !mapUi.open; mapUi.setOpen(o); input.clear();
      if (o) input.unlock(); else input.lock();
    }
  };
  addEventListener('beforeunload', () => { if (mode === 'play') rememberWalk(); if (session) session.close(); });

  /* ---- settings -> systems ---- */
  function applySettings() {
    const d = settings.data;
    // the Great Path world renders fine-grained with tone mapping (unless the player turns it off)
    if (kind === 'path' && d.gfx.fine) pipe.setParams({ pixelH: Math.min(720, Math.max(360, innerHeight)), levels: 40, dither: 0.25, edge: 0.3, bright: d.gfx.bright / 1.15, tone: 1, grain: d.gfx.grain ? 0.045 : 0 });
    else pipe.setParams({ ...d.gfx, tone: kind === 'path' ? 1 : 0, grain: kind === 'path' && d.gfx.grain ? 0.04 : 0 });
    hud.showFps(d.gfx.showFps);
    hudOn = d.hud.show;
    world.setViewDist(mode === 'menu' ? Math.min(2, d.gfx.viewDist) : d.gfx.viewDist);
    if (camera.fov !== d.gfx.fov) { camera.fov = d.gfx.fov; camera.updateProjectionMatrix(); }
    setLang(d.lang);
  }
  settings.onChange(applySettings);
  onLang(() => menu.refresh());
  applySettings();
  document.title = TITLE;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (kind === 'path') applySettings();
    pipe.resize(w, h);
  }
  addEventListener('resize', resize);
  resize();

  /* ---- frame loop ---- */
  let last = performance.now(), frames = 0, fpsT = last, hudT = 0;
  const still = { look: { x: 0, y: 0 }, turn: 0, move: { x: 0, z: 0 }, sprint: false, jump: false };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t0 = now / 1000;
    const walking = mode === 'play' && !paused && !mapUi.open;
    if (kind === 'path') { pathFrame(dt, t0, now, walking); requestAnimationFrame(frame); return; }

    if (walking) {
      const look = input.takeLook();
      player.update(dt, { look, turn: input.turnAxis(), move: input.moveVector(), sprint: input.isDown('sprint'), jump: input.isDown('jump') }, settings.data.mouse, world.gen);
      progress.dist += player.dist - lastDist; lastDist = player.dist;
    } else if (mode === 'play') {
      input.takeLook();
      player.update(dt, still, settings.data.mouse, world.gen);     // gravity / settling only
    } else {
      player.yaw += dt * 0.05;                                      // menu: slow look around
    }
    world.stream(player.x, player.z, 1);
    world.update(dt, t0, player);
    audio.setZone(world.zone);
    if (world.nearestLight(player.x, player.z) === 2) audio.setFlicker(world.flicker());

    const eye = player.eye(settings.data.gfx.headBob && mode === 'play');
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(mode === 'menu' ? -0.04 : player.pitch, player.yaw, 0);

    // multiplayer: our pose ~12 times per second
    if (session && mode === 'play') {
      poseT -= dt;
      if (poseT <= 0) { poseT = 1 / 12; session.sendPose({ x: player.x, y: eye.y, z: player.z, yaw: player.yaw }); }
    }
    saveT += dt;
    if (saveT > 5) { saveT = 0; if (walking) rememberWalk(); }

    pipe.render(scene, camera);

    hud.showPlay(walking, hudOn);
    hud.showClick(walking && !input.locked && !input.dragging && 'requestPointerLock' in canvas);
    hud.tick(dt);
    frames++;
    if (now - fpsT > 500) {
      if (settings.data.gfx.showFps) hud.setFps(t('hud.fps', { version: VERSION, fps: Math.round(frames * 1000 / (now - fpsT)), w: pipe.rt.width, h: pipe.rt.height, c: world.loadedCount }));
      frames = 0; fpsT = now;
    }
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      let s = t('hud.line', { zone: t('zone.' + world.zone), m: Math.round(player.dist), odd: world.foundCount });
      if (session) s += t('hud.players', { n: session.count });
      hud.setLine(s);
      hud.setClick(t('hud.click'));
    }
    requestAnimationFrame(frame);
  }

  // frame of the Great Path world
  let lightT = 0;
  function pathFrame(dt, t0, now, walking) {
    const ctl = walking ? { look: input.takeLook(), turn: input.turnAxis(), move: input.moveVector(), sprint: input.isDown('sprint'), jump: input.isDown('jump') } : (input.takeLook(), still);
    // the sun through the glass: standing in it slowly burns (story 05:40-05:58: don't sit under skylights too long)
    const sunHere = mode === 'play' ? story.sunAt(walker.x, walker.z) : 0;
    if (walking) sun = sunHere > 0 ? Math.min(1, sun + dt * sunHere / 14) : Math.max(0, sun - dt / 5);
    pipe.heat = sun;
    if (sunHere > 0 && sun > 0.3 && sunWarned < 1) { sunWarned = 1; hud.toast(t('gp.sunWarm'), 4); }
    if (sunHere > 0 && sun > 0.75 && sunWarned < 2) { sunWarned = 2; hud.toast(t('gp.sunBurn'), 4); }
    if (sun < 0.1) sunWarned = 0;
    if (sun > 0.6) { ctl.move = { x: ctl.move.x * (1.6 - sun), z: ctl.move.z * (1.6 - sun) }; ctl.sprint = false; }
    walker.update(dt, ctl, settings.data.mouse);
    if (walking) { progress.dist += walker.dist - lastDist; lastDist = walker.dist; }
    story.stream(walker.x, walker.z, 1);
    story.update(dt, t0, walker);
    const eye = walker.eye(settings.data.gfx.headBob);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(walker.pitch, walker.yaw, 0);
    hand.sway(t0, walker.bob, walker.bobAmp);
    lightT -= dt;
    if (lightT <= 0) { lightT = 0.2; hand.setLight(story.lightAt(walker.x, eye.y - 0.3, walker.z) * (story.workLights ? 2 : 1) + (hand.spot.visible ? 0.15 : 0)); }
    saveT += dt;
    if (saveT > 5) { saveT = 0; if (walking) rememberWalk(); }
    // scratching at the skylights (more often along the Great Path and the West Path)
    camera.updateMatrixWorld();
    const zk = (story.zones[story.zone] || {}).key;
    scratches.update(walking ? dt : 0, camera, () => story.pickSkylight(walker), zk === 'greatPath' || zk === 'westPath');
    story.scratchVisual(scratches.active);
    pipe.render(story.scene, camera);
    mapUi.update(dt, walker);
    // reading notes
    const fx = -Math.sin(walker.yaw), fz = -Math.cos(walker.yaw);
    const sg = walking ? story.signNear(walker, fx, fz) : null;
    hud.setSign(sg ? t(sg.key, sg.params) : null);
    hud.showPlay(walking, hudOn);
    hud.showClick(walking && !input.locked && !input.dragging && 'requestPointerLock' in canvas);
    hud.tick(dt);
    frames++;
    if (now - fpsT > 500) {
      if (settings.data.gfx.showFps) hud.setFps(t('hud.fps', { version: VERSION, fps: Math.round(frames * 1000 / (now - fpsT)), w: pipe.rt.width, h: pipe.rt.height, c: story.loadedCount }));
      frames = 0; fpsT = now;
    }
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      const zd = story.zones[story.zone] || story.zones[0];
      hud.setLine(t('hud.pathLine', { zone: t('gp.z.' + zd.key), time: zd.t || '—', m: Math.round(walker.dist) }) + (story.workLights ? t('hud.workTag') : ''));
      hud.setClick(t('hud.click'));
    }
  }

  goMenu();
  requestAnimationFrame(frame);
  Object.defineProperties(app, Object.getOwnPropertyDescriptors({
    world, player, camera, pipe, audio, goMenu, startWalk, startPath, pause, mapUi, hand,
    get story() { return story; }, scratches, get walker() { return walker; }, get kind() { return kind; },
    get mode() { return mode; }, get paused() { return paused; }, get session() { return session; }, get seed() { return seed; },
  }));
  return app;
}
