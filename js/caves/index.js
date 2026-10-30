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
  for (const l of W.lamps) if (!l.hidden) groups[l.dead ? 'dead' : l.flicker ? 'fl' : 'on'].push(l);   // hidden: light plates set into the walls
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
  for (const m of W.murals) scene.add(buildMural(m));

  /* ---- the Surface (chapter 7): sky, a far ground plane, trees, the leaning towers of Shawm and their cables ---- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(290, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: new THREE.Vector3(-0.5, 0.62, -0.6).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sun; varying vec3 vD;
      void main(){ float h = clamp(vD.y, 0.0, 1.0);
        vec3 c = mix(vec3(0.72, 0.8, 0.88), vec3(0.3, 0.5, 0.82), pow(h, 0.6));
        float s = max(dot(vD, sun), 0.0); c += vec3(1.0, 0.98, 0.9) * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.12);
        if (vD.y < 0.0) c = mix(vec3(0.72, 0.8, 0.88), vec3(0.5, 0.48, 0.42), clamp(-vD.y * 6.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; sky.visible = false;
  scene.add(sky);
  const surfaceGroup = new THREE.Group(); surfaceGroup.visible = false; scene.add(surfaceGroup);
  {
    const dust = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.45, 0.37), roughness: 1 });
    const far = new THREE.Mesh(new THREE.CircleGeometry(1400, 48).rotateX(-Math.PI / 2), dust);
    far.position.set(W.exit.x, W.surfaceY - 3.6, W.exit.z); surfaceGroup.add(far);
    // trees: a trunk and a few round green masses
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 7).translate(0, 0.5, 0), crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 }), W.trees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x3e6a2e, roughness: 0.85, flatShading: true }), W.trees.length * 3);
    const d = new THREE.Object3D();
    W.trees.forEach((t, i) => {
      const gy = W.ground(t.x, t.z);
      d.position.set(t.x, gy - 0.2, t.z); d.rotation.set(0, 0, 0); d.scale.set(1, t.h * 0.7, 1); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
      for (let c = 0; c < 3; c++) {
        d.position.set(t.x + Math.cos(i + c * 2.1) * t.r * 0.4, gy + t.h * (0.62 + c * 0.13), t.z + Math.sin(i + c * 2.1) * t.r * 0.4);
        d.scale.set(t.r * (1 - c * 0.18), t.r * 0.75 * (1 - c * 0.15), t.r * (1 - c * 0.18)); d.rotation.set(0, i + c, 0); d.updateMatrix();
        crowns.setMatrixAt(i * 3 + c, d.matrix);
      }
    });
    trunks.castShadow = crowns.castShadow = true;
    surfaceGroup.add(trunks, crowns);
    // the towers of the shelks: four-sided, very tall, leaning steeply, of a metal no one knows; cables between them
    const metal = new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 0.35, metalness: 0.85 });
    const tops = [];
    for (const t of W.towers) {
      const gy = W.ground(t.x, t.z);
      const g = new THREE.Group(); g.position.set(t.x, gy, t.z); g.rotation.y = t.rot;
      const m = new THREE.Mesh(new THREE.BoxGeometry(4.5, t.h, 4.5).translate(0, t.h / 2, 0), metal);
      m.rotation.z = t.lean; g.add(m);
      surfaceGroup.add(g);
      g.updateMatrixWorld(true);
      tops.push(new THREE.Vector3(0, t.h * 0.95, 0).applyMatrix4(m.matrixWorld));
    }
    const cable = [];
    for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) if (tops[i].distanceTo(tops[j]) < 42) cable.push(tops[i].x, tops[i].y, tops[i].z, tops[j].x, tops[j].y - 3, tops[j].z);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cable, 3));
    surfaceGroup.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x3a3a34 })));
  }

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
    // under the open sky you see much further: more chunks around, fewer above and below
    const outside = y > W.surfaceY - 3, V = outside ? VIEW + 2 : VIEW, J = outside ? 1 : 2;
    for (let dk = -V; dk <= V; dk++) for (let dj = -J; dj <= J; dj++) for (let di = -V; di <= V; di++) {
      if (di * di + dk * dk > V * V + 1) continue;
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
    for (const [kk, e] of loaded) if (Math.abs(e.i - ci) > V + 1 || Math.abs(e.k - ck) > V + 1 || Math.abs(e.j - cj) > 3) unload(kk);
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
    const out = pos.y > W.surfaceY - 2.5 && Math.hypot(pos.x - W.exit.x, pos.z - W.exit.z) < 600;
    sky.visible = surfaceGroup.visible = out || pos.y > W.surfaceY - 9;
    if (sky.visible) sky.position.set(pos.x, pos.y, pos.z);
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
      const lid = add(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24), dark, 0, -0.06, 0);
      if (p.open) { lid.rotation.x = 1.25; lid.position.set(0, 0.9, 0.4); }
    } else if (p.kind === 'shelk') {
      // a shelk, dead: a rounded body on ten jointed legs, the hairless head cut off
      const hide = mat(0x4a463e, { roughness: 0.55 }), pale = mat(0x9a8a7a, { roughness: 0.6 });
      const body = add(new THREE.SphereGeometry(0.55, 16, 10), hide, 0, 0.35, 0); body.scale.set(1.25, 0.6, 0.9);
      add(new THREE.CylinderGeometry(0.12, 0.16, 0.25, 10), pale, 0.62, 0.42, 0).rotation.z = Math.PI / 2;   // the stump of the neck
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
        const upper = add(new THREE.CylinderGeometry(0.035, 0.045, 0.75, 6), hide, ca * 0.55, 0.45, sa * 0.4, -a);
        upper.rotation.z = ca > 0 ? -1.0 : 1.0; upper.rotation.order = 'YZX'; upper.rotation.y = -a;
        const lower = add(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 6), hide, ca * 1.05, 0.2, sa * 0.78, -a);
        lower.rotation.order = 'YZX'; lower.rotation.y = -a; lower.rotation.z = (ca > 0 ? 1 : -1) * 0.5;
      }
      const stain = add(new THREE.CircleGeometry(0.6, 20), mat(0x3a342c, { roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }), 0.5, 0.02, 0.1); stain.rotation.x = -Math.PI / 2;
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
    } else if (p.kind === 'cushions') {
      // the Esthetts' heaps of soft cushions in bright colours
      const cols = [0xb04a5a, 0xd0a040, 0x5a7ab0, 0x7aa060, 0xc07ab0, 0xe0d0b0];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.2, r = 0.3 + (i % 3) * 0.35;
        const c = add(new THREE.SphereGeometry(0.42, 12, 8), mat(cols[i % cols.length], { roughness: 0.95 }), Math.cos(a) * r, 0.18 + (i > 5 ? 0.3 : 0), Math.sin(a) * r);
        c.scale.set(1.3, 0.45, 1.0); c.rotation.y = a;
      }
    } else if (p.kind === 'statue') {
      // a sculpture on a pedestal (of many colours in the great square); the Esthetts make art all day
      const ped = [0xb04a4a, 0x4a6ab0, 0xc0a040, 0x4a8a5a, 0x8a4ab0, 0xd8d0c0];
      add(box(0.9, 0.8, 0.9), mat(p.ped !== undefined ? ped[p.ped % ped.length] : 0xd8d0c0, { roughness: 0.5 }), 0, 0.4, 0);
      const k2 = add(new THREE.TorusKnotGeometry(0.42, 0.13, 80, 10, 2, 3), mat(0xe8e0d0, { roughness: 0.35 }), 0, 1.45, 0);
      k2.rotation.x = 0.4;
    } else if (p.kind === 'easel') {
      // an easel with a bright painting
      const wood = mat(0x7a5a3a);
      for (const [x, rz] of [[-0.35, 0.12], [0.35, -0.12]]) { const l = add(box(0.05, 1.8, 0.05), wood, x, 0.9, 0); l.rotation.z = rz; }
      const back = add(box(0.05, 1.7, 0.05), wood, 0, 0.85, -0.35); back.rotation.x = -0.25;
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const gx = cv.getContext('2d');
      gx.fillStyle = '#f0e8d0'; gx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 14; i++) { gx.fillStyle = `hsl(${(i * 47 + p.x * 13) % 360},70%,55%)`; gx.beginPath(); gx.arc((i * 23) % 64, (i * 37) % 64, 6 + (i % 4) * 4, 0, 7); gx.fill(); }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      add(box(0.9, 0.7, 0.03), new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(k), roughness: 0.8 }), 0, 1.35, 0.08);
    } else if (p.kind === 'tapestry') {
      // a woven hanging: deep colours in bands
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64;
      const gx = cv.getContext('2d');
      const pal = ['#7a1e2a', '#c89a3a', '#1e3a6a', '#2a5a3a', '#d8c8a0'];
      for (let y = 0; y < 64; y += 4) { gx.fillStyle = pal[(y / 4 + (p.x | 0)) % pal.length]; gx.fillRect(0, y, 32, 4); }
      gx.fillStyle = '#e8d8a0'; for (let y = 6; y < 64; y += 12) gx.fillRect(10, y, 12, 3);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
      add(box(2.2, 3.4, 0.04), new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(k), roughness: 0.95 }), 0, 1.9, 0, p.rot || 0);
    } else if (p.kind === 'metalDoor') {
      // the Esthetts have true doors, of metal, high and wide
      const met = mat(0x9a9488, { metalness: 0.85, roughness: 0.35 });
      add(box(1.8, 3.2, 0.12), met, 0, 1.6, 0, p.rot || 0);
      add(box(2.1, 0.12, 0.2), met, 0, 3.26, 0, p.rot || 0);
    } else if (p.kind === 'esthettBed') {
      // a bed that would hold three men of Loor, of inlaid metal, with sheer green and brown covers
      add(box(2.6, 0.5, 2.2), mat(0x8a7a5a, { metalness: 0.7, roughness: 0.4 }), 0, 0.25, 0);
      add(box(2.5, 0.25, 2.1), mat(0x3a5a3a, { roughness: 0.9 }), 0, 0.62, 0);
      add(box(2.6, 1.1, 0.12), mat(0x9a8a6a, { metalness: 0.7, roughness: 0.35 }), 0, 0.55, -1.1);
    } else if (p.kind === 'paddedChair') {
      add(box(1.1, 0.5, 1.0), mat(0x7a3a4a, { roughness: 0.9 }), 0, 0.3, 0);
      add(box(1.1, 0.9, 0.2), mat(0x7a3a4a, { roughness: 0.9 }), 0, 0.85, -0.45);
    } else if (p.kind === 'bookshelf') {
      const wood = mat(0x5a4030);
      add(box(1.8, 2.0, 0.4), wood, 0, 1.0, 0);
      const cols = [0x7a2a2a, 0x2a4a7a, 0x3a6a3a, 0x8a7a3a, 0x5a3a6a];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) add(box(0.14, 0.34, 0.26), mat(cols[(i + r) % 5]), -0.7 + i * 0.17, 0.25 + r * 0.46, 0.08);
    } else if (p.kind === 'rug') {
      const r = add(new THREE.PlaneGeometry(3.2, 2.2), mat(0x8a3a2a, { roughness: 1 }), 0, 0.015, 0); r.rotation.x = -Math.PI / 2;
    } else if (p.kind === 'car') {
      // the car of the sheiks: a metal cylinder some twenty feet long on four thickly tyred wheels, a round opening on top
      const met = mat(0x6a7078, { metalness: 0.85, roughness: 0.3 });
      const body = add(new THREE.CylinderGeometry(1.0, 1.0, 6.2, 24), met, 0, 1.55, 0); body.rotation.z = Math.PI / 2;
      for (const sx of [-1, 1]) { const cap = add(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), met, sx * 3.1, 1.55, 0); cap.rotation.z = -sx * Math.PI / 2; }
      for (const [x, z] of [[-2.2, -1.0], [2.2, -1.0], [-2.2, 1.0], [2.2, 1.0]]) { const w = add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 18), mat(0x1e1e1e, { roughness: 0.9 }), x, 0.55, z); w.rotation.x = Math.PI / 2; }
      add(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 18), mat(0x2a2a2e, { metalness: 0.6 }), 0, 2.56, 0);
    } else if (p.kind === 'pedestal') {
      // the stone pedestal in the square from which speakers address the city
      add(new THREE.CylinderGeometry(1.1, 1.3, 0.9, 16), mat(0x8a7a66, { roughness: 0.8 }), 0, 0.45, 0);
      add(new THREE.CylinderGeometry(0.95, 1.1, 0.12, 16), mat(0x9a8a76, { roughness: 0.8 }), 0, 0.96, 0);
    } else if (p.kind === 'table') {
      const wood = mat(0x5a4030);
      add(box(1.4, 0.06, 0.8), wood, 0, 0.75, 0);
      for (const [x, z] of [[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]]) add(box(0.06, 0.75, 0.06), wood, x, 0.37, z);
    } else if (p.kind === 'sword') {
      // the sword he lost in the fight with the dogs, and came back for
      const s2 = add(box(0.9, 0.012, 0.05), mat(0xa8aab0, { metalness: 0.9, roughness: 0.3 }), 0, 0.012, 0, 0.6);
      add(box(0.04, 0.03, 0.2), mat(0x6a5a40), -0.42 * Math.cos(0.6), 0.02, 0.42 * Math.sin(0.6), 0.6);
      s2.userData.sword = true;
    } else if (p.kind === 'blast') {
      // where the charge burst among the dogs: scorched rock and debris
      const soot = mat(0x141210, { roughness: 1, transparent: true, opacity: 0.7, depthWrite: false });
      const sc = add(new THREE.CircleGeometry(2.2, 24), soot, 0, 0.03, 0); sc.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 14; i++) add(new THREE.DodecahedronGeometry(0.06 + (i % 4) * 0.04, 0), mat(0x4a443c), Math.cos(i * 2.4) * (0.6 + i * 0.12), 0.05, Math.sin(i * 2.4) * (0.6 + i * 0.12));
    } else if (p.kind === 'bonds') {
      // the cords he untied
      const rope = mat(0x7a6a4a);
      for (let i = 0; i < 5; i++) { const r = add(new THREE.TorusGeometry(0.18 + i * 0.03, 0.012, 6, 20, 4), rope, i * 0.06, 0.012, i * 0.04); r.rotation.x = Math.PI / 2; }
    }
    return g;
  }
  // pictures painted on the walls of the Esthetts' corridor (chapter 5): a dance around a sheik, the car on wheels
  // with eager people, sheiks among talking men — the world as the Esthetts see it
  function buildMural(m) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#8a6a3a'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 122);
    const fat = (px, py, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py + 14, 11, 16, 0, 0, 7); x.fill(); x.beginPath(); x.arc(px, py - 6, 7, 0, 7); x.fillStyle = '#e0b090'; x.fill(); };
    const sheik = (px, py) => { x.strokeStyle = '#2a2420'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { const a = (i < 5 ? Math.PI * 0.75 : Math.PI * 0.25) + (i % 5 - 2) * 0.22; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * -26 * (i < 5 ? 1 : -1), py + 26); x.stroke(); } x.fillStyle = '#d8b898'; x.beginPath(); x.arc(px, py - 4, 8, 0, 7); x.fill(); x.fillStyle = '#4a3a30'; x.beginPath(); x.ellipse(px, py + 8, 6, 9, 0, 0, 7); x.fill(); };
    const cols = ['#c06070', '#70a0c0', '#90c070', '#d0b050', '#b080c0'];
    if (m.pic === 'dance') { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; fat(128 + Math.cos(a) * 80, 60 + Math.sin(a) * 22, cols[i % 5]); } sheik(128, 52); }
    else if (m.pic === 'car') { x.fillStyle = '#6a7078'; x.fillRect(70, 50, 120, 30); x.beginPath(); x.arc(70, 65, 15, 0, 7); x.arc(190, 65, 15, 0, 7); x.fill(); x.fillStyle = '#222'; for (const wx of [90, 170]) { x.beginPath(); x.arc(wx, 86, 9, 0, 7); x.fill(); } for (let i = 0; i < 6; i++) fat(30 + i * 40 + (i > 2 ? 40 : 0), 92, cols[i % 5]); }
    else { sheik(70, 50); sheik(110, 54); sheik(150, 50); for (let i = 0; i < 4; i++) fat(40 + i * 60, 88, cols[(i + 2) % 5]); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const k = Math.min(1, 0.06 + lightAt(m.x, m.y + 1, m.z) * 1.4);
    const W2 = 1.5, H = 1.5;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2, H), new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(k), roughness: 0.8 }));
    // on the wall: from the axis point sideways (along z) to the rock, then turned to face along the rock's normal
    // (the corridors curve) and moved out until neither end of the picture sinks into the wall
    const y = m.y + 1.3;
    let t = 0;
    while (t < 8 && f(m.x, y, m.z + m.side * t) <= 0) t += 0.04;
    const px = m.x, pz = m.z + m.side * t, e = 0.15;
    let nx = f(px + e, y, pz) - f(px - e, y, pz), nz = f(px, y, pz + e) - f(px, y, pz - e);   // into the rock
    const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    if (nx * 0 + nz * m.side < 0.3) { nx = 0; nz = m.side; }       // a broken normal: keep the straight one
    const tx = -nz, tz = nx;                                         // along the wall
    let out = 0.06;
    for (const s of [-1, -0.5, 0.5, 1]) for (const dy of [-H / 2, H / 2]) {
      let d = out;
      while (d < 1.5 && f(px + tx * W2 * s - nx * d, y + dy, pz + tz * W2 * s - nz * d) > 0) d += 0.03;
      out = Math.max(out, d);
    }
    q.position.set(px - nx * out, y, pz - nz * out);
    q.rotation.y = Math.atan2(-nx, -nz);
    return q;
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
