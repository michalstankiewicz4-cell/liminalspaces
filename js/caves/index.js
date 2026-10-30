// Cave world facade (the world of "Tumithak of the Corridors"): the field (caves/field.js), cubic 16 m chunks meshed
// in workers (caves/worker.js, two of them), the rock material, lamp plates on the ceilings (some flickering, some
// dead), ladders in the shafts, sackcloth curtains in the doorways, a few props, zones and fog, and the walker's
// world: blocked / support queries against the field, and ladders to climb. Shares the engine's walker, flashlight
// and pixel pipeline; this world is the engine's exception for natural, non-rectangular geometry.
import * as THREE from '../../vendor/three.module.js';
import { buildCaves, CH } from './field.js';
import { meshCaveChunk } from './mesher.js';
import { rockMaterial, sackcloth } from './materials.js';

let VIEW = 3;                         // chunks streamed around you horizontally (radius); 2 vertically
let FOG_K = 1;

export function createCaves() {
  const W = buildCaves();
  const f = W.field;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));     // albedo x baked light
  const work = new THREE.HemisphereLight(0xfff2d8, 0x403020, 0);   // L: work lights (to see in the dark)
  scene.add(work);
  let workLights = false;
  scene.fog = new THREE.Fog(new THREE.Color(0.02, 0.02, 0.02), 8, 46);    // the dark does the hiding; fog only softens the far end
  scene.background = scene.fog.color;
  const rock = rockMaterial();
  const root = new THREE.Group(); scene.add(root);

  /* ---- lamp plates, ladders, curtains, props ---- */
  const lampOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.6) });
  const lampFl = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.6) });
  const lampDead = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.4 });
  const plate = new THREE.BoxGeometry(1.1, 0.05, 0.55);
  const groups = { on: [], fl: [], dead: [] };
  for (const l of W.lamps) groups[l.dead ? 'dead' : l.flicker ? 'fl' : 'on'].push(l);
  const dummy = new THREE.Object3D();
  for (const [k, mat] of [['on', lampOn], ['fl', lampFl], ['dead', lampDead]]) {
    const list = groups[k];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(k === 'dead' ? plate : plate, mat, list.length);
    list.forEach((l, i) => { dummy.position.set(l.x, l.ceil - 0.025, l.z); dummy.scale.setScalar(l.small ? 0.6 : 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.frustumCulled = false;
    scene.add(im);
  }
  // ladders: two rails and rungs every 0.3 m on the shaft wall
  const iron = new THREE.MeshStandardMaterial({ color: 0x6a5e52, roughness: 0.55, metalness: 0.7 });
  let rungs = 0;
  for (const L of W.ladders) rungs += Math.floor((L.y1 - L.y0) / 0.3) + 1;
  const rungMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.035, 0.5), iron, rungs);
  let ri = 0;
  for (const L of W.ladders) {
    for (let y = L.y0 + 0.3; y <= L.y1 + 1e-6; y += 0.3) { dummy.position.set(L.x - 0.12, y, L.z); dummy.scale.setScalar(1); dummy.updateMatrix(); rungMesh.setMatrixAt(ri++, dummy.matrix); }
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, L.y1 - L.y0 + 1.0, 0.05), iron);
      rail.position.set(L.x - 0.1, (L.y0 + L.y1) / 2 + 0.5, L.z + s * 0.26); scene.add(rail);
    }
  }
  rungMesh.count = ri; rungMesh.frustumCulled = false; scene.add(rungMesh);
  // curtains: sackcloth hanging in doorways (a little slack)
  const cloth = sackcloth();
  for (const c of W.curtains) {
    const g = new THREE.PlaneGeometry(c.w, c.h, 6, 6);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 4.1 + y * 1.3) * 0.04 + (c.torn && y < -c.h * 0.2 ? 0.08 : 0));
      if (c.torn && y < -c.h * 0.3 && x > 0) p.setY(i, -c.h * 0.3);
    }
    const m = new THREE.Mesh(g, cloth);
    m.position.set(c.x, c.y + c.h / 2, c.z); m.rotation.y = c.rot;
    const lk = lightAt(c.x, c.y + 1.2, c.z) * 0.9;
    for (let i = 0; i < p.count; i++) col.set([lk, lk, lk], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(m);
  }
  for (const pr of W.props) scene.add(buildProp(pr));
  for (const m of W.markers) scene.add(buildMarker(m));

  /* ---- streaming (two workers; main-thread fallback) ---- */
  const loaded = new Map(), inFlight = new Set();
  const key = (i, j, k) => i + ',' + j + ',' + k;
  const workers = [];
  let ready = 0;
  for (let n = 0; n < 2; n++) {
    try {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.busy = 0;
      w.onmessage = (ev) => {
        const m = ev.data;
        if (m.t === 'ready') { ready++; return; }
        w.busy--;
        inFlight.delete(key(m.i, m.j, m.k));
        if (!disposed && !loaded.has(key(m.i, m.j, m.k))) add(m.i, m.j, m.k, m.r);
      };
      w.onerror = (e) => { console.warn('cave worker failed', e.message); const ix = workers.indexOf(w); if (ix >= 0) workers.splice(ix, 1); };
      workers.push(w);
    } catch (e) { /* no workers: main thread */ }
  }
  let disposed = false;
  function add(i, j, k, r) {
    const e = { i, j, k, mesh: null };
    if (r) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(r.p, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(r.n, 3));
      g.setAttribute('color', new THREE.BufferAttribute(r.c, 3));
      g.setAttribute('tint', new THREE.BufferAttribute(r.t, 4));
      g.setIndex(new THREE.BufferAttribute(r.i, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, rock);
      m.matrixAutoUpdate = false; m.castShadow = false; m.receiveShadow = true;    // the beam comes from the eye: rock shadowing rock only adds acne
      root.add(m); e.mesh = m;
    }
    loaded.set(key(i, j, k), e);
  }
  function unload(k) { const e = loaded.get(k); if (e.mesh) { root.remove(e.mesh); e.mesh.geometry.dispose(); } loaded.delete(k); }
  const fdiv = (a) => Math.floor(a / CH);
  // Builds missing chunks nearest first (workers: up to 2 each in flight; sync: on this thread). Drops far chunks.
  function stream(x, y, z, sync = false) {
    const ci = fdiv(x), cj = fdiv(y), ck = fdiv(z), want = [];
    for (let dk = -VIEW; dk <= VIEW; dk++) for (let dj = -2; dj <= 2; dj++) for (let di = -VIEW; di <= VIEW; di++) {
      if (di * di + dk * dk > VIEW * VIEW + 1) continue;
      const a = ci + di, b = cj + dj, c = ck + dk, kk = key(a, b, c);
      if (loaded.has(kk) || inFlight.has(kk)) continue;
      if (!W.hasChunk(a, b, c)) { loaded.set(kk, { i: a, j: b, k: c, mesh: null }); continue; }
      want.push([di * di + dk * dk + dj * dj * 2, a, b, c]);
    }
    want.sort((p, q) => p[0] - q[0]);
    if (!sync && workers.length && ready) {
      for (const [, a, b, c] of want) {
        const w = workers.reduce((m, v) => (v.busy < m.busy ? v : m));
        if (w.busy >= 2) break;
        w.busy++; inFlight.add(key(a, b, c)); w.postMessage({ t: 'mesh', i: a, j: b, k: c });
      }
    } else for (const [, a, b, c] of want.slice(0, sync ? want.length : 1)) add(a, b, c, meshCaveChunk(W, a, b, c));
    for (const [kk, e] of loaded) if (Math.abs(e.i - ci) > VIEW + 1 || Math.abs(e.k - ck) > VIEW + 1 || Math.abs(e.j - cj) > 3) unload(kk);
    return want.length;
  }
  // the chunks right around a point at once (on spawn: the first frame must not be empty)
  function preload(x, y, z) {
    const ci = fdiv(x), cj = fdiv(y), ck = fdiv(z);
    for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = ci + di, b = cj + dj, c = ck + dk, kk = key(a, b, c);
      if (!loaded.has(kk)) add(a, b, c, meshCaveChunk(W, a, b, c));
    }
  }

  /* ---- the walker's world ---- */
  // true if the box (x0,z0)-(x1,z1) between heights y0..y1 touches rock
  function blocked(x0, z0, x1, z1, y0, y1) {
    const xs = [x0, (x0 + x1) / 2, x1], zs = [z0, (z0 + z1) / 2, z1];
    const n = Math.max(2, Math.ceil((y1 - y0) / 0.4));
    for (let s = 0; s <= n; s++) {
      const y = y0 + (y1 - y0) * s / n;
      for (const x of xs) for (const z of zs) if (f(x, y, z) > 0) return true;
    }
    return false;
  }
  // highest floor under the box at or below yMax (-Infinity: nothing within 8 m)
  function support(x0, z0, x1, z1, yMax) {
    let best = -Infinity;
    // the centre and four points halfway to the edges: the box corners would find "floor" on the curve where a cave
    // floor bends up into the wall, and the walker would climb the wall step by step (and end up inside the rock)
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 4, hz = (z1 - z0) / 4;
    for (const [x, z] of [[cx, cz], [cx - hx, cz], [cx + hx, cz], [cx, cz - hz], [cx, cz + hz]]) {
      let y = yMax, prev = f(x, y, z) > 0;
      if (prev) {
        // the point is in rock (the walker clipped the bottom of a curved wall, or noise in the floor): the surface just
        // above it (within 0.5 m) counts as floor, so you are lifted out instead of falling through the rock
        for (let s = 1; s <= 5; s++) if (f(x, yMax + s * 0.1, z) <= 0) { const fy = yMax + s * 0.1; if (fy > best) best = fy; break; }
        continue;
      }
      for (let s = 0; s < 32; s++) {
        const y2 = y - 0.25, solid = f(x, y2, z) > 0;
        if (solid) {                                       // air above, rock below: refine the floor
          let a = y2, b = y;
          for (let r = 0; r < 5; r++) { const m = (a + b) / 2; if (f(x, m, z) > 0) a = m; else b = m; }
          if (b > best) best = b;
          break;
        }
        y = y2;
      }
    }
    return best;
  }
  // how deep a standing body at (x, z, y) is in rock (<= 0: free): lets an embedded walker move only outwards
  function penetration(x, z, y) {
    let m = -1;
    for (const [dx, dz] of [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) for (const h of [0.6, 1.2]) m = Math.max(m, f(x + dx, y + h, z + dz));
    return m;
  }
  // a ladder to climb at (x, z) and height y (inside its shaft)
  function ladder(x, z, y) {
    // within reach of the rungs (and inside the shaft)
    for (const L of W.ladders) if (y > L.y0 - 0.2 && y < L.y1 && Math.hypot(x - L.x, z - L.z) < 0.95 && Math.hypot(x - L.cx, z - L.cz) < L.r) return L;
    return null;
  }

  /* ---- light at a point (the flashlight model, curtains) ---- */
  function lightAt(x, y, z) {
    const zd = W.zones[W.zoneAt(x, y, z)] || W.zones[0];
    let v = zd.amb;
    for (const l of W.lamps) {
      if (l.dead) continue;
      const dx = l.x - x, dy = l.y - y, dz = l.z - z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 256) continue;
      if (f(x + dx / 2, y + dy / 2, z + dz / 2) > 0.1) continue;
      v += l.p / (1 + d2 / 13);
    }
    return v;
  }

  /* ---- zones, fog, flicker ---- */
  let zone = 0, onZone = null, flickT = 0;
  const visited = new Map(), fogT = new THREE.Color();
  function update(dt, t, pos) {
    flickT -= dt;
    if (flickT <= 0) { flickT = 0.03 + Math.random() * 0.15; lampFl.color.setScalar(Math.random() < 0.35 ? 0.1 + Math.random() * 0.4 : 2.3); }
    const z = W.zoneAt(pos.x, pos.y + 1, pos.z);
    if (z && z !== zone) {
      zone = z;
      if (!visited.has(z)) { visited.set(z, visited.size + 1); if (onZone) onZone(z, true); }
    }
    const zd = W.zones[zone] || W.zones[0];
    fogT.setRGB(zd.fog[0], zd.fog[1], zd.fog[2]);
    scene.fog.color.lerp(fogT, 1 - Math.exp(-1.2 * dt));
    const far = (zd.far || 30) * FOG_K;
    scene.fog.far += (far - scene.fog.far) * Math.min(1, dt);
  }

  // Props of the story, built from simple shapes. Unlit by the baked light, so each takes the light of its place
  // (lightAt) into its colours; the flashlight lights them for real. Set on the floor found under them.
  function buildProp(p) {
    const g = new THREE.Group();
    const fl = p.kind === 'hatch' ? p.y : support(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1, p.y + 1.2);
    g.position.set(p.x, Number.isFinite(fl) ? fl : p.y, p.z);
    const k = Math.min(1, 0.04 + lightAt(p.x, g.position.y + 1, p.z) * 1.4);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(k), roughness: 0.7, metalness: 0, ...o });
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const dark = mat(0x3a3632, { roughness: 0.5, metalness: 0.6 });
    if (p.kind === 'machine') {
      // the great machine of Loor: drums, pipes and a pulsing core
      for (const [x, z, r, h] of [[-5, 0, 2.2, 6], [5, 0, 2.2, 6], [0, -4, 1.6, 4.5], [0, 4, 1.6, 4.5]]) add(new THREE.CylinderGeometry(r, r * 1.05, h, 20), dark, x, h / 2, z);
      const core = add(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 1.4) }), 0, 3, 0);
      g.userData.core = core;
      for (let n = 0; n < 6; n++) add(new THREE.CylinderGeometry(0.18, 0.18, 9, 8), dark, -8 + n * 3.2, 4.5, -8);
    } else if (p.kind === 'book') {
      // the old book of thin metal leaves
      add(box(0.32, 0.05, 0.24), mat(0x9a9080, { roughness: 0.35, metalness: 0.8 }), 0, 0.025, 0, 0.4);
      add(box(0.3, 0.004, 0.22), mat(0xb8b0a0, { roughness: 0.3, metalness: 0.9 }), 0.05, 0.06, 0.03, 0.9);
    } else if (p.kind === 'hatch') {
      add(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 24), dark, 0, -0.06, 0);
    } else if (p.kind === 'gifts') {
      // a table with the three gifts of Tumlook: the hand torch, the explosive charge, the small pistol
      const wood = mat(0x6a4a30);
      add(box(1.6, 0.06, 0.8), wood, 0, 0.78, 0);
      for (const [x, z] of [[-0.72, -0.32], [0.72, -0.32], [-0.72, 0.32], [0.72, 0.32]]) add(box(0.06, 0.78, 0.06), wood, x, 0.39, z);
      const torch = add(new THREE.CylinderGeometry(0.03, 0.035, 0.26, 12), mat(0x5a6a4a, { metalness: 0.5, roughness: 0.4 }), -0.45, 0.84, 0);
      torch.rotation.z = Math.PI / 2;
      add(new THREE.SphereGeometry(0.11, 12, 8), mat(0x8a7a5a), 0, 0.9, 0.05);                       // the charge, wrapped
      add(box(0.18, 0.05, 0.1), mat(0x3a3a3c, { metalness: 0.8, roughness: 0.35 }), 0.45, 0.835, -0.05);  // the pistol
      add(box(0.05, 0.1, 0.04), mat(0x3a3a3c, { metalness: 0.8, roughness: 0.35 }), 0.39, 0.79, -0.05);
    } else if (p.kind === 'synth') {
      // the alimentarist's machine that makes food from rock
      add(box(1.2, 1.5, 0.8), mat(0x5a5650, { metalness: 0.6, roughness: 0.45 }), 0, 0.75, 0);
      add(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 14), mat(0x6a645a, { metalness: 0.6 }), 0, 1.8, 0);
      add(box(0.5, 0.25, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.6, 0.4).multiplyScalar(0.8) }), 0, 1.1, 0.41);
    } else if (p.kind === 'feast') {
      // the feast of Nennapuss: a long table with biscuits
      const wood = mat(0x5a4030);
      add(box(6, 0.08, 1.2), wood, 0, 0.75, 0);
      for (const x of [-2.8, 2.8]) for (const z of [-0.5, 0.5]) add(box(0.08, 0.75, 0.08), wood, x, 0.37, z);
      for (let n = 0; n < 9; n++) add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), mat(0xc0a070), -2.4 + n * 0.6, 0.8, (n % 2 ? 0.25 : -0.25));
      for (const z of [-1.1, 1.1]) add(box(6, 0.06, 0.35), wood, 0, 0.45, z);
    } else if (p.kind === 'bones' || p.kind === 'dogBones') {
      // bones: the Yakran giant's necklace of finger bones by the shaft; gnawed bones in the dark
      const bone = mat(0xd8d0b8);
      const n = p.kind === 'bones' ? 14 : 26;
      for (let i = 0; i < n; i++) {
        const a = i * 2.39, r = (p.kind === 'bones' ? 0.25 : 0.7) * Math.sqrt((i + 1) / n);
        const b = add(new THREE.CylinderGeometry(0.012, 0.016, p.kind === 'bones' ? 0.07 : 0.22, 6), bone, Math.cos(a) * r, 0.02, Math.sin(a) * r, a);
        b.rotation.z = Math.PI / 2;
      }
      if (p.kind === 'bones') add(new THREE.TorusGeometry(0.22, 0.006, 6, 24), mat(0x6a5a40), 0, 0.01, 0).rotation.x = Math.PI / 2;
    } else if (p.kind === 'bonds') {
      // the cords he untied
      const rope = mat(0x7a6a4a);
      for (let i = 0; i < 5; i++) { const r = add(new THREE.TorusGeometry(0.18 + i * 0.03, 0.012, 6, 20, 4), rope, i * 0.06, 0.012, i * 0.04); r.rotation.x = Math.PI / 2; }
    }
    return g;
  }
  // the steles of the story: a stone slab with the chapter's number, faintly glowing so you can find it in the dark
  function buildMarker(m) {
    const g = new THREE.Group();
    const fl = support(m.x - 0.1, m.z - 0.1, m.x + 0.1, m.z + 0.1, m.y + 1.2);
    g.position.set(m.x, Number.isFinite(fl) ? fl : m.y, m.z);
    const k = Math.min(1, 0.05 + lightAt(m.x, g.position.y + 1, m.z) * 1.4);
    const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8a8070).multiplyScalar(k), roughness: 0.85 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.14), stone);
    slab.position.y = 0.475; g.add(slab);
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][m.ch] || String(m.ch);
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#e8c070'; x.lineWidth = 4; x.strokeRect(10, 10, 108, 108);
    x.fillStyle = '#ffd890'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(roman, 64, 68);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.55, 0.45, 0.3), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    for (const s of [1, -1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), sign); q.position.set(0, 0.6, s * 0.072); if (s < 0) q.rotation.y = Math.PI; g.add(q); }
    g.rotation.y = m.rot || 0;
    return g;
  }

  return {
    W, scene, blocked, support, ladder, penetration, markers: W.markers, lightAt, update, stream, preload, zones: W.zones, starts: W.starts, labels: W.labels,
    get zone() { return zone; }, get visited() { return visited; }, set onZone(fn) { onZone = fn; }, resetVisits() { visited.clear(); zone = 0; },
    get loadedCount() { let n = 0; for (const e of loaded.values()) if (e.mesh) n++; return n; },
    get pending() { return inFlight.size; },
    setWorkLights(on) { workLights = on; work.intensity = on ? 2.5 : 0; },
    get workLights() { return workLights; },
    setViewDist(v) { VIEW = 1 + v; FOG_K = [0.75, 1, 1.35][v - 1] || 1; },
    pulse(t) { for (const c of scene.children) if (c.userData && c.userData.core) c.userData.core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08); },
  };
}
