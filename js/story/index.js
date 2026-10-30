// Cell-engine world facade (the Great Path, and the endless world of a seed): materials (shared by every world
// made), layout, chunk streaming (worker), prop colliders and collision queries, zones and the journal, fog,
// flickering lamps, power and work lights, and queries for events. Parts live in their own
// modules: signs.js (notes, plaques), skylights.js (sunbeams, sun, scratching visuals), gate.js (the layered gate),
// fx.js (dust, sparks, flashes), explored.js (what the map shows), canvas-mats.js (drawn materials).
import * as THREE from '../../vendor/three.module.js';
import { createGrid, CS, CW } from './grid.js';
import { makeMaterials, makeEnvironment } from './textures.js';
import { addCanvasMaterials } from './canvas-mats.js';
import { meshChunk, makeBaker, Emitter, groupFromBuffers, disposeGroup } from './mesher.js';
import { buildProp } from './props.js';
import { buildWorld } from './worlds.js';
import { createSigns } from './signs.js';
import { createSkylights } from './skylights.js';
import { createGate } from './gate.js';
import { createFx } from './fx.js';
import { createExplored } from './explored.js';
import { createWater } from './water.js';

let VIEW = 3;                // chunks streamed around the player (radius): 2 / 3 / 4 by the view distance setting
let FOG_K = 1;               // fog distance factor by the view distance setting
const fdiv = (a, b) => Math.floor(a / b);

// Materials and the environment map take a while to make: made once, shared by every world created after.
let shared = null;
function sharedMaterials(renderer) {
  if (!shared) { const mats = makeMaterials(); addCanvasMaterials(mats); shared = { mats, env: makeEnvironment(renderer) }; }
  return shared;
}

