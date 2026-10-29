// Great Path world facade: materials, layout, chunk streaming, prop colliders, signs, sunbeams with dust, the layered
// gate, flickering lamps, zone tracking (journal), map visibility, work lights and collision queries for the walker.
import * as THREE from '../../vendor/three.module.js';
import { createGrid, CS, CN, CW, H, F } from './grid.js';
import { makeMaterials, makeEnvironment, canvasTexture, drawSymbol } from './textures.js';
import { meshChunk, makeBaker, Emitter, groupFromBuffers } from './mesher.js';
import { buildProp } from './props.js';
import { buildLayout, ZONES, STARTS } from './layout.js';
import { disposeGroup } from '../world/mesh.js';
import { t } from '../i18n/index.js';

const VIEW = 3;              // chunks streamed around the player (radius)
const fdiv = (a, b) => Math.floor(a / b);

export function createStory(renderer) {
  const scene = new THREE.Scene();
  const mats = makeMaterials();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.35;
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI);
  const hemi = new THREE.HemisphereLight(0xfff2d8, 0x403020, 0);
  scene.add(ambient, hemi);
  scene.fog = new THREE.Fog(new THREE.Color(0.2, 0.17, 0.1), 3, 48);
  scene.background = scene.fog.color;

  // special canvas materials
  const machineTex = canvasTexture(1024, 640, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#13304a'); grd.addColorStop(1, '#050d16'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,200,255,.12)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    drawSymbol(g, w, h, { ink: '#8fd8ff', corners: '2 MONTHS' });
  });
  mats.byName.screen = new THREE.MeshBasicMaterial({ map: machineTex, vertexColors: true });
  const symTex = canvasTexture(768, 512, (g, w, h) => { g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, w, h); drawSymbol(g, w, h, { ink: '#3a4252' }); });
  mats.byName.symbol = new THREE.MeshStandardMaterial({ map: symTex, roughness: 0.8, vertexColors: true });
  const sheetTex = canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a5a40'; g.lineWidth = 3;
    for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(40 + k * 50, 20); g.lineTo(40 + k * 50, h - 20); g.stroke(); }
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(20, 30 + k * 52); g.lineTo(w - 20, 30 + k * 52); g.stroke(); }
    g.fillStyle = '#a03020'; g.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    g.font = '20px serif'; g.fillStyle = '#3a2a18'; g.fillText('LUCERON', 24, h - 26);
  });
  mats.byName.mapsheet = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9, vertexColors: true });
  mats.byName.water = new THREE.MeshStandardMaterial({ color: 0x4a7a90, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, vertexColors: true });
  // wear decals atlas: water stain, scuff, mould, crack (with alpha)
  const decalTex = canvasTexture(512, 512, (g) => {
    const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    // 0: water stain rings (top-left)
    for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(110,80,35,${0.25 - k * 0.04})`; g.lineWidth = 6 - k; g.beginPath(); g.ellipse(128, 120 + k * 6, 100 - k * 14, 80 - k * 12, 0, 0, Math.PI * 2); g.stroke(); }
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 110); gr.addColorStop(0, 'rgba(140,110,50,.18)'); gr.addColorStop(1, 'rgba(140,110,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    // 1: scuffs (top-right)
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,35,30,${0.08 + rnd() * 0.25})`; g.lineWidth = 1 + rnd() * 4; const x = 266 + rnd() * 220, y = 40 + rnd() * 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 60, y + (rnd() - 0.5) * 8); g.stroke(); }
    // 2: mould / dark spots (bottom-left)
    for (let k = 0; k < 160; k++) { const a = rnd() * 6.28, d = Math.pow(rnd(), 0.7) * 110, r = 1 + rnd() * 9; g.fillStyle = `rgba(${30 + rnd() * 20},${35 + rnd() * 25},${25},${0.15 + rnd() * 0.35})`; g.beginPath(); g.arc(128 + Math.cos(a) * d, 384 + Math.sin(a) * d * 0.8, r, 0, 6.28); g.fill(); }
    // 3: cracks (bottom-right)
    g.strokeStyle = 'rgba(30,26,20,.55)';
    for (let k = 0; k < 5; k++) { let x = 300 + rnd() * 160, y = 270; g.lineWidth = 2.5 - k * 0.3; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (rnd() - 0.5) * 30; y += 8 + rnd() * 10; g.lineTo(Math.max(260, Math.min(508, x)), Math.min(508, y)); } g.stroke(); }
  });
  mats.byName.decal = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, roughness: 0.9, vertexColors: true });
  for (const k of ['screen', 'symbol', 'mapsheet', 'water', 'decal']) mats.scale[k] = 1;

  const grid = createGrid();
  const { beams, gates } = buildLayout(grid);
  const ctx = { zones: ZONES, materials: mats.byName, scale: mats.scale };

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
      if (m.t !== 'mesh') return;
      inFlight.delete(key(m.ci, m.cj));
      if (loaded.has(key(m.ci, m.cj))) return;
      build(m.ci, m.cj, groupFromBuffers(m.list, mats.byName));
    };
    worker.onerror = (e) => { console.warn('mesh worker failed, meshing on the main thread', e.message); worker = null; inFlight.clear(); };
  } catch (e) { worker = null; }

  function build(ci, cj, meshed) {
    for (let a = -1; a <= 1; a++) grid.ensure(ci + a);
    const c = grid.chunk(ci, cj, false);
    const e = { ci, cj, group: new THREE.Group(), version: c ? c.version : -1 };
    if (c) {
      e.group.add(meshed || meshChunk(grid, c, ctx).build(mats.byName));
      const bake = makeBaker(grid, ZONES, ci, cj);
      for (const s of c.signs) e.group.add(makeSign(s, bake));
    }
    // sunbeams whose centre is in this chunk
    for (const b of beams) if (fdiv((b.x0 + b.x1) / 2, CW) === ci && fdiv((b.z0 + b.z1) / 2, CW) === cj) e.group.add(makeBeam(b));
    root.add(e.group);
    loaded.set(key(ci, cj), e);
  }
  function unload(k) {
    const e = loaded.get(k);
    e.group.traverse((o) => { if (o.userData.beam) o.userData.beam.mesh = null; });
    root.remove(e.group); disposeSigns(e.group); disposeGroup(e.group); loaded.delete(k);
  }
  // Builds missing chunks nearest first: in the worker (2 in flight) or, when sync / no worker, `budget` per call
  // on the main thread. Drops far chunks.
  function stream(x, z, budget = 1, sync = false) {
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
        inFlight.add(key(a, b)); worker.postMessage({ t: 'mesh', ci: a, cj: b });
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

  /* ---- paper notes ---- */
  const signTex = new Map();         // sign -> texture
  function drawSign(s) {
    const txt = t(s.key, s.params), [title, ...body] = txt.split('\n');
    return canvasTexture(512, 380, (g, w, h) => {
      g.fillStyle = '#efe8d4'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,100,60,.08)'; for (let k = 0; k < 40; k++) g.fillRect((k * 97) % w, (k * 53) % h, 30, 2);
      g.strokeStyle = 'rgba(80,110,160,.25)'; g.lineWidth = 1;
      for (let y = 70; y < h; y += 28) { g.beginPath(); g.moveTo(16, y); g.lineTo(w - 16, y); g.stroke(); }
      g.fillStyle = '#1e2430';
      g.font = 'bold 30px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
      g.fillText(title, 22, 48, w - 44);
      g.font = '22px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
      let y = 92;
      for (const para of body) {
        const words = para.split(' '); let line = '';
        for (const wd of words) {
          if (g.measureText(line + wd).width > w - 44) { g.fillText(line, 22, y); y += 28; line = ''; }
          line += wd + ' ';
        }
        g.fillText(line, 22, y); y += 32;
      }
    });
  }
  function makeSign(s, bake) {
    const tex = drawSign(s);
    signTex.set(s, tex);
    const l = bake(s.x, s.y, s.z, Math.sin(s.rot), 0, Math.cos(s.rot));
    const k = Math.min(1.1, Math.max(0.12, (l[0] + l[1] + l[2]) / 3));
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, color: new THREE.Color(k, k, k), side: THREE.FrontSide });
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), m);
    sheet.receiveShadow = true;
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xa02018 }));
    pin.position.set(0, 0.14, 0.01);
    g.add(sheet, pin);
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(0, s.rot, s.tilt);
    g.userData.sign = s;
    s.mat = m;
    return g;
  }
  function disposeSigns(group) {
    group.traverse((o) => { if (o.userData.sign) { const s = o.userData.sign; const tx = signTex.get(s); if (tx) tx.dispose(); signTex.delete(s); s.mat = null; } });
  }
  function relabel() {
    for (const [s, tx] of signTex) { if (!s.mat) continue; const nt = drawSign(s); s.mat.map = nt; s.mat.needsUpdate = true; tx.dispose(); signTex.set(s, nt); }
  }

  /* ---- sunbeams with dust ---- */
  const beamAlpha = canvasTexture(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.08, '#fff'); gr.addColorStop(0.75, '#aaa'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  beamAlpha.colorSpace = THREE.NoColorSpace;
  const dustMat = new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.025, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const dusts = [];
  function makeBeam(b) {
    let floor = Infinity;
    for (let z = b.z0 + CS / 2; z < b.z1; z += CS) for (let x = b.x0 + CS / 2; x < b.x1; x += CS) floor = Math.min(floor, grid.floorAt(x, z));
    const g = new THREE.Group();
    if (!Number.isFinite(floor) || !Number.isFinite(b.top)) return g;
    const h = b.top - floor, w = b.x1 - b.x0, d = b.z1 - b.z0;
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 1.06, 1, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.78).multiplyScalar(0.11 * b.sun), alphaMap: beamAlpha, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, m);
    b.mesh = mesh; b.base = 0.11 * b.sun; b.floor = floor;
    g.userData.beam = b;
    mesh.scale.set(w, h, d);
    mesh.position.set((b.x0 + b.x1) / 2, floor + h / 2, (b.z0 + b.z1) / 2);
    mesh.renderOrder = 3;
    g.add(mesh);
    // floating dust inside the beam
    const n = Math.round(Math.min(400, w * d * h * 2));
    const pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { pos[k * 3] = b.x0 + Math.random() * w; pos[k * 3 + 1] = floor + Math.random() * h; pos[k * 3 + 2] = b.z0 + Math.random() * d; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, dustMat);
    pts.userData.dust = { b, floor, h, w, d };
    g.add(pts);
    dusts.push(pts);
    return g;
  }

  /* ---- the layered gate at the start of the Great Path (01:20): doors open one after another ---- */
  const MOVES = ['right', 'left', 'up', 'down', 'right', 'up'];
  const gateDoors = [];
  const steel = mats.byName.steel.clone(); steel.vertexColors = false; steel.color.setScalar(0.32);
  for (const gt of gates) for (let i = 0; i < gt.layers; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, gt.w), steel);
    const x = gt.x + 0.15 + i * 0.3;
    m.position.set(x, H / 2, gt.z);
    m.castShadow = m.receiveShadow = true;
    // a raised rim and bolts per door
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, gt.w), steel); rim.position.y = 0.6 - (i % 3) * 0.4; m.add(rim);
    scene.add(m);
    gateDoors.push({ m, x, z: gt.z, w: gt.w, move: MOVES[i % MOVES.length], t0: 0.8 + i * 0.9, k: 0 });
  }
  let gateT = -1;                 // -1 = closed and waiting, >= 0 = opening time
  function setGate(open) {
    gateT = open ? 99 : -1;
    for (const d of gateDoors) applyDoor(d, open ? 1 : 0);
  }
  function applyDoor(d, k) {
    d.k = k;
    const e = k * k * (3 - 2 * k), m = d.m;
    m.position.set(d.x, H / 2, d.z);
    if (d.move === 'right') m.position.z = d.z + e * (d.w + 0.2);
    else if (d.move === 'left') m.position.z = d.z - e * (d.w + 0.2);
    else if (d.move === 'up') m.position.y = H / 2 + e * (H + 0.1);
    else m.position.y = H / 2 - e * (H + 0.1);
  }
  const gateSolids = () => gateDoors.filter((d) => d.k < 0.85).map((d) => [d.x - 0.06, 0, d.z - d.w / 2, d.x + 0.06, H, d.z + d.w / 2]);

  /* ---- collision queries for the walker ---- */
  const tmp = [];
  function solidsAround(x0, z0, x1, z1) {
    const ci0 = fdiv(x0, CW) - 1, ci1 = fdiv(x1, CW) + 1, cj0 = fdiv(z0, CW) - 1, cj1 = fdiv(z1, CW) + 1;
    for (let ci = ci0; ci <= ci1; ci++) { grid.ensure(ci); for (let cj = cj0; cj <= cj1; cj++) prepare(grid.chunk(ci, cj, false)); }
    grid.solidsIn(x0, z0, x1, z1, tmp);
    for (const b of gateSolids()) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1) tmp.push(b);
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

  /* ---- zones, journal, visibility for the map ---- */
  let zone = 0, onZone = null;
  const visited = new Map();        // zone id -> order
  const fogTarget = new THREE.Color();
  let seenT = 0;
  function markSeen(px, pz, py) {
    const R = 15, gx0 = Math.floor(px / CS), gz0 = Math.floor(pz / CS), n = R / CS;
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      if (dx * dx + dz * dz > n * n) continue;
      const gx = gx0 + dx, gz = gz0 + dz;
      const [c, k] = grid.at(gx, gz);
      if (!c || c.seen[k]) continue;
      // line of sight through open cells at eye height
      const steps = Math.max(Math.abs(dx), Math.abs(dz));
      let ok = true;
      for (let s = 1; s < steps; s++) {
        const [cc, kk] = grid.at(Math.floor(gx0 + 0.5 + dx * s / steps), Math.floor(gz0 + 0.5 + dz * s / steps));
        if (!cc || !cc.open[kk] || cc.floor[kk] > py + 1.4 || cc.ceil[kk] < py + 1.2) { ok = false; break; }
      }
      if (ok) { c.seen[k] = 1; c.seenV = (c.seenV || 0) + 1; }
    }
  }

  /* ---- lamps: flicker ---- */
  let flickT = 0;
  let workLights = false;
  function update(dt, time, pos) {
    // flickering tubes
    flickT -= dt;
    if (flickT <= 0) { flickT = 0.03 + Math.random() * 0.15; mats.byName.lampFlicker.color.setScalar(Math.random() < 0.35 ? 0.1 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15); }
    // gate
    if (gateT >= 0 && gateT < 20) { gateT += dt; for (const d of gateDoors) applyDoor(d, Math.max(0, Math.min(1, (gateT - d.t0) / 1.2))); }
    // dust drift
    for (const p of dusts) {
      if (!p.parent || !p.parent.parent) continue;
      const { b, floor, h } = p.userData.dust, a = p.geometry.attributes.position;
      if (Math.abs((b.x0 + b.x1) / 2 - pos.x) > 30 || Math.abs((b.z0 + b.z1) / 2 - pos.z) > 30) continue;
      for (let k = 0; k < a.count; k++) {
        let y = a.getY(k) - dt * 0.05, x = a.getX(k) + Math.sin(time * 0.3 + k) * dt * 0.03;
        if (y < floor) y += h;
        if (x < b.x0) x = b.x1; if (x > b.x1) x = b.x0;
        a.setXY(k, x, y);
      }
      a.needsUpdate = true;
    }
    // zone, fog, journal
    const z = grid.zoneAt(pos.x, pos.z);
    if (z && z !== zone) {
      zone = z;
      if (!visited.has(z)) { visited.set(z, visited.size + 1); if (onZone) onZone(z, true); } else if (onZone) onZone(z, false);
    }
    const zd = ZONES[zone] || ZONES[0];
    fogTarget.setRGB(zd.fog[0], zd.fog[1], zd.fog[2]);
    if (workLights) fogTarget.multiplyScalar(1.8);
    scene.fog.color.lerp(fogTarget, 1 - Math.exp(-1.2 * dt));
    const far = zone === Z_CHAPEL ? 70 : 46;
    scene.fog.far += (far - scene.fog.far) * Math.min(1, dt);
    seenT -= dt;
    if (seenT <= 0) { seenT = 0.25; markSeen(pos.x, pos.z, pos.y); }
  }
  function setWorkLights(on) {
    workLights = on;
    ambient.intensity = on ? Math.PI * 2.4 : Math.PI;
    hemi.intensity = on ? 1.2 : 0;
    scene.environmentIntensity = on ? 0.6 : 0.35;
  }

  // Nearest note the player is looking at (within 2.2 m), or null.
  function signNear(pos, fwdX, fwdZ) {
    let best = null, bd = 2.2;
    const ci = fdiv(pos.x, CW), cj = fdiv(pos.z, CW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = grid.chunk(ci + di, cj + dj, false);
      if (!c) continue;
      for (const s of c.signs) {
        const d = Math.hypot(s.x - pos.x, s.z - pos.z);
        if (d > bd || Math.abs(s.y - (pos.y + 1.5)) > 1.4) continue;
        const nx = Math.sin(s.rot), nz = Math.cos(s.rot);
        if (fwdX * -nx + fwdZ * -nz < 0.35) continue;
        bd = d; best = s;
      }
    }
    return best;
  }

  /* ---- skylights: sun exposure and the scratching episodes ---- */
  // Sun strength at a point: > 0 when standing in a sun square under a skylight.
  function sunAt(x, z) {
    if (!(grid.flagsAt(x, z) & F.SKY)) return 0;
    for (const b of beams) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.sun;
    return 0.8;
  }
  // A loaded skylight near the player (within 18 m), chosen at random with nearer ones more likely.
  function pickSkylight(pos) {
    const c = [];
    for (const b of beams) {
      if (!b.mesh) continue;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - pos.x, cz - pos.z);
      if (d < 18 && d > 2) c.push([b, 1 / (d + 3)]);
    }
    if (!c.length) return null;
    let r = Math.random() * c.reduce((s, e) => s + e[1], 0);
    let pick = c[0][0];
    for (const [b, w] of c) { r -= w; if (r <= 0) { pick = b; break; } }
    return { x: (pick.x0 + pick.x1) / 2, y: pick.top, z: (pick.z0 + pick.z1) / 2, beam: pick };
  }
  // A dark shape pressed against the glass while something scratches at it; the sunbeam dims.
  const shapeTex = canvasTexture(256, 256, (g) => {
    g.filter = 'blur(6px)';
    g.fillStyle = 'rgba(0,0,0,.95)';
    g.beginPath(); g.ellipse(128, 150, 46, 56, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const a = -0.75 + k * 0.5;
      g.save(); g.translate(128 + Math.sin(a) * 40, 120 - Math.cos(a) * 30); g.rotate(a);
      g.beginPath(); g.ellipse(0, -48, 9, 50, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.filter = 'none';
  });
  const shape = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shapeTex, transparent: true, depthWrite: false, opacity: 0, fog: false, color: 0x000000 }));
  shape.rotation.x = Math.PI / 2; shape.renderOrder = 4; shape.visible = false;
  scene.add(shape);
  let dimmed = null;
  function scratchVisual(ep) {
    if (dimmed && dimmed.mesh) dimmed.mesh.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(dimmed.base);
    dimmed = null;
    if (!ep) { shape.visible = false; return; }
    const { sky, t, dur } = ep, b = sky.beam;
    const k = Math.max(0, Math.min(1, t / 0.8, (dur - t) / 1.2));
    shape.visible = k > 0;
    shape.material.opacity = k;
    shape.position.set(sky.x + Math.sin(t * 0.9) * 0.35, sky.y - 0.03, sky.z + Math.cos(t * 0.6) * 0.25);
    shape.rotation.z = Math.sin(t * 0.4) * 0.5;
    if (b && b.mesh) { dimmed = b; b.mesh.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(b.base * (1 - 0.45 * k)); }
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

  return {
    scene, grid, zones: ZONES, starts: STARTS, lightAt,
    get zone() { return zone; }, get visited() { return visited; },
    set onZone(fn) { onZone = fn; },
    get loadedCount() { return loaded.size; },
    stream, preload, preloadAll, update, sunAt, pickSkylight, scratchVisual, blocked, support, signNear, relabel,
    setGate, startGate() { setGate(false); gateT = 0; },
    setWorkLights, get workLights() { return workLights; },
    resetVisits() { visited.clear(); zone = 0; },
    flagsAt: (x, z) => grid.flagsAt(x, z),
  };
}
const Z_CHAPEL = ZONES.findIndex((z) => z.key === 'chapel');
