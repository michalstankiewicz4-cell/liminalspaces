// The world of "Tumithak of the Corridors" as a game mode: builds the caves on first use (caves/*), and owns the walk
// there — the walker (with ladders), the flashlight in hand, zones and their names, sound, the HUD line, saving.
import { moveLabel, firstKey } from '../input/bindings.js';
import { t } from '../i18n/index.js';
import { createWalker } from '../story/walker.js';
import { nextPaint } from '../ui/loader.js';

// shared: { camera, pipe, input, hud, settings, progress, audio, hand }
export function createTumithakMode(shared) {
  const { camera, pipe, hud, settings, progress, audio, hand } = shared;
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
    walker.place(sp.x, sp.z, sp.yaw || 0);
    if (Number.isFinite(sp.y)) { walker.y = sp.y; const s = caves.support(sp.x - 0.27, sp.z - 0.27, sp.x + 0.27, sp.z + 0.27, sp.y + 1.5); if (Number.isFinite(s)) walker.y = s; walker.eyeY = walker.y + 1.62; }
    caves.preload(walker.x, walker.y, walker.z);
    caves.scene.add(camera);
    hand.group.visible = true; hand.setOn(true); hand.setBeam(160, 1.35);   // the dark: a strong beam down the corridors
    safe = { x: walker.x, y: walker.y, z: walker.z };
    lastDist = 0;
    const k = settings.data.keys;
    hud.setHint(t('hud.tmHint', { move: moveLabel(k), light: firstKey(k, 'flashlight') }), 12);
  }
  function leave() { hand.group.visible = false; hand.spot.visible = false; }
  function remember() {
    progress.tumi = { x: +walker.x.toFixed(2), y: +walker.y.toFixed(2), z: +walker.z.toFixed(2), yaw: +walker.yaw.toFixed(3), seen: [...caves.visited.keys()] };
  }
  function onPress(act) {
    if (act === 'flashlight') { hand.setOn(!hand.spot.visible); audio.click(); return true; }
    return false;
  }

  function frame(dt, t0, walking, ctl) {
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
    hudT += dt;
    if (hudT > 0.2 && walking) {
      hudT = 0;
      hud.setLine(t('hud.tmLine', { zone: t('tm.z.' + zk), m: Math.round(walker.dist), depth: Math.round(walker.y) }) + (walker.climbing ? t('hud.tmClimb') : ''));
    }
  }

  return {
    load, start, leave, remember, onPress, frame,
    get ready() { return !!caves; }, get caves() { return caves; }, get walker() { return walker; },
    get loadedCount() { return caves ? caves.loadedCount : 0; },
    setViewDist(v) { if (caves) caves.setViewDist(v); else pendingView = v; },
    info: () => ({ tumi: true, zone: (caves.zones[caves.zone] || caves.zones[0]).key, dist: walker.dist, depth: Math.round(walker.y) }),
  };
}
