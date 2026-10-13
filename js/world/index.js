// World facade: owns materials, streams chunks around the player, animates flickering lights and water,
// tracks discovered oddities, and renders other players' avatars.
import * as THREE from '../../vendor/three.module.js';
import { createGenerator, CELL, CHUNK, THEMES } from './gen.js';
import { makeTextures, THEME_SURFACES } from './textures.js';
import { buildChunk } from './chunks.js';
import { disposeGroup } from './mesh.js';
import { createAvatars } from './avatars.js';

// Fog colours (linear) per theme; the fog follows the zone you are in.
const FOG = {
  office: new THREE.Color(0.2, 0.17, 0.08),
  corridors: new THREE.Color(0.1, 0.05, 0.03),
  garage: new THREE.Color(0.02, 0.025, 0.022),
  pools: new THREE.Color(0.32, 0.4, 0.42),
};

function makeMaterials() {
  const tex = makeTextures();
  const m = {};
  for (const th of THEMES) {
    const S = THEME_SURFACES[th];
    for (const part of ['wall', 'floor', 'ceil']) m[`${th}:${part}`] = new THREE.MeshLambertMaterial({ map: tex[S[part][0]], vertexColors: true });
  }
  m.door = new THREE.MeshLambertMaterial({ map: tex.door, vertexColors: true });
  m.prop = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.lightOn = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.lightFlicker = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.lightDead = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.water = new THREE.MeshLambertMaterial({ map: tex.water.clone(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
  m.water.map.needsUpdate = true;
  return m;
}

export function createWorld(scene) {
  const materials = makeMaterials();
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));      // Lambert * PI ambient = albedo x baked vertex colour
  scene.fog = new THREE.Fog(FOG.office.clone(), 6, 40);
  scene.background = scene.fog.color;
  const root = new THREE.Group();
  scene.add(root);
  const avatars = createAvatars(scene);

  let gen = null;
  const loaded = new Map();          // "i,j" -> { group, i, j }
  let radius = 2;
  const found = new Set();           // oddity ids found in this walk
  let onFind = null;

  function clear() {
    for (const e of loaded.values()) { root.remove(e.group); disposeGroup(e.group); }
    loaded.clear();
  }

  // Starts a new world from a seed.
  function setSeed(seed) {
    clear();
    gen = createGenerator(seed);
    found.clear();
  }

  // Streams chunks: builds at most `budget` missing chunks per call (nearest first), drops far ones.
  function stream(x, z, budget = 1) {
    if (!gen) return;
    const ci = Math.floor(x / CHUNK), cj = Math.floor(z / CHUNK);
    const want = [];
    for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
      const key = (ci + di) + ',' + (cj + dj);
      if (!loaded.has(key)) want.push([di * di + dj * dj, ci + di, cj + dj, key]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(budget, want.length); k++) {
      const [, i, j, key] = want[k];
      const group = buildChunk(gen, gen.chunk(i, j), materials);
      root.add(group);
      loaded.set(key, { group, i, j });
    }
    for (const [key, e] of loaded) {
      if (Math.abs(e.i - ci) > radius + 1 || Math.abs(e.j - cj) > radius + 1) { root.remove(e.group); disposeGroup(e.group); loaded.delete(key); }
    }
    return want.length;
  }

  // Builds everything around a point at once (used on spawn so the first frame is complete).
  function preload(x, z) { while (stream(x, z, 4) > 0); }

  function setViewDist(r) {
    radius = r;
    scene.fog.far = Math.min(58, r * CHUNK - 4);
    scene.fog.near = Math.min(10, scene.fog.far * 0.25);
  }

  /* ---- per-frame effects ---- */
  let flickT = 0, flickV = 1, zone = 'office';
  const fogTarget = new THREE.Color();
  function update(dt, t, pos) {
    if (!gen) return;
    // flickering tubes: mostly on, short random drop-outs
    flickT -= dt;
    if (flickT <= 0) { flickT = 0.04 + Math.random() * 0.12; flickV = Math.random() < 0.3 ? 0.08 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15; }
    materials.lightFlicker.color.setScalar(flickV);
    materials.water.map.offset.set(Math.sin(t * 0.3) * 0.2, t * 0.04);
    // fog drifts to the colour of the current zone
    zone = gen.themeAtCell(gen.cellOf(pos.x), gen.cellOf(pos.z));
    fogTarget.copy(FOG[zone]);
    scene.fog.color.lerp(fogTarget, 1 - Math.exp(-1.5 * dt));
    // oddity discovery: within 3.5 m of a nearby chunk's oddity
    const ci = Math.floor(pos.x / CHUNK), cj = Math.floor(pos.z / CHUNK);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = gen.chunk(ci + di, cj + dj);
      if (!c.oddity || found.has(c.oddity.id)) continue;
      const p = gen.oddityPos(c);
      if ((p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 < 3.5 * 3.5) { found.add(c.oddity.id); if (onFind) onFind(c.oddity.kind); }
    }
    avatars.update(dt);
  }

  return {
    get gen() { return gen; },
    get zone() { return zone; },
    get loadedCount() { return loaded.size; },
    get foundCount() { return found.size; },
    set onFind(fn) { onFind = fn; },
    setSeed, stream, preload, setViewDist, update, avatars, materials,
    nearestLight(x, z) { return gen ? gen.lightAt(Math.floor(x / CELL), Math.floor(z / CELL)) : 0; },
    flicker: () => flickV,
  };
}