// world: 'path' (the Great Path) | 'endless' (seed: which endless world)
export function createStory(renderer, { world = 'path', seed = 0 } = {}) {
  const scene = new THREE.Scene();
  const { mats, env } = sharedMaterials(renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.35;
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI);
  const hemi = new THREE.HemisphereLight(0xfff2d8, 0x403020, 0);
  scene.add(ambient, hemi);
  scene.fog = new THREE.Fog(new THREE.Color(0.2, 0.17, 0.1), 3, 48);
  scene.background = scene.fog.color;

  const grid = createGrid();
  const W = buildWorld(world, grid, seed);
  const { beams, gates, emitters, water, zones: ZONES, starts: STARTS } = W;
  const Z_CHAPEL = ZONES.findIndex((z) => z.key === 'chapel');
  const ctx = { zones: ZONES, materials: mats.byName, scale: mats.scale, round: 0.12, cove: 0.08 };
  let gen = 0;                     // bumped when the meshing settings change: older worker results are dropped

  /* ---- prop colliders (dry run) ---- */
  const dry = new Emitter(null, mats.scale); dry.dry = true;
  function prepare(c) {
    if (!c || c.prepared === c.version) return;
    c.prepared = c.version;
    c.solids = [];
    dry.solids = c.solids;
    for (const p of c.props) buildProp(dry, p);
    dry.solids = null;
  }

  /* ---- streaming ---- */
  const root = new THREE.Group(); scene.add(root);
  const loaded = new Map();        // key -> { group, ci, cj, version, extras: [] }
  const key = (ci, cj) => ci + ',' + cj;
  // Off-thread meshing: a module worker with its own copy of the layout. Falls back to the main thread.
  let worker = null, workerReady = false;
  const inFlight = new Set();
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.t === 'ready') { workerReady = true; return; }
      if (disposed) return;
      if (m.t !== 'mesh') return;
      inFlight.delete(key(m.ci, m.cj));
      if (m.gen !== gen || loaded.has(key(m.ci, m.cj))) return;
      build(m.ci, m.cj, groupFromBuffers(m.list, mats.byName));
    };
    worker.onerror = (e) => { console.warn('mesh worker failed, meshing on the main thread', e.message); worker = null; inFlight.clear(); };
    worker.postMessage({ t: 'init', world, seed });
  } catch (e) { worker = null; }
  let disposed = false;

  const signs = createSigns(grid);
  const sky = createSkylights(scene, grid, beams);
  const gate = createGate(scene, mats.byName.steel, gates);
  const fx = createFx(scene, grid);
  const explored = createExplored(grid);
  const waters = createWater(scene, water);

  function build(ci, cj, meshed) {
    grid.ensureAround(ci, cj);
    const c = grid.chunk(ci, cj, false);
    const e = { ci, cj, group: new THREE.Group(), version: c ? c.version : -1 };
    if (c) {
      e.group.add(meshed || meshChunk(grid, c, ctx).build(mats.byName));
      const bake = makeBaker(grid, ZONES, ci, cj);
      for (const s of c.signs) e.group.add(signs.make(s, bake));
    }
    // sunbeams whose centre is in this chunk
    for (const b of beams) if (fdiv((b.x0 + b.x1) / 2, CW) === ci && fdiv((b.z0 + b.z1) / 2, CW) === cj) e.group.add(sky.makeBeam(b));
    root.add(e.group);
    loaded.set(key(ci, cj), e);
  }
  function unload(k) {
    const e = loaded.get(k);
    root.remove(e.group); sky.detach(e.group); signs.dispose(e.group); disposeGroup(e.group); loaded.delete(k);
  }
  // Builds missing chunks nearest first: in the worker (2 in flight) or, when sync / no worker, `budget` per call
  // on the main thread. Drops far chunks.
  let lastX = 0, lastZ = 0;
  function stream(x, z, budget = 1, sync = false) {
    lastX = x; lastZ = z;
    const ci = fdiv(x, CW), cj = fdiv(z, CW), want = [];
    for (let dj = -VIEW; dj <= VIEW; dj++) for (let di = -VIEW; di <= VIEW; di++) {
      if (di * di + dj * dj > VIEW * VIEW + 1) continue;
      const k = key(ci + di, cj + dj);
      if (!loaded.has(k) && (sync || !inFlight.has(k))) want.push([di * di + dj * dj, ci + di, cj + dj]);
    }
    want.sort((a, b) => a[0] - b[0]);
    if (!sync && worker && workerReady) {
      for (let k = 0; k < want.length && inFlight.size < 2; k++) {
        const [, a, b] = want[k];
        inFlight.add(key(a, b)); worker.postMessage({ t: 'mesh', ci: a, cj: b, round: ctx.round, cove: ctx.cove, gen });
      }
    } else for (let k = 0; k < Math.min(budget, want.length); k++) build(want[k][1], want[k][2]);
    for (const [k, e] of loaded) if (Math.abs(e.ci - ci) > VIEW + 1 || Math.abs(e.cj - cj) > VIEW + 1) unload(k);
    return want.length;
  }
  // Everything around a point at once on the main thread (spawn; nearest ring only, the rest streams).
  function preload(x, z) {
    const ci = fdiv(x, CW), cj = fdiv(z, CW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!loaded.has(key(ci + di, cj + dj))) build(ci + di, cj + dj);
    stream(x, z, 0);
  }
  function preloadAll(x, z) { while (stream(x, z, 6, true) > 0); }

  const extraSolids = [];       // statues
  /* ---- collision queries for the walker ---- */
  const tmp = [], gateTmp = [];
  function solidsAround(x0, z0, x1, z1) {
    const ci0 = fdiv(x0, CW) - 1, ci1 = fdiv(x1, CW) + 1, cj0 = fdiv(z0, CW) - 1, cj1 = fdiv(z1, CW) + 1;
    for (let ci = ci0; ci <= ci1; ci++) for (let cj = cj0; cj <= cj1; cj++) { grid.ensure(ci, cj); prepare(grid.chunk(ci, cj, false)); }
    grid.solidsIn(x0, z0, x1, z1, tmp);
    gateTmp.length = 0;
    for (const b of gate.solids(gateTmp)) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1) tmp.push(b);
    for (const b of extraSolids) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1) tmp.push(b);
    return tmp;
  }
  // true if a box (x0,z0)-(x1,z1) between heights y0..y1 hits a closed cell, a floor above y0, a ceiling below y1 or a prop
  function blocked(x0, z0, x1, z1, y0, y1) {
    const gx0 = Math.floor(x0 / CS), gx1 = Math.floor((x1 - 1e-6) / CS), gz0 = Math.floor(z0 / CS), gz1 = Math.floor((z1 - 1e-6) / CS);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const [c, k] = grid.at(gx, gz);
      if (!c || !c.open[k] || c.floor[k] > y0 + 1e-4 || c.ceil[k] < y1) return true;
    }
    for (const b of solidsAround(x0, z0, x1, z1)) if (b[4] > y0 + 1e-4 && b[1] < y1) return true;
    return false;
  }
  // highest support (floor or prop top) under the box at or below yMax
  function support(x0, z0, x1, z1, yMax) {
    let s = -Infinity;
    const gx0 = Math.floor(x0 / CS), gx1 = Math.floor((x1 - 1e-6) / CS), gz0 = Math.floor(z0 / CS), gz1 = Math.floor((z1 - 1e-6) / CS);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const [c, k] = grid.at(gx, gz);
      if (c && c.open[k] && c.floor[k] <= yMax + 1e-4 && c.floor[k] > s) s = c.floor[k];
    }
    for (const b of solidsAround(x0, z0, x1, z1)) if (b[4] <= yMax + 1e-4 && b[4] > s) s = b[4];
    return s;
  }

  /* ---- zones, journal, fog ---- */
  let zone = 0, onZone = null, seenT = 0;
  const visited = new Map();        // zone id -> order
  const fogTarget = new THREE.Color();
  let flickT = 0, workLights = false, power = 1;
  function update(dt, time, pos) {
    // flickering tubes
    flickT -= dt;
    if (flickT <= 0) { flickT = 0.03 + Math.random() * 0.15; mats.byName.lampFlicker.color.setScalar((Math.random() < 0.35 ? 0.1 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15) * Math.max(0.03, power)); }
    gate.update(dt);
    sky.updateDust(dt, time, pos);
    const z = grid.zoneAt(pos.x, pos.z);
    if (z && z !== zone) {
      zone = z;
      if (!visited.has(z)) { visited.set(z, visited.size + 1); if (onZone) onZone(z, true); } else if (onZone) onZone(z, false);
    }
    const zd = ZONES[zone] || ZONES[0];
    fogTarget.setRGB(zd.fog[0], zd.fog[1], zd.fog[2]);
    if (workLights) fogTarget.multiplyScalar(1.8);
    scene.fog.color.lerp(fogTarget, 1 - Math.exp(-1.2 * dt));
    const far = (zd.far || (zone === Z_CHAPEL ? 70 : 46)) * FOG_K;
    scene.fog.far += (far - scene.fog.far) * Math.min(1, dt);
    fx.update(dt);
    waters.update(dt, time, pos);
    seenT -= dt;
    if (seenT <= 0) { seenT = 0.25; explored.markSeen(pos.x, pos.z, pos.y); }
  }

  /* ---- light: work lights (L) and power cuts (events) ---- */
  const lampMats = ['lamp', 'lampFlicker', 'bulb', 'glow'].map((k) => mats.byName[k]);
  const applyLight = () => { ambient.intensity = Math.PI * (workLights ? 2.4 : 1) * (0.1 + 0.9 * power); };
  function setWorkLights(on) {
    workLights = on; applyLight();
    hemi.intensity = on ? 1.2 : 0;
    scene.environmentIntensity = on ? 0.6 : 0.35;
  }
  function setPower(k) {
    power = k; applyLight();
    for (const m of lampMats) m.color.setScalar(Math.max(0.03, k));
  }

  function emittersNear(p, r = 25) { return emitters.filter((e) => Math.abs(e.x - p.x) < r && Math.abs(e.z - p.z) < r); }
  // nearest working ceiling lamp within r metres (optionally in front of the player)
  function nearestLamp(p, r = 10, fwd = null) {
    let best = null, bd = r;
    const ci = fdiv(p.x, CW), cj = fdiv(p.z, CW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = grid.chunk(ci + di, cj + dj, false);
      if (!c) continue;
      for (const l of c.lights) {
        if (l.sky || l.dead || !l.fixture) continue;
        const d = Math.hypot(l.x - p.x, l.z - p.z);
        if (d > bd || d < 2) continue;
        if (fwd && ((l.x - p.x) * fwd.x + (l.z - p.z) * fwd.z) < 0) continue;
        bd = d; best = l;
      }
    }
    return best;
  }
  // nearest wall surface around a point (4 directions, up to 5 m)
  function wallNear(p) {
    let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let t = 0.25; t < 5; t += 0.25) {
      if (!grid.isOpen(p.x + dx * t, p.z + dz * t)) { if (!best || t < best.t) best = { t, x: p.x + dx * (t - 0.1), z: p.z + dz * (t - 0.1) }; break; }
    }
    return best;
  }

  // baked light at a point (for the hand model and other dynamic things), cached baker per chunk
  const bakers = new Map();
  function lightAt(x, y, z) {
    const ci = fdiv(x, CW), cj = fdiv(z, CW), k = key(ci, cj);
    let b = bakers.get(k);
    if (!b) { if (bakers.size > 64) bakers.clear(); b = makeBaker(grid, ZONES, ci, cj); bakers.set(k, b); }
    const l = b(x, y, z, 0, 1, 0);
    return (l[0] + l[1] + l[2]) / 3;
  }

  const extraSolidsAdd = (list) => { extraSolids.push(...list); };
  const extraSolidsRemove = (list) => { for (const b of list) { const i = extraSolids.indexOf(b); if (i >= 0) extraSolids.splice(i, 1); } };
  return {
    scene, grid, zones: ZONES, starts: STARTS, lightAt, world, seed, gen: W.gen || null,
    // frees the chunk meshes and stops the worker (materials stay: they are shared)
    dispose() { disposed = true; if (worker) worker.terminate(); worker = null; for (const k of [...loaded.keys()]) unload(k); bakers.clear(); },
    get zone() { return zone; }, get visited() { return visited; },
    set onZone(fn) { onZone = fn; },
    get loadedCount() { return loaded.size; },
    stream, preload, preloadAll, update, blocked, support,
    // skylights
    sunAt: sky.sunAt, pickSkylight: sky.pickSkylight, scratchVisual: sky.scratchVisual,
    // notes and plaques
    signText: signs.text, signNear: (pos, fx2, fz2) => signs.near(pos, fx2, fz2), relabel: signs.relabel,
    // map
    exportSeen: explored.exportSeen, importSeen: explored.importSeen, seenBounds: explored.seenBounds, get seenDirty() { return explored.dirty; },
    // gate
    setGate: gate.set, startGate: gate.start,
    // light
    setWorkLights, get workLights() { return workLights; }, setPower, get power() { return power; },
    // events
    emittersNear, nearestLamp, wallNear, particles: fx.particles, flash: fx.flash,
    addSolids: extraSolidsAdd, removeSolids: extraSolidsRemove, materials: mats.byName, stoneMaps: { map: mats.byName.stone.map, normalMap: mats.byName.stone.normalMap },
    floorAt: (x, z) => grid.floorAt(x, z), ceilAt: (x, z) => grid.ceilAt(x, z), isOpen: (x, z) => grid.isOpen(x, z),
    flagsAt: (x, z) => grid.flagsAt(x, z), zoneKeyAt: (x, z) => (ZONES[grid.zoneAt(x, z)] || ZONES[0]).key,
    resetVisits() { visited.clear(); zone = 0; },
    // rounded corners and coves (radius in m, 0 = sharp): every chunk is meshed again
    setRounding(r, cove) {
      if (Math.abs(r - ctx.round) < 1e-6 && Math.abs(cove - ctx.cove) < 1e-6) return;
      ctx.round = r; ctx.cove = cove; gen++; inFlight.clear();
      const had = loaded.size;
      for (const k of [...loaded.keys()]) unload(k);
      if (had) preload(lastX, lastZ);       // the chunks around you at once, the rest streams in
    },
    // view distance setting 1..3: chunks streamed around you and how far the fog lets you see
    setViewDist(v) { VIEW = 1 + v; FOG_K = [0.75, 1, 1.35][v - 1] || 1; },
  };
}
