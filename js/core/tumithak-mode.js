// The world of "Tumithak of the Corridors" as a game mode: builds the caves on first use (caves/*), and owns the walk
// there — the walker (with ladders), the flashlight in hand, zones and their names, sound, the HUD line, saving.
import { moveLabel, firstKey } from '../input/bindings.js';
import { t } from '../i18n/index.js';
import { createWalker } from '../story/walker.js';
import { nextPaint } from '../ui/loader.js';
import { createMap3d } from '../ui/map3d.js';

// shared: { camera, pipe, input, hud, settings, progress, audio, hand, uiEl }
export function createTumithakMode(shared) {
  const { camera, pipe, input, hud, settings, progress, audio, hand } = shared;
  const map = createMap3d(shared.uiEl);
  let exploreT = 0;
  // teleport (from the list beside the map): the nearest spot near the place where a person can stand
  map.onTeleport = (l) => {
    const c = caves;
    for (let r = 0; r < 40; r += 0.5) for (let a = 0; a < 16; a++) {
      const x = l.x + Math.cos(a / 16 * Math.PI * 2) * r, z = l.z + Math.sin(a / 16 * Math.PI * 2) * r;
      const s = c.support(x - 0.27, z - 0.27, x + 0.27, z + 0.27, l.y + 3);
      if (!Number.isFinite(s) || Math.abs(s - l.y) > 4 || c.ladder(x, z, s + 0.1)) continue;
      if (c.blocked(x - 0.27, z - 0.27, x + 0.27, z + 0.27, s + 0.1, s + 1.75)) continue;
      walker.place(x, z, walker.yaw); walker.y = s; walker.eyeY = s + 1.62;
      c.preload(x, s, z);
      safe = { x, y: s, z };
      setMap(false);
      pipe.glitch = 0.8; hud.toast(t('map.teleported'), 2);
      return;
    }
    hud.toast(t('map.noTeleport'), 2);
  };
  let caves = null, walker = null, hudT = 0, lightT = 0, lastDist = 0, safe = null, pendingView = null;

  let loading = null;
  function load(stage = () => {}) {
    if (loading) return loading;
    stage('load.tmCode', 0.05);
    loading = import('../caves/index.js').then(async (ix) => {
      stage('load.tmWorld', 0.3); await nextPaint();
      caves = ix.createCaves();
      walker = createWalker(caves);
      walker.onStep = () => audio.step(false);
      walker.onLand = () => audio.land();
      caves.onZone = (id, first) => { if (first) hud.toast(t('tm.newPlace', { place: t('tm.z.' + caves.zones[id].key) }), 4.5); };
      if (pendingView !== null) caves.setViewDist(pendingView);
      map.attach(caves);
    });
    loading.catch(() => { loading = null; });
    return loading;
  }

  // where: 'loor' (the start) | 'nonone' | 'yakra' | 'continue'
  function start(where) {
    const saved = progress.tumi;
    const sp = where === 'continue' && saved ? saved : caves.starts[where] || caves.starts.loor;
    caves.resetVisits();
    if (where === 'continue' && saved) for (const id of saved.seen || []) caves.visited.set(id, caves.visited.size + 1);
    // a saved spot can lie in rock or in the air after the world changed (a new version moved the Surface): the nearest
    // place to stand instead — up or down the same column first, then around it; failing that, the start in Loor
    const at = Number.isFinite(sp.y) ? stand(sp.x, sp.y, sp.z) : null;
    const p = at || (Number.isFinite(sp.y) ? caves.starts.loor : sp);
    walker.place(p.x, p.z, sp.yaw || 0);
    if (Number.isFinite(p.y)) { walker.y = at ? at.y : p.y; const s = at ? at.y : caves.support(p.x - 0.27, p.z - 0.27, p.x + 0.27, p.z + 0.27, p.y + 1.5); if (Number.isFinite(s)) walker.y = s; walker.eyeY = walker.y + 1.62; }
    caves.preload(walker.x, walker.y, walker.z);
    caves.setWorkLights(false);
    caves.scene.add(camera);
    hand.group.visible = true; hand.setOn(true); hand.setBeam(160, 1.35);   // the dark: a strong beam down the corridors
    hand.spot.shadow.camera.layers.set(2);   // the beam throws the shadows of props, not of the rock around it (acne)
    safe = { x: walker.x, y: walker.y, z: walker.z };
    lastDist = 0;
    const k = settings.data.keys;
    hud.setHint(t('hud.tmHint', { move: moveLabel(k), light: firstKey(k, 'flashlight'), map: firstKey(k, 'map') }), 12);
  }
  // the standable spot nearest to (x, y, z): floor under the body, room for it, not on a ladder; null if none within reach
  function stand(x, y, z) {
    const c = caves;
    const ok = (px, pz, top) => {
      const s = c.support(px - 0.27, pz - 0.27, px + 0.27, pz + 0.27, top);
      if (!Number.isFinite(s) || c.ladder(px, pz, s + 0.1) || c.blocked(px - 0.27, pz - 0.27, px + 0.27, pz + 0.27, s + 0.1, s + 1.75)) return null;
      return s;
    };
    for (let r = 0; r <= 24; r += r < 2 ? 0.5 : 2) for (let a = 0; a < (r ? 12 : 1); a++) {
      const px = x + Math.cos(a / 12 * Math.PI * 2) * r, pz = z + Math.sin(a / 12 * Math.PI * 2) * r;
      let best = null;
      // support scans 8 m down from where it starts: tops every 6 m from 40 m above to 40 m below cover the column
      for (let top = y + 40; top >= y - 40; top -= 6) { const s = ok(px, pz, top); if (s !== null && (best === null || Math.abs(s - y) < Math.abs(best - y))) best = s; }
      if (best === null) best = ok(px, pz, y + 1.5);
      if (best !== null) return { x: px, y: best, z: pz };
    }
    return null;
  }
  function leave() { hand.spot.shadow.camera.layers.set(0); pipe.glitch = 0; hud.setSign(null); hand.group.visible = false; hand.spot.visible = false; map.setOpen(false); map.save(); }
  function remember() {
    map.save();
    progress.tumi = { x: +walker.x.toFixed(2), y: +walker.y.toFixed(2), z: +walker.z.toFixed(2), yaw: +walker.yaw.toFixed(3), seen: [...caves.visited.keys()] };
  }
  function onPress(act) {
    if (act === 'flashlight') { hand.setOn(!hand.spot.visible); audio.click(); return true; }
    if (act === 'map') { setMap(!map.open); return true; }
    if (act === 'workLights' && map.open) { hud.toast(t(map.toggleReveal() ? 'map.revealOn' : 'map.revealOff'), 2); return true; }
    if (act === 'workLights') { caves.setWorkLights(!caves.workLights); hud.toast(t(caves.workLights ? 'hud.workOn' : 'hud.workOff'), 2); return true; }
    return false;
  }

  // the 3D map (M): opens over the game with a free mouse; closing it takes the mouse back
  function setMap(o) { map.setOpen(o, walker); input.clear(); if (o) input.unlock(); else input.lock(); }

  function frame(dt, t0, walking, ctl) {
    exploreT -= dt;
    if (exploreT <= 0) { exploreT = 0.4; map.explore(walker.x, walker.y, walker.z); }
    pipe.glitch = Math.max(0, pipe.glitch - dt * 1.6);          // the teleport's glitch fades (nothing else here keeps it)
    walker.update(dt, ctl, settings.data.mouse);
    if (walker.ground && !walker.climbing) safe = { x: walker.x, y: walker.y, z: walker.z };
    if (safe && walker.y < safe.y - 30) { walker.place(safe.x, safe.z, walker.yaw); walker.y = safe.y; pipe.glitch = 0.5; }
    if (walking) { progress.dist += walker.dist - lastDist; lastDist = walker.dist; }
    caves.stream(walker.x, walker.y, walker.z);
    caves.update(dt, t0, walker);
    caves.pulse(t0);
    const zk = (caves.zones[caves.zone] || caves.zones[0]).key;
    audio.setZone(zk === 'loor' || zk === 'nonone' || zk === 'yakra' || zk === 'machine' ? 'corridors' : 'garage');
    const eye = walker.eye(settings.data.gfxTumi.headBob);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(walker.pitch, walker.yaw, 0);
    const far = caves.scene.fog.far + 6;
    if (Math.abs(camera.far - far) > 2) { camera.far = far; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    hand.fit(camera.fov);
    hand.sway(t0, walker.bob, walker.bobAmp);
    lightT -= dt;
    if (lightT <= 0) { lightT = 0.2; hand.setLight(caves.lightAt(walker.x, eye.y - 0.3, walker.z) + (hand.spot.visible ? 0.15 : 0)); }
    pipe.render(caves.scene, camera);
    // a stele of the story within reach: its chapter text
    let near = null, nd = 2.6;
    if (walking) for (const m of caves.markers) { const d = Math.hypot(m.x - walker.x, m.z - walker.z); if (d < nd && Math.abs(m.y - walker.y) < 3) { nd = d; near = m; } }
    hud.setSign(near ? t('tm.n.' + near.key) : null);
    map.frame(walker);
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      hud.setLine(t('hud.tmLine', { zone: t('tm.z.' + zk), m: Math.round(walker.dist), depth: Math.round(walker.y) }) + (walker.climbing ? t('hud.tmClimb') : ''));
    }
  }

  return {
    load, start, leave, remember, onPress, frame,
    get mapOpen() { return map.open; }, setMap, closeMap: () => map.setOpen(false), clearMap: () => map.clear(),
    get ready() { return !!caves; }, get caves() { return caves; }, get walker() { return walker; },
    get loadedCount() { return caves ? caves.loadedCount : 0; },
    setViewDist(v) { if (caves) caves.setViewDist(v); else pendingView = v; },
    info: () => ({ tumi: true, zone: (caves.zones[caves.zone] || caves.zones[0]).key, dist: walker.dist, depth: Math.round(walker.y) }),
  };
}
