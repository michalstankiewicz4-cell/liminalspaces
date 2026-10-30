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
import { createMapUi } from '../ui/map.js';
import { createPathMode } from './path-mode.js';
import { createLoader, nextPaint } from '../ui/loader.js';
import { createHotbar } from '../ui/hotbar.js';

const MENU_SEED = 20251031;
const SAVE_VERSION = 2;
// Brings an older save up to SAVE_VERSION. v1 (up to 0.5.0): the story guide steps were in a different order.
function migrate(d) {
  if (!d || typeof d !== 'object') return d;
  const v = Number.isInteger(d.v) ? d.v : 1;
  if (v < 2 && d.path && typeof d.path === 'object') d.path.step = 0;
  d.v = SAVE_VERSION;
  return d;
}
// Is version a (x.y.z) newer than b?
const newer = (a, b) => { const p = (s) => s.split('.').map(Number); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
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
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 140);
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
  let kind = 'endless';                         // which world is shown: 'endless' | 'path'

  const input = new Input(canvas, settings);
  const pipe = new PixelPipeline(renderer);
  const audio = createAudio(settings);
  const player = createPlayer();
  player.onStep = (wet) => audio.step(wet);
  player.onLand = () => audio.land();

  /* ---- persistent progress: totals and the last single-player walk ---- */
  const progress = {
    dist: 0, odd: 0, last: null, path: null,
    // save format version: bump SAVE_VERSION and add a step to migrate() when the meaning of saved data changes
    save() { write(KEYS.save, { v: SAVE_VERSION, game: VERSION, dist: Math.round(this.dist), odd: this.odd, last: this.last, path: this.path }); },
    load() {
      const d = migrate(read(KEYS.save));
      if (!d || typeof d !== 'object') return;
      this.dist = Math.max(0, +d.dist || 0);
      this.odd = Math.max(0, Math.floor(+d.odd) || 0);
      const l = d.last;
      this.last = l && Number.isInteger(l.seed) && [l.x, l.z, l.yaw].every(Number.isFinite) ? { seed: l.seed, x: l.x, z: l.z, yaw: l.yaw } : null;
      const p = d.path;
      this.path = p && [p.x, p.z, p.yaw].every(Number.isFinite) && Math.abs(p.x) < 1e7 && Math.abs(p.z) < 1e7
        ? { x: p.x, z: p.z, yaw: p.yaw, seen: Array.isArray(p.seen) ? p.seen.filter((n) => Number.isInteger(n) && n > 0 && n < 64).slice(0, 64) : [], step: Number.isInteger(p.step) ? Math.max(0, Math.min(64, p.step)) : 0 } : null;
    },
    wipe() {
      this.dist = 0; this.odd = 0; this.last = null; this.path = null; this.save(); write(KEYS.pathMap, null);
      path.clearSeen();
      menu.refresh();
    },
  };
  progress.load();

  /* ---- state ---- */
  let mode = 'menu', paused = false, seed = MENU_SEED, session = null, hudOn = settings.data.hud.show;
  let lockPauseAt = 0, lastDist = 0, saveT = 0, poseT = 0;
  const hud = createHud(uiEl);
  const mapUi = createMapUi(uiEl);
  // loading screen: the boot screen of index.html, hidden once the menu has drawn a few frames
  const loader = createLoader(document.getElementById('boot'));
  const hotbar = createHotbar(uiEl);
  loader.show('load.boot', null); loader.hideAfter(4);
  // the Great Path world (built the first time it is opened)
  const path = createPathMode({ renderer, camera, pipe, input, hud, mapUi, settings, progress });

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
    hotbar.setItems(['flashlight']); hotbar.select(0);
    input.clear(); menu.hide();
    audio.unlock(); audio.setMuted(false);
    input.lock();
    const k = settings.data.keys;
    hud.setHint(t('hud.hint', { move: moveLabel(k), run: firstKey(k, 'sprint'), jump: firstKey(k, 'jump'), light: firstKey(k, 'flashlight') }));
    rememberWalk();
  }
  function rememberWalk() {
    if (mode === 'play' && kind === 'path') path.remember();
    else if (mode === 'play' && !session) progress.last = { seed, x: +player.x.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3) };
    progress.save();
  }

  /* ---- switching worlds ---- */
  function useWorld(k) {
    if (kind === k) return;
    if (kind === 'path') { path.leave(); scene.add(camera); if (camera.far !== 140) { camera.far = 140; camera.updateProjectionMatrix(); } }
    kind = k;
    applySettings();
  }
  // Starts a walk in the Great Path world (see core/path-mode.js). where: 'gate' | 'hub' | 'wastes' | 'continue'
  // A loading screen covers the build (first time) and the placing of the player; it goes once the new world has
  // drawn a few frames.
  let starting = false;
  async function startPath(where) {
    if (starting) return;
    starting = true;
    try {
      loader.show(path.ready ? 'load.place' : 'load.code', path.ready ? 0.9 : 0.02);
      await nextPaint();
      if (!path.ready) await path.load((key, f) => loader.show(key, f));
      loader.show('load.place', 0.95);
      await nextPaint();
      enterPath(where);
      loader.hideAfter(3);
    } catch (e) {
      console.error(e); loader.hide();
      if (app.onPathStatus) app.onPathStatus('path.failed');
    } finally { starting = false; }
  }
  function enterPath(where) {
    closeSession();
    useWorld('path');
    path.start(where);
    hotbar.setItems(['flashlight', 'map']); hotbar.select(0);
    mode = 'play'; paused = false; lastDist = 0;
    input.clear(); menu.hide();
    audio.setMuted(true);                                          // this world has its own sound (story/audio.js)
    input.lock();
    rememberWalk();
  }

  // the endless world: a short loading screen while its first rooms are built
  async function withLoader(fn) {
    if (starting) return;
    starting = true;
    try { loader.show('load.walk', null); await nextPaint(); fn(); loader.hideAfter(3); } finally { starting = false; }
  }

  function goMenu() {
    if (mode === 'play') rememberWalk();
    closeSession();
    useWorld('endless');
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
    if (kind === 'path') path.pause();
    paused = true; input.clear(); input.unlock();
    rememberWalk();
    menu.show('pause');
  }
  function resume() {
    paused = false; input.clear(); menu.hide();
    audio.unlock(); if (kind === 'path') { audio.setMuted(true); path.resume(); }
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
    newWalk: () => withLoader(() => startWalk(randomSeed())),
    continueWalk: () => { const l = progress.last; if (l) withLoader(() => startWalk(l.seed, l)); },
    seedWalk: (text) => withLoader(() => startWalk(String(text).trim() ? seedFrom(text) : randomSeed())),
    resume, quit: goMenu, startPath, onPathStatus: null,
    info: () => kind === 'path' ? path.info()
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
    if (act === 'toggleHud') settings.update((d) => { d.hud.show = !d.hud.show; });
    else if (act.startsWith('hotbar')) useSlot(+act.slice(6) - 1);
    else if (kind === 'path') path.onPress(act);
    else if (act === 'flashlight') { flash.visible = !flash.visible; audio.click(); }
  };
  // a hotbar key selects its slot and uses the item in it
  function useSlot(i) {
    const item = hotbar.select(i);
    if (item === 'flashlight') input.onPress('flashlight');
    else if (item === 'map' && kind === 'path') path.onPress('map');
  }
  input.onWheel = (d) => { if (mode === 'play' && !paused && !mapUi.open) hotbar.scroll(d); };
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
    if (kind === 'path') {
      const ctl = walking ? { look: input.takeLook(), turn: input.turnAxis(), move: input.moveVector(), sprint: input.isDown('sprint'), jump: input.isDown('jump') } : (input.takeLook(), still);
      path.frame(dt, t0, walking, ctl, rememberWalk);
      autosave(now, walking);
      commonHud(dt, now, walking, path.loadedCount);
      requestAnimationFrame(frame);
      return;
    }

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
    autosave(now, walking);

    pipe.render(scene, camera);

    commonHud(dt, now, walking, world.loadedCount);
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      let s = t('hud.line', { zone: t('zone.' + world.zone), m: Math.round(player.dist), odd: world.foundCount });
      if (session) s += t('hud.players', { n: session.count });
      hud.setLine(s);
    }
    requestAnimationFrame(frame);
  }
  // saves the walk every 5 s of real time (dt is capped, so slow machines would save less often)
  function autosave(now, walking) {
    if (now - saveT < 5000) return;
    saveT = now;
    if (walking) rememberWalk();
  }
  // HUD parts shared by both worlds: crosshair, "click to look", toasts, FPS counter
  function commonHud(dt, now, walking, chunks) {
    hud.showPlay(walking, hudOn);
    hotbar.show(walking && hudOn); hotbar.tick(dt);
    hotbar.setOn('flashlight', kind === 'path' ? path.hand.spot.visible : flash.visible);
    hud.showClick(walking && !input.locked && !input.dragging && 'requestPointerLock' in canvas);
    hud.setClick(t('hud.click'));
    hud.tick(dt);
    frames++; loader.frame();
    if (now - fpsT > 500) {
      if (settings.data.gfx.showFps) hud.setFps(t('hud.fps', { version: VERSION, fps: Math.round(frames * 1000 / (now - fpsT)), w: pipe.rt.width, h: pipe.rt.height, c: chunks }));
      frames = 0; fpsT = now;
    }
  }

  goMenu();
  requestAnimationFrame(frame);
  // Is a newer version published than the one running (cached files)? Same-origin request, no data sent.
  fetch('js/version.js', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((txt) => {
    const m = /VERSION\s*=\s*'(\d+\.\d+\.\d+)'/.exec(txt);
    if (m && newer(m[1], VERSION)) menu.showUpdate(m[1]);
  }).catch(() => {});
  Object.defineProperties(app, Object.getOwnPropertyDescriptors({
    world, player, camera, pipe, audio, goMenu, startWalk, startPath, pause, mapUi, path, hand: path.hand, scratches: path.sound, teleport: path.teleport,
    get story() { return path.story; }, get director() { return path.director; }, get guide() { return path.guide; }, get walker() { return path.walker; }, get kind() { return kind; },
    get mode() { return mode; }, get paused() { return paused; }, get session() { return session; }, get seed() { return seed; },
  }));
  return app;
}
