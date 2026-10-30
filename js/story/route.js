// Story guide for the Great Path world: places in the order the story visits them, a route to the next one found
// on the cell grid (breadth-first search that respects walls, step heights and drops), chalk arrows on the floor
// along the route, and data for the HUD arrow and the map.
import * as THREE from '../../vendor/three.module.js';
import { CS } from './grid.js';
import { canvasTexture } from './textures.js';

// key: i18n gp.s.<key> (title) and gp.sd.<key> (what happens there); t: story timestamp; r: reach radius; y: required floor level
// The story starts where the film starts: at the gate of the Great Path (02:18), then follows the film's flashbacks
// in order, and ends back on the Great Path. Each step has a statue scene and a plaque (statues.js, layout.js).
export const STEPS = [
  { key: 'gate', t: '02:18', x: 56, z: 0, r: 3.5 },
  { key: 'classroom', t: '03:14', x: 46, z: -28, r: 6 },
  { key: 'sketch', t: '06:21', x: 6.5, z: -8.4, r: 3 },
  { key: 'friends', t: '06:45', x: 0, z: 116, r: 4 },
  { key: 'rebecca', t: '10:51', x: 46, z: -18, r: 4 },
  { key: 'door', t: '12:32', x: 0, z: 155, r: 4 },
  { key: 'station', t: '15:38', x: -0.6, z: 220.6, r: 4 },
  { key: 'blue', t: '15:55', x: 0, z: 393, r: 4 },
  { key: 'chapel', t: '16:44', x: 0, z: 449, r: 6, y: -6 },
  { key: 'cafeteria', t: '21:16', x: 29.5, z: -6.2, r: 3.5 },
  { key: 'holding', t: '25:21', x: 50, z: 14, r: 3 },
  { key: 'court', t: '35:33', x: 51, z: 4, r: 3.5 },
  { key: 'office', t: '42:56', x: -36.5, z: -11, r: 2.2 },
  { key: 'deadEnd', t: '45:47', x: -116.6, z: 310, r: 4 },
  { key: 'collector', t: '47:42', x: 1.75, z: 1.3, r: 2.5 },
  { key: 'machine', t: '49:15', x: -24, z: -44, r: 2.5 },
  { key: 'visit', t: '53:10', x: -28, z: -7, r: 3 },
  { key: 'path', t: '02:34', x: 96, z: 0, r: 5 },
  // part 2: the journey (times from the full story video, see docs/GREAT_PATH.md)
  { key: 'jCable', t: '1:00:31', x: 170, z: 0, r: 3 },
  { key: 'jNight', t: '1:02:14', x: 300, z: 0, r: 3 },
  { key: 'jMarks', t: '1:03:15', x: 344, z: 0, r: 3 },
  { key: 'jCarpet', t: '1:07:28', x: 562, z: 0, r: 3 },
  { key: 'jCross', t: '1:09:32', x: 640, z: 0, r: 3 },
  { key: 'jRamp', t: '1:12:04', x: 784, z: -27, r: 3 },
  { key: 'jSkylight', t: '1:14:42', x: 1076, z: 0, r: 3 },
  { key: 'jTurn', t: '1:15:33', x: 1120, z: 0, r: 3 },
  { key: 'jBlackout', t: '1:16:05', x: 1240, z: 0, r: 4 },
  { key: 'jLight', t: '1:23:16', x: 1308, z: 0, r: 4 },
  { key: 'jLoop', t: '1:26:35', x: 1464, z: -14, r: 3.5 },
  { key: 'jBar', t: '1:29:25', x: 1624, z: -2.6, r: 3 },
  { key: 'jWater', t: '1:30:13', x: 1780, z: -1.8, r: 3 },
  { key: 'jGrate', t: '1:31:07', x: 1928, z: -1, r: 3 },
  { key: 'jColumns', t: '1:31:28', x: 2028, z: -1, r: 4 },
  { key: 'jDistrict', t: '1:32:07', x: 2184, z: -1, r: 4 },
  { key: 'jShaft', t: '1:33:43', x: 2311, z: -1, r: 3, y: -7.45 },
  { key: 'jSqueeze', t: '1:39:43', x: 2650, z: -1, r: 3 },
  { key: 'jLightAgain', t: '1:43:32', x: 2712, z: -1, r: 3 },
  { key: 'jTiles', t: '1:45:22', x: 2840, z: -1, r: 3 },
  { key: 'jLever', t: '1:46:32', x: 2896, z: -2.4, r: 1.6 },
  { key: 'jRoof', t: '1:47:27', x: 2905, z: -1, r: 3, y: -5.55 },
  { key: 'jMirror', t: '1:49:36', x: 2971, z: -1, r: 3 },
  { key: 'jInscription', t: '1:50:15', x: 2936, z: -1, r: 4, y: -5.55 },
];

