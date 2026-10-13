// Application shell: renderer, world, player, audio, UI, multiplayer session and the frame loop.
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

const MENU_SEED = 20251031;
const TITLE = 'Liminal Spaces — Endless Liminal Space Exploration Game';

export function createApp({ appEl, uiEl }) {
  const settings = createSettings();
  setLang(settings.data.lang);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  appEl.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 140);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // flashlight: a spot light carried by the camera
  const flash = new THREE.SpotLight(0xfff1d6, 9, 26, 0.48, 0.55, 1.4);
  flash.position.set(0.15, -0.1, 0);
  flash.target.position.set(0.1, -0.15, -1);
  camera.add(flash, flash.target);
  flash.visible = false;

  const input = new Input(canvas, settings);
  const pipe = new PixelPipeline(renderer);
  const audio = createAudio(settings);
  const player = createPlayer();
  player.onStep = (wet) => audio.step(wet);
  player.onLand = () => audio.land();

  /* ---- persistent progress: totals and the last single-player walk ---- */
  const progress = {
    dist: 0, odd: 0, last: null,
    save() { write(KEYS.save, { dist: Math.round(this.dist), odd: this.odd, last: this.last }); },
    load() {
      const d = read(KEYS.save);
      if (!d || typeof d !== 'object') return;
      this.dist = Math.max(0, +d.dist || 0);
      this.odd = Math.max(0, Math.floor(+d.odd) || 0);
      const l = d.last;
      this.last = l && Number.isInteger(l.seed) && [l.x, l.z, l.yaw].every(Number.isFinite) ? { seed: l.seed, x: l.x, z: l.z, yaw: l.yaw } : null;
    },
    wipe() { this.dist = 0; this.odd = 0; this.last = null; this.save(); menu.refresh(); },
  };
  progress.load();

  /* ---- state ---- */
  let mode = 'menu', paused = false, seed = MENU_SEED, session = null, hudOn = settings.data.hud.show;
  let lockPauseAt = 0, lastDist = 0, saveT = 0, poseT = 0;
  const hud = createHud(uiEl);

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
    if (mode === 'play' && !session) { progress.last = { seed, x: +player.x.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3) }; }
    progress.save();
  }

  function goMenu() {
    if (mode === 'play') rememberWalk();
    closeSession();
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
    paused = true; input.clear(); input.unlock();
    rememberWalk();
    menu.show('pause');
  }
  function resume() {
    paused = false; input.clear(); menu.hide();
    audio.unlock(); input.lock();
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
    resume, quit: goMenu,
    info: () => ({ seed, zone: world.zone, dist: player.dist, odd: world.foundCount, host: !!session && session.role === 'host' }),
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
    if (!paused) pause();
    else if (!menu.back()) resume();                          // inside Options/Invite: back; on the pause menu: resume
  });
  input.onLockChange = (locked) => {
    if (!locked && mode === 'play' && !paused) { lockPauseAt = performance.now(); pause(); }
  };
  canvas.addEventListener('mousedown', () => { audio.unlock(); if (mode === 'play' && !paused && !input.locked) input.lock(); });
  input.onPress = (act) => {
    if (mode !== 'play' || paused) return;
    if (act === 'flashlight') { flash.visible = !flash.visible; audio.click(); }
    else if (act === 'toggleHud') settings.update((d) => { d.hud.show = !d.hud.show; });
  };
  addEventListener('beforeunload', () => { if (mode === 'play') rememberWalk(); if (session) session.close(); });

  /* ---- settings -> systems ---- */
  function applySettings() {
    const d = settings.data;
    pipe.setParams(d.gfx);
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
    const walking = mode === 'play' && !paused;

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

  goMenu();
  requestAnimationFrame(frame);
  Object.defineProperties(app, Object.getOwnPropertyDescriptors({
    world, player, camera, pipe, audio, goMenu, startWalk, pause,
    get mode() { return mode; }, get paused() { return paused; }, get session() { return session; }, get seed() { return seed; },
  }));
  return app;
}
