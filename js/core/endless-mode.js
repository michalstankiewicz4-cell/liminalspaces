// The endless world as a game mode, on the shared cell engine (story/index.js with world 'endless'): one world per
// seed (made when a walk starts, the old one freed), the walker and flashlight, oddity discovery, the synthesised
// sound of the zones (audio/audio.js), the HUD line, and the slowly turning view behind the start screen.
import { createStory } from '../story/index.js';
import { createWalker } from '../story/walker.js';
import { oddityPos } from '../endless/layout.js';
import { CHUNK } from '../world/gen.js';
import { createAvatars } from '../world/avatars.js';
import { t } from '../i18n/index.js';

// shared: { renderer, camera, pipe, hud, settings, progress, audio, hand }
export function createEndlessMode(shared) {
  const { renderer, camera, pipe, hud, settings, progress, audio, hand } = shared;
  let story = null, walker = null, avatars = null, seed = null;
  const found = new Set();           // oddity ids found in this walk
  let view = 2, round = [0.12, 0.08], hudT = 0, lightT = 0, lastDist = 0, onFind = null;

  // The world of `seed` (kept when it is already the one shown).
  function setSeed(s) {
    if (story && seed === s) return;
    if (story) { story.dispose(); if (avatars) avatars.clear(); }
    seed = s;
    story = createStory(renderer, { world: 'endless', seed: s });
    story.setViewDist(view); story.setRounding(round[0], round[1]);
    walker = createWalker(story);
    walker.onStep = () => audio.step(walker.y < -0.1);
    walker.onLand = () => audio.land();
    avatars = createAvatars(story.scene);
    found.clear();
  }

  // Put the camera into this world at `spawn` ({ x, z, yaw }, null = the world's spawn point). menu: the turning view.
  function enter(spawn, menu) {
    const sp = free(spawn || story.starts.spawn);
    walker.place(sp.x, sp.z, sp.yaw || 0);
    story.preload(walker.x, walker.z);
    story.setPower(1); story.setWorkLights(false);
    story.scene.add(camera);
    hand.group.visible = !menu; hand.setOn(false);
    lastDist = 0;
  }
  // the nearest spot with room to stand (a walk saved before 0.18.0 can lie inside today's thicker walls)
  function free(p) {
    const ok = (x, z) => story.isOpen(x, z) && !story.blocked(x - 0.3, z - 0.3, x + 0.3, z + 0.3, story.floorAt(x, z) + 0.05, story.floorAt(x, z) + 1.75);
    for (let r = 0; r <= 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = p.x + dx * 0.5, z = p.z + dz * 0.5;
      if (ok(x, z)) return { x, z, yaw: p.yaw };
    }
    return p;
  }
  function leave() { hand.group.visible = false; hand.spot.visible = false; }

  // One frame. mode: 'menu' | 'play'; walking: input goes to the walker.
  function frame(dt, t0, mode, walking, ctl) {
    if (mode === 'menu') walker.yaw += dt * 0.05;
    else walker.update(dt, ctl, settings.data.mouse);
    if (walking) { progress.dist += walker.dist - lastDist; lastDist = walker.dist; }
    story.stream(walker.x, walker.z, 1);
    story.update(dt, t0, walker);
    // sound of the zone; the buzz of a flickering tube when you stand under one
    const zk = story.zoneKeyAt(walker.x, walker.z);
    audio.setZone(zk);
    if (nearFlicker()) audio.setFlicker(story.materials.lampFlicker.color.r);
    // oddities: found within 3.5 m
    if (mode === 'play') discover();
    avatars.update(dt);
    const eye = walker.eye(settings.data.gfx.headBob && mode === 'play');
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(mode === 'menu' ? -0.04 : walker.pitch, walker.yaw, 0);
    const far = story.scene.fog.far + 6;
    if (Math.abs(camera.far - far) > 2) { camera.far = far; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    if (hand.group.visible) {
      hand.fit(camera.fov);
      hand.sway(t0, walker.bob, walker.bobAmp);
      lightT -= dt;
      if (lightT <= 0) { lightT = 0.2; hand.setLight(story.lightAt(walker.x, eye.y - 0.3, walker.z) + (hand.spot.visible ? 0.15 : 0)); }
    }
    pipe.render(story.scene, camera);
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      let s = t('hud.line', { zone: t('zone.' + zk), m: Math.round(walker.dist), odd: found.size });
      if (shared.session && shared.session()) s += t('hud.players', { n: shared.session().count });
      hud.setLine(s);
    }
  }
  function nearFlicker() {
    const c = story.grid.chunk(Math.floor(walker.x / CHUNK), Math.floor(walker.z / CHUNK), false);
    if (!c) return false;
    for (const l of c.lights) if (l.flicker && Math.abs(l.x - walker.x) < 2.2 && Math.abs(l.z - walker.z) < 2.2) return true;
    return false;
  }
  function discover() {
    const g = story.gen, ci = Math.floor(walker.x / CHUNK), cj = Math.floor(walker.z / CHUNK);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = g.chunk(ci + di, cj + dj);
      if (!c.oddity || found.has(c.oddity.id)) continue;
      const p = oddityPos(c);
      if ((p.x - walker.x) ** 2 + (p.z - walker.z) ** 2 < 3.5 * 3.5) { found.add(c.oddity.id); if (onFind) onFind(c.oddity.kind); }
    }
  }

  return {
    setSeed, enter, leave, frame,
    get story() { return story; }, get walker() { return walker; }, get avatars() { return avatars; }, get gen() { return story && story.gen; },
    get seed() { return seed; }, get foundCount() { return found.size; }, get loadedCount() { return story ? story.loadedCount : 0; },
    get zone() { return story ? story.zoneKeyAt(walker.x, walker.z) : 'office'; },
    set onFind(fn) { onFind = fn; },
    setViewDist(v) { view = v; if (story) story.setViewDist(v); },
    setRounding(r, c) { round = [r, c]; if (story) story.setRounding(r, c); },
  };
}
