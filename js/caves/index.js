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

  function buildProp(p) {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.5, metalness: 0.6 });
    if (p.kind === 'machine') {
      // the great machine of Loor: drums, pipes and a pulsing core
      for (const [x, z, r, h] of [[-5, 0, 2.2, 6], [5, 0, 2.2, 6], [0, -4, 1.6, 4.5], [0, 4, 1.6, 4.5]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 20), dark); c.position.set(x, h / 2, z); g.add(c); }
      const core = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 1.4) }));
      core.position.y = 3; g.add(core); g.userData.core = core;
      for (let k = 0; k < 6; k++) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 8), dark); pipe.position.set(-8 + k * 3.2, 4.5, -8); g.add(pipe); }
    } else if (p.kind === 'book') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.35, metalness: 0.8 }));
      b.position.y = 0.025; b.rotation.y = 0.4; g.add(b);
    } else if (p.kind === 'hatch') {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 24), dark);
      h.position.y = -0.06; g.add(h);
    }
    return g;
  }

  return {
    W, scene, blocked, support, ladder, penetration, lightAt, update, stream, preload, zones: W.zones, starts: W.starts, labels: W.labels,
    get zone() { return zone; }, get visited() { return visited; }, set onZone(fn) { onZone = fn; }, resetVisits() { visited.clear(); zone = 0; },
    get loadedCount() { let n = 0; for (const e of loaded.values()) if (e.mesh) n++; return n; },
    get pending() { return inFlight.size; },
    setWorkLights(on) { workLights = on; work.intensity = on ? 2.5 : 0; },
    get workLights() { return workLights; },
    setViewDist(v) { VIEW = 1 + v; FOG_K = [0.75, 1, 1.35][v - 1] || 1; },
    pulse(t) { for (const c of scene.children) if (c.userData && c.userData.core) c.userData.core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08); },
  };
}