export function createGuide(story) {
  const grid = story.grid;
  let step = 0, path = [], target = null, lastFrom = null, age = 99, near = 0;

  /* ---- route search on 0.5 m cells inside a box around the player and the target ---- */
  function search(from, to) {
    const M = 40;
    const x0 = Math.floor((Math.min(from.x, to.x) - M) / CS), z0 = Math.floor((Math.min(from.z, to.z) - M) / CS);
    const W = Math.ceil((Math.abs(from.x - to.x) + 2 * M) / CS) + 1, Hh = Math.ceil((Math.abs(from.z - to.z) + 2 * M) / CS) + 1;
    if (W * Hh > 900000) return null;
    const N = W * Hh, floor = new Float32Array(N).fill(NaN), prev = new Int32Array(N).fill(-1), q = new Int32Array(N);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const [c, k] = grid.at(x0 + i, z0 + j);
      if (c && c.open[k] && c.ceil[k] - c.floor[k] >= 0.6) floor[i + j * W] = c.floor[k];
    }
    const s = (Math.floor(from.x / CS) - x0) + (Math.floor(from.z / CS) - z0) * W, e = (Math.floor(to.x / CS) - x0) + (Math.floor(to.z / CS) - z0) * W;
    if (Number.isNaN(floor[s]) || Number.isNaN(floor[e])) return null;
    let h = 0, tl = 0; q[tl++] = s; prev[s] = s;
    while (h < tl) {
      const u = q[h++];
      if (u === e) break;
      const ux = u % W, uz = (u / W) | 0, fu = floor[u];
      for (let d = 0; d < 4; d++) {
        const vx = ux + (d === 0) - (d === 1), vz = uz + (d === 2) - (d === 3);
        if (vx < 0 || vz < 0 || vx >= W || vz >= Hh) continue;
        const v = vx + vz * W;
        if (prev[v] >= 0 || Number.isNaN(floor[v]) || floor[v] - fu > 0.45) continue;
        prev[v] = u; q[tl++] = v;
      }
    }
    if (prev[e] < 0) return null;
    const out = [];
    for (let u = e, n = 0; u !== s; u = prev[u], n++) if (n % 2 === 0) out.push({ x: (x0 + u % W + 0.5) * CS, z: (z0 + ((u / W) | 0) + 0.5) * CS, y: floor[u] });
    out.push({ x: from.x, z: from.z, y: floor[s] });
    return out.reverse();
  }

  /* ---- chalk arrows on the floor ---- */
  const arrowTex = canvasTexture(64, 64, (g) => {
    g.strokeStyle = 'rgba(255,252,240,.95)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(32, 54); g.lineTo(32, 12); g.moveTo(16, 28); g.lineTo(32, 12); g.lineTo(48, 28); g.stroke();
  });
  const COUNT = 14;
  const arrows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.42).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), COUNT);
  arrows.renderOrder = 2; arrows.frustumCulled = false; arrows.count = 0;
  story.scene.add(arrows);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  function placeArrows(show) {
    arrows.count = 0;
    if (!show || path.length < 2) return;
    let n = 0, acc = 0;
    for (let i = Math.max(1, near); i < path.length && n < COUNT; i++) {
      const a = path[i - 1], b = path[i];
      acc += Math.hypot(b.x - a.x, b.z - a.z);
      if (acc < 1.6) continue;
      acc = 0;
      q4.setFromAxisAngle(up, Math.atan2(-(b.x - a.x), -(b.z - a.z)));
      m4.compose(pos.set(b.x, b.y + 0.012, b.z), q4, one);
      arrows.setMatrixAt(n++, m4);
    }
    arrows.count = n; arrows.instanceMatrix.needsUpdate = true;
  }

  return {
    get step() { return step; },
    get target() { return target; },
    get path() { return path; },
    get done() { return step >= STEPS.length; },
    set(n) { step = Math.max(0, Math.min(STEPS.length, n | 0)); path = []; age = 99; },
    // returns the step that was just reached (or null); keeps the route fresh
    update(dt, w, show) {
      target = STEPS[step] || null;
      if (!target) { arrows.count = 0; path = []; return null; }
      const d = Math.hypot(w.x - target.x, w.z - target.z);
      if (d < target.r && (target.y === undefined || Math.abs(w.y - target.y) < 1.5)) {
        const reached = target; step++; path = []; age = 99;
        return reached;
      }
      // where on the route are we?
      let best = 1e9;
      for (let i = Math.max(0, near - 10); i < Math.min(path.length, near + 40); i++) {
        const dd = Math.hypot(path[i].x - w.x, path[i].z - w.z);
        if (dd < best) { best = dd; near = i; }
      }
      age += dt;
      const moved = !lastFrom || Math.hypot(lastFrom.x - w.x, lastFrom.z - w.z) > 3;
      if (!path.length || (best > 3 && age > 1.5 && moved)) {
        const p = search(w, target);
        age = 0; lastFrom = { x: w.x, z: w.z };
        if (p) { path = p; near = 0; }
      }
      placeArrows(show);
      return null;
    },
    // direction (world radians, atan2 convention used by yaw) and distance along the route to the next waypoint
    heading(w) {
      if (!target) return null;
      let p = target;
      if (path.length) { let acc = 0; for (let i = near; i < path.length; i++) { p = path[i]; acc += 1; if (Math.hypot(p.x - w.x, p.z - w.z) > 4) break; } }
      let len = 0;
      for (let i = Math.max(1, near); i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      if (!path.length) len = Math.hypot(target.x - w.x, target.z - w.z);
      return { ang: Math.atan2(-(p.x - w.x), -(p.z - w.z)), dist: len };
    },
    hide() { arrows.count = 0; },
  };
}
