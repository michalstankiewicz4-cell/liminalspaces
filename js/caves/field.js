// The cave world of "Tumithak of the Corridors" (Charles R. Tanner, 1932) as a signed distance field: the carved
// corridors of the cities (Loor, Nonone, Yakra — arched, about 4.5 m high and wide, brown glassy walls, lamp plates on
// the ceiling), the steep narrow passages and ladder shafts between them, the unlit Dark Corridors and the natural caves
// around them. Pure data (no three.js), deterministic: the main thread and the mesh worker build the same world.
//   f(x, y, z) > 0 = rock, < 0 = air. Primitives (tubes with flat floors, rooms, shafts, caverns) are unioned with a
//   smooth minimum, then displaced by noise whose strength depends on the primitive (glassy corridors vs rough caves).
// Coordinates in metres: +x east, +y up, +z south. Loor (the deepest city, the start) is around the origin.
import { mulberry32 } from '../core/util.js';
import { fbm3, noise3 } from './noise.js';

export const CH = 16;                 // chunk size (m), cubic chunks
export const VOX = 0.5;               // voxel size of the mesher (m)

/* ---- zones: name key, light (ambient), albedo tint, roughness, fog, lamp colour, map colour ---- */
export const ZONES = [
  { key: 'rock', amb: 0.0, tint: [0.42, 0.36, 0.3], rough: 0.9, fog: [0.0, 0.0, 0.0], map: '#333' },
  { key: 'loor', amb: 0.012, tint: [0.5, 0.33, 0.2], rough: 0.32, fog: [0.035, 0.032, 0.03], map: '#c09060', far: 56 },
  { key: 'machine', amb: 0.015, tint: [0.46, 0.32, 0.22], rough: 0.35, fog: [0.04, 0.036, 0.034], map: '#a08070', far: 54 },
  { key: 'deadEnd', amb: 0.004, tint: [0.44, 0.32, 0.22], rough: 0.5, fog: [0.02, 0.018, 0.016], map: '#806048', far: 40 },
  { key: 'passage', amb: 0.004, tint: [0.4, 0.33, 0.26], rough: 0.7, fog: [0.02, 0.019, 0.018], map: '#907860', far: 44 },
  { key: 'shaft', amb: 0.004, tint: [0.38, 0.33, 0.28], rough: 0.8, fog: [0.02, 0.019, 0.018], map: '#a09080', far: 44 },
  { key: 'nonone', amb: 0.012, tint: [0.48, 0.36, 0.24], rough: 0.36, fog: [0.035, 0.033, 0.03], map: '#c8a070', far: 56 },
  { key: 'yakra', amb: 0.01, tint: [0.45, 0.3, 0.22], rough: 0.42, fog: [0.035, 0.028, 0.024], map: '#b07850', far: 54 },
  { key: 'dark', amb: 0.0015, tint: [0.36, 0.31, 0.27], rough: 0.75, fog: [0.006, 0.006, 0.006], map: '#605850', far: 40 },
  { key: 'cave', amb: 0.001, tint: [0.4, 0.37, 0.33], rough: 0.9, fog: [0.005, 0.005, 0.005], map: '#706860', far: 40 },
  { key: 'esthett', amb: 0.03, tint: [0.86, 0.84, 0.8], rough: 2.35, fog: [0.07, 0.065, 0.06], map: '#e8e0f0', far: 60 },     // rough >= 2: carved walls, inlaid floor
  { key: 'pit', amb: 0.004, tint: [0.42, 0.38, 0.33], rough: 0.7, fog: [0.02, 0.02, 0.02], map: '#c0b090', far: 44 },
  // the Surface at sunset: warm light, a red sun low over the trees; brown dust by the pit, grass further out (grass)
  { key: 'surface', amb: 1.0, ambC: [1.0, 0.74, 0.58], sun: [0.95, 0.21, 0.25, 0.55, 0.22, 0.1], tint: [0.5, 0.38, 0.27], grass: [0.22, 0.34, 0.12], rough: 0.95, fog: [0.62, 0.48, 0.44], map: '#d8c8a0', far: 320, sky: true },
  { key: 'esthettRoom', amb: 0.01, tint: [0.3, 0.38, 0.6], rough: 0.7, fog: [0.03, 0.035, 0.05], map: '#6080c0', far: 40 },
  { key: 'square', amb: 0.1, tint: [0.9, 0.88, 0.84], rough: 2.25, fog: [0.08, 0.075, 0.07], map: '#f0e8d8', far: 90 },
  { key: 'upper', amb: 0.002, tint: [0.4, 0.35, 0.3], rough: 0.6, fog: [0.01, 0.01, 0.01], map: '#807060', far: 40 },
  // chapter 6: the road of the car, the abandoned corridors, the feast room, the hall of black stone
  { key: 'road', amb: 0.04, tint: [0.8, 0.76, 0.7], rough: 0.25, fog: [0.08, 0.075, 0.07], map: '#f0e0c0', far: 70 },
  { key: 'metal', amb: 0.03, tint: [0.56, 0.6, 0.64], rough: 0.08, fog: [0.06, 0.065, 0.07], map: '#a0b0c8', far: 70 },
  { key: 'roughRoad', amb: 0.001, tint: [0.4, 0.37, 0.33], rough: 0.9, fog: [0.005, 0.005, 0.005], map: '#706860', far: 44 },
  { key: 'hymn', amb: 0.04, tint: [0.94, 0.92, 0.9], rough: 2.3, fog: [0.08, 0.075, 0.075], map: '#ffffff', far: 70 },
  { key: 'abandoned', amb: 0.002, tint: [0.52, 0.48, 0.42], rough: 0.85, fog: [0.02, 0.019, 0.017], map: '#a09070', far: 44 },
  { key: 'feast', amb: 0.006, tint: [0.56, 0.5, 0.46], rough: 0.6, fog: [0.012, 0.01, 0.01], map: '#c08080', far: 50 },
  { key: 'black', amb: 0.003, tint: [0.26, 0.26, 0.28], rough: 0.3, fog: [0.01, 0.01, 0.012], map: '#505068', far: 40 },
];
export const Z = Object.fromEntries(ZONES.map((z, i) => [z.key, i]));

/* ---- primitives ---- */
// tube: axis a->b along the floor (x, floor y, z), half width w, height h, top rounding rt, bottom rounding rb
// room: floor centre (x, y, z), half sizes hw, hd, height h, rounding rr
// shaft: vertical cylinder (x, z), radius r, from y0 to y1
// cavern: ellipsoid centre, radii rx, ry, rz, cut by a floor at y = fl
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function dTube(s, x, y, z) {
  const px = x - s.ax, pz = z - s.az;
  let t = px * s.dx + pz * s.dz;                      // along the axis (m)
  const u = Math.abs(px * s.dz - pz * s.dx);          // across (horizontal)
  const tc = t < 0 ? 0 : t > s.L ? s.L : t;
  // above the floor line (stairs: the line goes up in steps of `run` metres)
  const v = y - (s.ay + s.sy * (s.run ? Math.min(s.L, Math.floor(tc / s.run + 0.5) * s.run) : tc));
  const beyond = t < -s.ext ? -s.ext - t : t > s.L + s.ext ? t - s.L - s.ext : 0;
  const hh = s.h / 2, rr = v > hh ? s.rt : s.rb;
  const qx = u - s.w + rr, qy = Math.abs(v - hh) - hh + rr;
  const d2 = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  return beyond > 0 ? (d2 > 0 ? Math.hypot(d2, beyond) : beyond) : d2;
}
function dRoom(r, x, y, z) {
  const v = y - r.y, hh = r.h / 2;
  const qx = Math.abs(x - r.x) - r.hw + r.rr, qz = Math.abs(z - r.z) - r.hd + r.rr, qy = Math.abs(v - hh) - hh + r.rr;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r.rr;
}
function dShaft(s, x, y, z) {
  return smax(Math.hypot(x - s.x, z - s.z) - s.r, Math.max(s.y0 - y, y - s.y1), 0.6);
}
function dCavern(c, x, y, z) {
  const ex = (x - c.x) / c.rx, ey = (y - c.y) / c.ry, ez = (z - c.z) / c.rz;
  const e = (Math.sqrt(ex * ex + ey * ey + ez * ez) - 1) * Math.min(c.rx, c.ry, c.rz);
  return smax(e, c.fl - y, 1.2);
}
const DIST = { tube: dTube, room: dRoom, shaft: dShaft, cavern: dCavern };

/* ---- the world ---- */
export function buildCaves() {
  const R = mulberry32(1932);
  const prims = [], lamps = [], ladders = [], curtains = [], labels = [], props = [], murals = [];
  // story markers: a stone stele with the chapter's number where something of the story happens (read it up close)
  const markers = [];
  const mark = (key, ch, x, y, z) => markers.push({ key, ch, x, y, z });
  const starts = {};

  function tube(a, b, o) {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1e-3;
    const s = { k: 'tube', ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], dx: dx / L, dz: dz / L, L, sy: (b[1] - a[1]) / L,
      w: o.w, h: o.h, rt: Math.min(o.rt ?? o.w * 0.75, o.w - 0.01, o.h / 2 - 0.01), rb: o.rb ?? 0.35, ext: o.ext ?? o.w * 0.6, amp: o.amp ?? 0.05, zone: o.zone, run: o.run || 0 };
    const pad = Math.max(o.w, o.h) + 2.5;
    s.box = [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - 2.5, Math.min(a[2], b[2]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + o.h + 2.5, Math.max(a[2], b[2]) + pad];
    s.floorAt = (x, z) => { const t = Math.max(0, Math.min(L, (x - s.ax) * s.dx + (z - s.az) * s.dz)); return s.ay + s.sy * t; };
    prims.push(s);
    return s;
  }
  // a smooth path through control points (Catmull-Rom, ~3 m pieces); lamps on the ceiling every `lamp` metres
  function path(pts, o) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) / 3));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    let run = o.lampStart ?? (o.lamp ? o.lamp / 2 : 0);
    for (let i = 0; i < out.length - 1; i++) {
      tube(out[i], out[i + 1], o);
      if (!o.lamp) continue;
      const seg = Math.hypot(out[i + 1][0] - out[i][0], out[i + 1][2] - out[i][2]);
      run -= seg;
      while (run <= 0) {
        const f = 1 + run / seg, p = [0, 1, 2].map((c) => out[i][c] + (out[i + 1][c] - out[i][c]) * f);
        addLamp(p[0], p[1] + o.h, p[2], o);
        run += o.lamp;
      }
    }
    return out;
  }
  function addLamp(x, ceil, z, o) {
    const r = R(), dead = r < (o.dead ?? 0.06), flicker = !dead && r < (o.dead ?? 0.06) + 0.05;
    const p = (o.lampP ?? 0.75) * (flicker ? 0.6 : 1);
    const c = o.col || [0.86, 0.92, 1.0];
    lamps.push({ x, y: ceil - 0.08, z, ceil, p: dead ? 0 : p, dead, flicker, r: c[0], g: c[1], b: c[2] });
  }
  // a wandering line of control points from `p` heading `ang` (radians, 0 = +x), `n` steps of `step` m, rising `rise` per step
  function wander(p, ang, n, step, rise, turn = 0.35, bias = 0) {
    const pts = [p.slice()];
    let a = ang, c = p.slice();
    for (let i = 0; i < n; i++) {
      a += (R() - 0.5) * turn + bias;
      c = [c[0] + Math.cos(a) * step, c[1] + rise * (0.5 + R()), c[2] + Math.sin(a) * step];
      pts.push(c);
    }
    return pts;
  }
  const room = (x, y, z, hw, hd, h, o) => { const r = { k: 'room', x, y, z, hw, hd, h, rr: o.rr ?? 0.7, amp: o.amp ?? 0.05, zone: o.zone }; r.box = [x - hw - 2.5, y - 2.5, z - hd - 2.5, x + hw + 2.5, y + h + 2.5, z + hd + 2.5]; r.floorAt = () => y; prims.push(r); return r; };
  const shaft = (x, z, y0, y1, r, zone, lad = true) => {
    const s = { k: 'shaft', x, z, y0, y1, r, amp: 0.08, zone }; s.box = [x - r - 2.5, y0 - 2.5, z - r - 2.5, x + r + 2.5, y1 + 2.5, z + r + 2.5]; s.floorAt = () => y0; prims.push(s);
    // the ladder: metal rungs on the east wall from the bottom to just above the floor at the top (2.5 m under the
    // shaft's top: the way on leaves eastwards over the ladder)
    if (lad) ladders.push({ x: x + r - 0.08, z, y0, y1: y1 - 2.2, nx: -1, nz: 0, cx: x, cz: z, r, px: x + r - 0.62, pz: z });   // px, pz: where the climber hangs
    return s;
  };
  const cavern = (x, y, z, rx, ry, rz, fl, zone, amp = 0.8) => { const c = { k: 'cavern', x, y, z, rx, ry, rz, fl, amp, zone }; c.box = [x - rx - 3, fl - 3, z - rz - 3, x + rx + 3, y + ry + 3, z + rz + 3]; c.floorAt = () => fl; prims.push(c); return c; };

  /* ---- a city: an avenue with cross corridors, rooms behind curtained doorways, lamp plates ---- */
  const COR = { w: 2.25, h: 4.5, rt: 1.7, rb: 0.3, amp: 0.035 };
  function city(x0, y, z0, len, zone, o = {}) {
    const lampO = { lamp: 9, dead: o.dead ?? 0.05, lampP: o.lampP ?? 0.75 };
    path([[x0, y, z0], [x0 + len, y, z0]], { ...COR, zone, ...lampO });
    const cross = [];
    for (let x = x0 + 14; x < x0 + len - 8; x += 22 + Math.floor(R() * 10)) {
      const north = 20 + R() * 40, south = 20 + R() * 40, jog = (R() - 0.5) * 6;
      path([[x, y, z0], [x + jog, y, z0 - north / 2], [x, y, z0 - north]], { ...COR, w: 1.9, h: 4.2, zone, ...lampO });
      path([[x, y, z0], [x - jog, y, z0 + south / 2], [x, y, z0 + south]], { ...COR, w: 1.9, h: 4.2, zone, ...lampO });
      cross.push([x, -north, south]);
      // rooms on both sides of the cross corridor, every ~7 m
      for (const [sgn, l] of [[-1, north], [1, south]]) for (let d = 6; d < l - 3; d += 6 + R() * 3) {
        if (R() < 0.3) continue;
        const side = R() < 0.5 ? -1 : 1, rz = z0 + sgn * d, depth = 3 + R() * 2.5, rw = 2 + R() * 1.5;
        const dxw = x + side * (1.9 + 0.7), rx = x + side * (1.9 + 1.4 + rw);
        tube([x + side * 1.6, y, rz], [dxw + side * 1.0, y, rz], { w: 0.75, h: 2.3, rt: 0.5, rb: 0.15, amp: 0.03, zone, ext: 0.2 });
        room(rx, y, rz, rw, depth / 2 + 0.8, 2.9, { rr: 0.9, zone });
        curtains.push({ x: x + side * 2.05, y, z: rz, rot: Math.PI / 2, w: 1.5, h: 2.3 });
        if (R() < 0.35) lamps.push({ x: rx, y: y + 2.75, z: rz, ceil: y + 2.9, p: 0.45, dead: false, flicker: false, r: 0.9, g: 0.95, b: 1, small: true });
      }
    }
    return cross;
  }

  /* ---- Loor: the deepest city (the start) ---- */
  const LY = 0;
  const loorCross = city(-90, LY, 0, 190, Z.loor);
  labels.push({ key: 'loor', x: 0, y: LY, z: 0 });
  // the great square of Loor, where the two main corridors cross; the stone pedestal for speakers (chapter 7)
  path([[12, LY, -60], [12, LY, 60]], { ...COR, zone: Z.loor, lamp: 9 });
  room(12, LY, 0, 10, 10, 6, { rr: 3, zone: Z.loor });
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) addLamp(12 + dx, LY + 6, dz, { dead: 0 });
  props.push({ kind: 'pedestal', x: 12, y: LY, z: 0 });
  labels.push({ key: 'loorSquare', x: 12, y: LY, z: 0 });
  mark('glory', 7, 15.5, LY, 3.5);
  starts.loor = { x: -70, y: LY, z: 0, yaw: -Math.PI / 2 };
  // the hall of the great machine that never stops (its pulse is felt everywhere in Loor)
  path([[-40, LY, 0], [-40, LY, 22]], { ...COR, w: 1.9, h: 4.2, zone: Z.machine, lamp: 8 });
  room(-40, LY, 38, 13, 12, 9, { rr: 3, zone: Z.machine, amp: 0.05 });
  props.push({ kind: 'machine', x: -40, y: LY, z: 38 });
  for (const [x, z] of [[-48, 31], [-32, 31], [-48, 45], [-32, 45]]) addLamp(x, LY + 9, z, { lampP: 0.9, dead: 0 });
  labels.push({ key: 'machine', x: -40, y: LY, z: 38 });
  // the dusty dead end where the book was found: unlit, sloping upwards (chapter 1)
  const dead = path([[-90, LY, 0], [-104, LY + 0.5, 0], [-120, LY + 2.5, -6], [-136, LY + 5, -8]], { ...COR, w: 1.9, h: 4, zone: Z.deadEnd, amp: 0.08 });
  // abandoned rooms on its north side, each at the corridor's own floor level (no steps you could not climb back)
  const deadAt = (x) => dead.reduce((b, q) => (Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b));
  for (let k = 0; k < 4; k++) {
    const [x, y, z] = deadAt(-110 - k * 6);
    tube([x, y, z - 1.4], [x, y, z - 5.5], { w: 0.7, h: 2.2, rt: 0.5, rb: 0.15, zone: Z.deadEnd, ext: 0.2 });
    room(x, y, z - 8, 2.2, 2.5, 2.8, { rr: 0.9, zone: Z.deadEnd });
    curtains.push({ x, y, z: z - 1.85, rot: 0, w: 1.4, h: 2.2, torn: true });
    if (k === 2) { props.push({ kind: 'book', x: x + 0.8, y, z: z - 9.2 }); mark('book', 1, x - 1.2, y, z - 8.5); }   // the metal-leaf book, in the dust
  }
  { const [x, y, z] = deadAt(-93); mark('friends', 1, x, y, z + 1.3); }
  // Tumithak's home: his father Tumlook is an alimentarist (makes food from rock); the three gifts on the table (chapter 2)
  {
    const [x, y, z] = deadAt(-99);
    tube([x, y, z - 1.4], [x, y, z - 5.5], { w: 0.75, h: 2.3, rt: 0.5, rb: 0.15, zone: Z.loor, ext: 0.2 });
    room(x, y, z - 9, 3.4, 3.2, 3, { rr: 1, zone: Z.loor });
    curtains.push({ x, y, z: z - 1.85, rot: 0, w: 1.5, h: 2.3 });
    lamps.push({ x, y: y + 2.85, z: z - 9, ceil: y + 3, p: 0.5, dead: false, flicker: false, r: 0.9, g: 0.95, b: 1, small: true });
    props.push({ kind: 'gifts', x: x - 1.2, y, z: z - 9.5 }, { kind: 'synth', x: x + 2.2, y, z: z - 10.8 });
    mark('home', 2, x + 1.1, y, z - 7.4);
    mark('waiting', 7, x - 1.3, y, z - 3.2);
    labels.push({ key: 'home', x, y, z: z - 9 });
  }
  labels.push({ key: 'deadEnd', x: -120, y: LY, z: -6 });

  /* ---- Loor -> Nonone: steep narrow passages and ladder shafts (chapter 2) ---- */
  const NAR = { w: 0.9, h: 2.5, rt: 0.8, rb: 0.2, amp: 0.12, zone: Z.passage };
  let p = [100, LY, 0];
  const legs1 = [[0.15, 12, 0.9], [0, 10, 0.4], [-0.2, 12, 1.1], [0.1, 10, 0.6]];
  for (let i = 0; i < legs1.length; i++) {
    const [ang, n, rise] = legs1[i];
    const pts = wander(p, ang, n, 9, rise, 0.4);
    path(pts, { ...NAR, lamp: 18, lampP: 0.45, dead: 0.35 });
    if (i === 1) { const m = pts[Math.floor(pts.length / 2)]; labels.push({ key: 'passage', x: m[0], y: m[1], z: m[2] }); }   // on the way itself
    if (i === 0 || i === 2) {          // a food-room by the road: the machines that make food and fuel out of the rock
      const m = pts[Math.floor(pts.length / 2)];
      tube(m, [m[0], m[1], m[2] + 4], { w: 0.75, h: 2.4, rt: 0.5, rb: 0.15, amp: 0.04, zone: Z.passage, ext: 0.2 });
      room(m[0], m[1], m[2] + 8, 3.5, 3, 3.2, { rr: 1, zone: Z.passage });
      addLamp(m[0], m[1] + 3.2, m[2] + 8, { dead: 0, lampP: 0.6 });
      props.push({ kind: 'synth', x: m[0] - 1.6, y: m[1], z: m[2] + 9.5 }, { kind: 'synth', x: m[0] + 1.6, y: m[1], z: m[2] + 9.5 });
      if (i === 0) mark('foodRooms', 2, m[0] + 1.6, m[1], m[2] + 6.2);
      if (i === 0) labels.push({ key: 'foodRoom', x: m[0], y: m[1], z: m[2] + 8 });
    }
    p = pts[pts.length - 1];
    if (i % 2 === 1) {                                  // a ladder shaft up to the next level
      const top = p[1] + 14 + R() * 6;
      shaft(p[0] + 2.2, p[2], p[1], top + 2.5, 1.5, Z.shaft);
      // the ladders are in the back rooms of apartments, below and above (the way is kept secret)
      room(p[0] + 2.2, p[1], p[2], 2.8, 2.8, 2.9, { rr: 0.9, zone: Z.shaft }); room(p[0] + 2.2, top, p[2], 2.8, 2.8, 2.9, { rr: 0.9, zone: Z.shaft });
      tube([p[0], p[1], p[2]], [p[0] + 2.2, p[1], p[2]], { ...NAR, ext: 0.4 });
      if (i === 1) mark('ladders', 2, p[0] + 0.6, p[1], p[2] + 1.7);
      p = [p[0] + 2.2, top, p[2]];
      tube([p[0], p[1], p[2]], [p[0] + 4, p[1], p[2]], { ...NAR, ext: 0.4 });
      p = [p[0] + 4, p[1], p[2]];
    }
    // natural side caves off the passage (long detours, some dead ends in caverns)
    sideCaves(pts[Math.floor(pts.length / 2)], 2);
  }

  /* ---- Nonone: the friendly city halfway up ---- */
  const NY = p[1];
  path([p, [p[0] + 30, NY, p[2]]], { ...COR, w: 1.9, h: 4.2, zone: Z.nonone, lamp: 9 });
  const nx0 = p[0] + 30, nz0 = p[2];
  city(nx0, NY, nz0, 150, Z.nonone);
  labels.push({ key: 'nonone', x: nx0 + 70, y: NY, z: nz0 });
  room(nx0 + 75, NY, nz0 - 26, 9, 7, 5, { rr: 2, zone: Z.nonone });           // the home of Nennapuss (breakfast with his family)
  // the Great Square of Nonone, where its two main corridors meet: the banquet for Tumithak
  path([[nx0 + 45, NY, nz0 - 50], [nx0 + 45, NY, nz0 + 50]], { ...COR, zone: Z.nonone, lamp: 9 });
  room(nx0 + 45, NY, nz0, 9, 9, 5.5, { rr: 3, zone: Z.nonone });
  labels.push({ key: 'noneSquare', x: nx0 + 45, y: NY, z: nz0 });
  path([[nx0 + 75, NY, nz0], [nx0 + 75, NY, nz0 - 18]], { ...COR, w: 1.9, h: 4.2, zone: Z.nonone, lamp: 9 });
  labels.push({ key: 'hall', x: nx0 + 75, y: NY, z: nz0 - 26 });
  props.push({ kind: 'feast', x: nx0 + 45, y: NY, z: nz0 + 4 });
  mark('nonone', 2, nx0 + 40, NY, nz0 + 6);
  mark('nennapuss', 2, nx0 + 71, NY, nz0 - 21);
  starts.nonone = { x: nx0 + 60, y: NY, z: nz0, yaw: -Math.PI / 2 };

  /* ---- Nonone -> Yakra: more passages, the guarded shaft ---- */
  p = [nx0 + 150, NY, nz0];
  const legs2 = [[-0.1, 14, 0.8], [0.25, 12, 0.9], [-0.15, 14, 0.7], [0.1, 8, 0.4]];
  for (let i = 0; i < legs2.length; i++) {
    const [ang, n, rise] = legs2[i];
    const pts = wander(p, ang, n, 9, rise, 0.45);
    path(pts, { ...NAR, lamp: 20, lampP: 0.4, dead: 0.45 });
    p = pts[pts.length - 1];
    if (i % 2 === 1 || i === legs2.length - 1) {
      const top = p[1] + (i === legs2.length - 1 ? 22 : 14 + R() * 6);
      shaft(p[0] + 2.2, p[2], p[1], top + 2.5, 1.5, Z.shaft);
      room(p[0] + 2.2, p[1], p[2], 2.8, 2.8, 2.9, { rr: 0.9, zone: Z.shaft }); room(p[0] + 2.2, top, p[2], 3.2, 3.2, 3, { rr: 0.9, zone: i === legs2.length - 1 ? Z.yakra : Z.shaft });
      tube([p[0], p[1], p[2]], [p[0] + 2.2, p[1], p[2]], { ...NAR, ext: 0.4 });
      p = [p[0] + 2.2, top, p[2]];
      if (i === legs2.length - 1) props.push({ kind: 'table', x: p[0] - 1.2, y: p[1], z: p[2] - 2.0 });    // the guard's table he bumped into
      if (i !== legs2.length - 1) { tube([p[0], p[1], p[2]], [p[0] + 4, p[1], p[2]], { ...NAR, ext: 0.4 }); p = [p[0] + 4, p[1], p[2]]; }
    }
    sideCaves(pts[Math.floor(pts.length / 2)], 2);
  }
  labels.push({ key: 'guardedShaft', x: p[0], y: p[1], z: p[2] });
  mark('yakran', 3, p[0] + 3.2, p[1], p[2] + 0.9);
  props.push({ kind: 'bones', x: p[0] + 2.4, y: p[1], z: p[2] - 0.8 });

  /* ---- Yakra: the hostile city ---- */
  const YY = p[1];
  const yx0 = p[0];
  path([[yx0 - 6, YY, p[2]], [yx0 + 4, YY, p[2]]], { ...COR, w: 1.9, h: 4.2, zone: Z.yakra, lamp: 9 });
  city(yx0, YY, p[2], 170, Z.yakra, { dead: 0.12 });
  labels.push({ key: 'yakra', x: yx0 + 80, y: YY, z: p[2] });
  // the square where the two main corridors of Yakra cross: the panic, the crowd, the woman with the child (chapter 3)
  const ysx = yx0 + 90, ysz = p[2];
  path([[ysx, YY, ysz - 45], [ysx, YY, ysz + 45]], { ...COR, zone: Z.yakra, lamp: 9, dead: 0.12 });
  room(ysx, YY, ysz, 10, 10, 6, { rr: 3, zone: Z.yakra });
  labels.push({ key: 'yakraSquare', x: ysx, y: YY, z: ysz });
  mark('stampede', 3, ysx - 13, YY, ysz + 1.3);
  // "the third doorway across the hall": an apartment whose back room hides a shaft up to an old corridor that
  // crosses over the square to the upper end of the city, dark but for one dim light; a ladder down at its end
  {
    const ax = ysx + 4, az = ysz - 14;
    tube([ax, YY, ysz - 10], [ax, YY, az + 1.5], { w: 0.75, h: 2.4, rt: 0.5, rb: 0.15, amp: 0.04, zone: Z.yakra, ext: 0.3 });
    room(ax, YY, az - 1, 3.2, 2.6, 2.9, { rr: 0.9, zone: Z.yakra });
    curtains.push({ x: ax, y: YY, z: ysz - 10.3, rot: 0, w: 1.5, h: 2.4 });
    const top = YY + 9.2;
    shaft(ax - 1.6, az - 1, YY, top + 2.5, 1.4, Z.yakra);
    const op = path([[ax - 1.6, top, az - 1], [ax + 6, top, az - 1], [ax + 22, top, az + 4], [ax + 44, top + 0.4, az + 2], [ax + 58, top + 0.4, az - 2]], { w: 1.0, h: 2.6, rt: 0.9, rb: 0.2, amp: 0.12, zone: Z.yakra, ext: 0.8 });
    const mid = op[Math.floor(op.length * 0.55)];
    addLamp(mid[0], mid[1] + 2.6, mid[2], { lampP: 0.25, dead: 0 });                      // the single dim light
    mark('hideout', 3, mid[0] + 1.0, mid[1], mid[2] + 0.6);
    labels.push({ key: 'hideout', x: mid[0], y: mid[1], z: mid[2] });
    const e = op[op.length - 1];
    room(e[0] + 2.2, YY, e[2], 2.8, 2.8, 2.9, { rr: 0.9, zone: Z.yakra });
    shaft(e[0] + 2.2, e[2], YY, e[1] + 2.5, 1.4, Z.yakra);
    tube([e[0] + 2.2, YY, e[2]], [e[0] + 2.2, YY, ysz], { ...COR, w: 1.2, h: 3, zone: Z.yakra, ext: 0.6 });   // back to the main corridor
  }
  starts.yakra = { x: yx0 + 20, y: YY, z: p[2], yaw: -Math.PI / 2 };

  /* ---- chapter 4: beyond Yakra — the lamps go on for miles, then turn bluish and fail: the Dark Corridors ---- */
  p = [yx0 + 170, YY, p[2]];
  let lampP = 0.75;
  const legLamp = [[0.75, null], [0.6, null], [0.35, [0.55, 0.7, 1.0]], [0.12, [0.45, 0.6, 1.0]], [0, null], [0, null]];
  let savages = null;
  for (let i = 0; i < 6; i++) {
    const pts = wander(p, (R() - 0.5) * 0.6, 12, 9, 0.5, 0.5);
    [lampP] = legLamp[i];
    path(pts, { ...COR, w: 1.9 - i * 0.1, h: 4 - i * 0.15, amp: 0.06 + i * 0.05, zone: i < 2 ? Z.yakra : Z.dark, lamp: lampP > 0.05 ? 12 : 0, lampP, dead: 0.15 + i * 0.15, col: legLamp[i][1] || undefined });
    if (i === 2) { const m = pts[Math.floor(pts.length / 2)]; labels.push({ key: 'dark', x: m[0], y: m[1], z: m[2] }); }
    if (i === 0) { const m = pts[6]; mark('watched', 4, m[0], m[1], m[2] + 1.0); }
    if (i === 2) { const m = pts[3]; mark('lampsFail', 4, m[0], m[1], m[2] + 1.0); }
    if (i === 3) { const m = pts[6]; mark('dwellers', 4, m[0], m[1], m[2] + 0.9); }
    if (i === 4) { const m = pts[5]; mark('dogs', 4, m[0], m[1], m[2] + 0.9); props.push({ kind: 'sword', x: m[0] - 0.5, y: m[1], z: m[2] - 0.6 }); }
    p = pts[pts.length - 1];
    sideCaves(pts[Math.floor(pts.length / 2)], 3);
    if (i === 3) {
      // the central halls of the savages of the dark corridors (where they carried him), and the prison: a room ten
      // feet square with a single door, the dogs lying outside it
      const cx = p[0] + 18, cy = p[1], cz = p[2] + 6;
      cavern(cx, cy + 4, cz, 22, 8, 16, cy - 0.5, Z.cave);
      savages = { x: cx, y: cy, z: cz };
      labels.push({ key: 'savages', x: cx, y: cy, z: cz });
      props.push({ kind: 'dogBones', x: cx + 4, y: cy - 0.4, z: cz + 4 }, { kind: 'dogBones', x: cx - 6, y: cy - 0.4, z: cz - 3 });
      mark('savages', 4, cx - 2, cy - 0.4, cz + 1);
      const px = cx + 20, pz = cz + 4;
      tube([cx + 14, cy - 0.4, pz], [px - 1.4, cy - 0.4, pz], { w: 0.75, h: 2.3, rt: 0.6, rb: 0.2, amp: 0.15, zone: Z.dark, ext: 0.3 });
      room(px + 0.2, cy - 0.4, pz, 1.6, 1.6, 2.6, { rr: 0.6, zone: Z.dark, amp: 0.15 });
      labels.push({ key: 'cells', x: px, y: cy - 0.4, z: pz });
      mark('cells', 4, px - 3.5, cy - 0.4, pz + 1.0);
      props.push({ kind: 'bonds', x: px + 0.4, y: cy - 0.4, z: pz + 0.4 }, { kind: 'blast', x: px - 4, y: cy - 0.4, z: pz });
      p = [p[0] + 36, p[1], p[2] + 4];
    }
  }
  mark('sword', 4, p[0] - 2, p[1], p[2] + 0.9);

  /* ---- still chapter 4: the rough, winding natural caverns of man's first flight into the earth, and a
     well-hidden pit-mouth with a ladder, light shining at its top ---- */
  const pts = wander(p, -0.2, 16, 9, 0.6, 0.8);
  path(pts, { w: 1.15, h: 2.8, rt: 1.0, rb: 0.4, amp: 0.55, zone: Z.cave, ext: 1.0 });
  { const m = pts[6]; mark('caverns', 4, m[0], m[1], m[2] + 0.8); }
  p = pts[pts.length - 1];
  {
    const top = p[1] + 13;
    room(p[0] + 2.2, p[1], p[2], 2.2, 2.2, 2.6, { rr: 0.9, zone: Z.cave, amp: 0.3 });
    shaft(p[0] + 2.2, p[2], p[1], top + 2.5, 1.4, Z.cave);
    addLamp(p[0] + 2.2, top + 2.5, p[2], { lampP: 0.5, dead: 0 });                     // the light at the top
    mark('pitMouth', 4, p[0] - 0.8, p[1], p[2] + 1.0);
    labels.push({ key: 'pitMouth', x: p[0] + 2.2, y: p[1], z: p[2] });
    p = [p[0] + 2.2, top, p[2]];
    tube(p, [p[0] + 4, p[1], p[2]], { ...COR, w: 1.6, h: 3.6, zone: Z.esthett, ext: 0.4 });
    p = [p[0] + 4, p[1], p[2]];
  }

  /* ---- chapter 5: the Hall of the Esthetts — corridors of milky white stone covered with carvings and pictures,
     lit from plates hidden in the walls in many colours; apartments with doors of metal; the great square ---- */
  const EY = p[1];
  const COLS = [[0.55, 0.7, 1.0], [0.6, 1.0, 0.7], [1.0, 0.55, 0.5], [1.0, 0.85, 0.45], [1.0, 0.95, 0.85]];
  const wallLamp = (x, y, z, k) => lamps.push({ x, y, z, ceil: y + 0.3, p: 0.7, dead: false, flicker: false, r: COLS[k % 5][0], g: COLS[k % 5][1], b: COLS[k % 5][2], hidden: true });
  // the first corridor: carved from end to end, and the pictures on its walls
  const art = path([p, [p[0] + 20, EY, p[2] + 2], [p[0] + 45, EY, p[2]], [p[0] + 70, EY + 0.5, p[2] - 3]], { ...COR, w: 2.4, h: 4.6, amp: 0.02, zone: Z.esthett });
  art.forEach((q, i) => { if (i % 3 === 0) { wallLamp(q[0], q[1] + 3.6, q[2] - 2.1, i); wallLamp(q[0], q[1] + 3.6, q[2] + 2.1, i + 2); } });
  mark('esthettHall', 5, p[0] + 6, EY, p[2] + 1.4);
  // (the facade finds the wall: from the axis point it goes sideways (side -1 = north) until the rock)
  murals.push({ x: art[6][0], y: art[6][1] + 1.0, z: art[6][2], side: -1, pic: 'dance' }, { x: art[10][0], y: art[10][1] + 1.0, z: art[10][2], side: 1, pic: 'car' }, { x: art[15][0], y: art[15][1] + 1.0, z: art[15][2], side: -1, pic: 'shelks' });
  mark('pictures', 5, p[0] + 33, EY, p[2] - 0.8);
  props.push({ kind: 'tapestry', x: p[0] + 56, y: EY, z: p[2] - 2.3 }, { kind: 'statue', x: p[0] + 62, y: EY + 0.3, z: p[2] - 1.6 }, { kind: 'statue', x: p[0] + 64, y: EY + 0.3, z: p[2] - 0.2 }, { kind: 'statue', x: p[0] + 63, y: EY + 0.3, z: p[2] + 1.4 });
  // then it widens to forty feet, and apartments open on both sides behind doors of metal
  const w0 = art[art.length - 1], WY = w0[1];
  const wide = [w0, [w0[0] + 30, WY, w0[2]], [w0[0] + 60, WY, w0[2] + 2], [w0[0] + 90, WY, w0[2]]];
  path(wide, { ...COR, w: 6, h: 7.5, rt: 4.5, amp: 0.02, zone: Z.esthett });
  for (let x = w0[0] + 6; x < w0[0] + 86; x += 7) {
    props.push({ kind: 'metalDoor', x, y: WY, z: w0[2] - 5.95, rot: 0 }, { kind: 'metalDoor', x: x + 3.5, y: WY, z: w0[2] + 5.95, rot: Math.PI });
    wallLamp(x, WY + 5.5, w0[2] - 5.7, x | 0); wallLamp(x + 3.5, WY + 5.5, w0[2] + 5.7, (x | 0) + 1);
  }
  // the apartment of Lathrumidor: dull blue walls, a huge bed, a padded chair, a shelf of books, a rug
  {
    const ax = w0[0] + 34, az = w0[2] - 6;
    tube([ax, WY, az + 0.6], [ax, WY, az - 2.2], { w: 0.9, h: 2.6, rt: 0.5, rb: 0.15, amp: 0.02, zone: Z.esthettRoom, ext: 0.2 });
    room(ax, WY, az - 6, 4, 3.6, 3.2, { rr: 0.8, zone: Z.esthettRoom, amp: 0.02 });
    lamps.push({ x: ax - 3.5, y: WY + 2.9, z: az - 6, ceil: WY + 3.2, p: 0.35, dead: false, flicker: false, r: 1, g: 0.95, b: 0.85, hidden: true });
    props.push({ kind: 'esthettBed', x: ax + 1.6, y: WY, z: az - 6.4 }, { kind: 'paddedChair', x: ax - 2.2, y: WY, z: az - 4.6 }, { kind: 'bookshelf', x: ax - 2.6, y: WY, z: az - 8.9 }, { kind: 'rug', x: ax, y: WY, z: az - 5.6 });
    mark('lathrumidor', 5, ax - 1, WY, az - 3.6);
    labels.push({ key: 'lathrumidor', x: ax, y: WY, z: az - 6 });
  }
  // the great square: a hall over a hundred yards across, a floor of tessellated marble, statues on pedestals of many
  // colours, tapestries in the doorways — and in the middle the car of the shelks
  const sq = { x: w0[0] + 90 + 40, y: WY, z: w0[2] };
  cavern(sq.x, sq.y, sq.z, 42, 14, 42, sq.y, Z.square, 0.03);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; wallLamp(sq.x + Math.cos(a) * 39, sq.y + 2.2, sq.z + Math.sin(a) * 39, k); }
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2; wallLamp(sq.x + Math.cos(a) * 20, sq.y + 11.5, sq.z + Math.sin(a) * 20, k + 3); }   // high in the dome
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3; props.push({ kind: 'statue', x: sq.x + Math.cos(a) * 26, y: sq.y, z: sq.z + Math.sin(a) * 26, ped: k }); }
  props.push({ kind: 'car', x: sq.x, y: sq.y, z: sq.z });
  for (const a of [0.9, 2.3, 3.9, 5.3]) props.push({ kind: 'tapestry', x: sq.x + Math.cos(a) * 40.5, y: sq.y, z: sq.z + Math.sin(a) * 40.5, rot: -a - Math.PI / 2 });
  labels.push({ key: 'esthettSquare', x: sq.x, y: sq.y, z: sq.z });
  mark('square', 5, sq.x - 34, sq.y, sq.z + 2);
  mark('shelks', 5, sq.x - 6, sq.y, sq.z + 6);
  mark('car', 5, sq.x + 7, sq.y, sq.z - 3);
  starts.esthetts = { x: w0[0] + 4, y: WY, z: w0[2], yaw: -Math.PI / 2 };
  /* ---- chapter 6: the slaying of the shelk — the one broad main corridor to the Surface, the way the car went:
     halls brighter than any, halls of polished metal, unpolished rock, the marble passage of the singing Esthetts;
     then corridors abandoned for years (the feast room), the last pit, the hall of black stone, the narrowing stairs,
     and the Surface at sunset ---- */
  const RW = { ...COR, w: 3.2, h: 6, rt: 2.6, rb: 0.3, amp: 0.02 };
  let rx = sq.x + 40, ry = sq.y, rz = sq.z;
  const leg = (len, rise, o, bend = 0) => {
    const a = [rx, ry, rz], b = [rx + len, ry + rise, rz];
    path([a, [rx + len / 2, ry + rise / 2, rz + bend], b], { ...RW, ...o });
    rx = b[0]; ry = b[1];
  };
  mark('ride', 6, rx + 8, ry, rz + 2.4);
  labels.push({ key: 'road', x: rx + 30, y: ry, z: rz });
  leg(80, 0, { zone: Z.road, lamp: 6, dead: 0, lampP: 1.0, col: [1.0, 0.97, 0.9] });                     // brighter than any
  leg(60, 1, { zone: Z.metal, lamp: 7, dead: 0, lampP: 0.85, col: [0.85, 0.95, 1.0], rt: 1.2, amp: 0.004 });   // polished metal
  leg(80, 3, { zone: Z.roughRoad, w: 3, h: 5.5, rt: 2.4, amp: 0.4 }, 7);                                     // unpolished rock, dark
  {
    const x0 = rx;
    leg(60, 0.5, { zone: Z.hymn, amp: 0.01 });                                                               // the marble passage
    for (let x = x0 + 4; x < x0 + 58; x += 6) { wallLamp(x, ry + 3.4, rz - 3.0, 4); wallLamp(x + 3, ry + 3.4, rz + 3.0, 4); }
    mark('hymn', 6, x0 + 30, ry, rz + 2.4);
    labels.push({ key: 'hymn', x: x0 + 30, y: ry, z: rz });
  }
  // the abandoned corridors: dust, dead lamps, empty apartments (the door is a doorway; behind it one room, sometimes two)
  const flat = (x, side, back, y = ry) => {
    const rz0 = rz + side * (3.2 + 1.2 + 2.6);
    tube([x, y, rz + side * 2.6], [x, y, rz + side * 4.6], { w: 0.75, h: 2.4, rt: 0.5, rb: 0.15, amp: 0.03, zone: Z.abandoned, ext: 0.2 });
    room(x, y, rz0, 2.8, 2.6, 2.8, { rr: 0.8, zone: Z.abandoned, amp: 0.05 });
    if (!back) return [x, y, rz0];
    tube([x + 2, y, rz0], [x + 5, y, rz0], { w: 0.7, h: 2.3, rt: 0.5, rb: 0.15, amp: 0.03, zone: Z.abandoned, ext: 0.2 });
    room(x + 7, y, rz0, 2.2, 2.2, 2.6, { rr: 0.8, zone: Z.abandoned, amp: 0.05 });
    return [x + 7, y, rz0];
  };
  {
    const x0 = rx, AB = { zone: Z.abandoned, lamp: 9, dead: 0.75, lampP: 0.4 };
    leg(120, 0, AB);
    // where he dropped off the car: the nearest open door, a dusty apartment bare of furniture
    { const r = flat(x0 + 12, 1); mark('dropOff', 6, r[0] - 1, r[1], r[2] - 1.2); labels.push({ key: 'dropOff', x: r[0], y: r[1], z: r[2] }); }
    for (const [dx, sd] of [[30, -1], [44, 1], [62, 1], [70, -1], [112, -1]]) flat(x0 + dx, sd);
    // not a hundred yards on, the car stands before the only door with a curtain: the feast room — eighty feet long,
    // half as wide, its ceiling lost in gloom; lights all round at the height of a shoulder
    const fx = x0 + 92, fz = rz - 3.2 - 2.4 - 6;
    props.push({ kind: 'car', x: fx + 7, y: ry, z: rz + 0.9 });
    tube([fx, ry, rz - 2.6], [fx, ry, rz - 6.2], { w: 1.3, h: 3.4, rt: 0.9, rb: 0.15, amp: 0.02, zone: Z.feast, ext: 0.3 });
    props.push({ kind: 'tapestry', x: fx - 1.3, y: ry, z: rz - 3.35 }, { kind: 'tapestry', x: fx + 1.3, y: ry, z: rz - 3.35 });
    room(fx, ry, fz, 12, 6, 18, { rr: 1.5, zone: Z.feast, amp: 0.03 });
    for (let k = 0; k < 6; k++) {
      const x = fx - 10 + k * 4;
      lamps.push({ x, y: ry + 1.5, z: fz - 5.6, ceil: ry + 1.8, p: 0.4, dead: false, flicker: false, r: 1, g: 0.8, b: 0.6, hidden: true });
      lamps.push({ x: x + 2, y: ry + 1.5, z: fz + 5.6, ceil: ry + 1.8, p: 0.4, dead: false, flicker: false, r: 1, g: 0.8, b: 0.6, hidden: true });
    }
    props.push({ kind: 'feastTable', x: fx - 1, y: ry, z: fz }, { kind: 'bloodJars', x: fx + 8.6, y: ry, z: fz + 0.4 });
    mark('feast', 6, fx + 2.2, ry, fz + 4.4);
    labels.push({ key: 'feastRoom', x: fx, y: ry, z: fz });
    // up the corridor he ran, farther and farther — and slept in the rear room of an apartment
    leg(140, 2, AB);
    const yAt = (x) => ry - 2 * (rx - x) / 140;
    const r = flat(rx - 50, 1, true, yAt(rx - 50));
    mark('sleep', 6, r[0] - 0.8, r[1], r[2] - 1.0);
    for (const [dx, sd] of [[-120, 1], [-96, -1], [-80, 1], [-30, -1], [-12, 1]]) flat(rx + dx, sd, false, yAt(rx + dx));
  }
  // the passage ends; a ladder of metal set into the wall rises higher and higher in the gloom: the last pit
  const top = ry + 14, sx = rx + 1;
  shaft(sx, rz, ry, top + 2.5, 1.4, Z.pit);
  mark('lastPit', 6, rx - 3, ry, rz + 2.2);
  labels.push({ key: 'pit', x: rx - 2, y: ry, z: rz });
  // a hall of strange black stone; then a corridor narrower than any, the walls closing in to two feet wide
  tube([sx, top, rz], [sx + 4, top, rz], { w: 1.1, h: 3, rt: 0.8, rb: 0.15, amp: 0.02, zone: Z.black, ext: 0.3 });
  room(sx + 9, top, rz, 5, 4, 5, { rr: 1.2, zone: Z.black, amp: 0.02 });
  addLamp(sx + 9, top + 5, rz, { lampP: 0.6, dead: 0 });
  mark('blackHall', 6, sx + 7, top, rz + 2.6);
  labels.push({ key: 'blackHall', x: sx + 9, y: top, z: rz });
  let q = [sx + 13.5, top, rz];
  const ws = [1.1, 0.95, 0.8, 0.68, 0.56, 0.48];
  for (let k = 0; k < 6; k++) {
    const nq = [q[0] + 7, q[1] + 0.35 + k * 0.18, q[2]];
    tube(q, nq, { w: ws[k], h: 3.2 - k * 0.12, rt: 0.42, rb: 0.12, amp: 0.02, zone: Z.black, ext: 0.3 });
    q = nq;
  }
  mark('narrow', 6, q[0] - 10, q[1] - 0.6, q[2]);
  // the grade becomes a flight of stairs; the ceiling comes lower and lower; far ahead, a red light from above
  labels.push({ key: 'toSurface', x: q[0], y: q[1], z: q[2] });
  const RISE = 0.24, RUN = 0.36;
  for (const [len, hh] of [[6, 2.4], [5, 2.15], [4.32, 1.95]]) {
    const nq = [q[0] + len, q[1] + len / RUN * RISE, q[2]];
    tube(q, nq, { w: 0.46, h: hh, rt: 0.4, rb: 0.12, amp: 0.015, zone: Z.black, ext: 0.2, run: RUN });
    q = nq;
  }
  // the light of the Surface, falling in from above (and, fainter, down the last flight)
  lamps.push({ x: q[0] + 1.2, y: q[1] + 2.2, z: q[2], ceil: q[1] + 2.5, p: 2.0, dead: false, flicker: false, r: 1.0, g: 0.5, b: 0.32, hidden: true });
  lamps.push({ x: q[0] - 2.5, y: q[1] + 0.6, z: q[2], ceil: q[1] + 0.9, p: 0.5, dead: false, flicker: false, r: 1.0, g: 0.5, b: 0.32, hidden: true });

  /* ---- the Surface: a shallow pit not five feet deep; dust round it, then grass; trees in the middle distance under
     the low red sun; behind, the towers of the shelks — thin, windowless, leaning, joined by cables ---- */
  const PIT = 1.5;
  const topY = q[1] + PIT;                           // the ground level of the Surface around the pit
  const exit = { x: q[0] + 2, y: topY, z: q[2] };
  const surf = { k: 'surface', zone: Z.surface, amp: 0.25, floorAt: (x, z) => ground(x, z) };
  starts.surface = { x: exit.x + 4.5, y: topY, z: exit.z + 2, yaw: -Math.PI / 2 };
  labels.push({ key: 'surface', x: exit.x + 4, y: topY, z: exit.z });
  mark('surface', 6, exit.x + 5.5, topY, exit.z - 2.5);
  // the shelk that stole up behind him: seven shots, and it tumbled into the pit; he cut off its head with his sword
  props.push({ kind: 'shelk', x: exit.x - 0.6, y: topY - PIT, z: exit.z + 0.9 });
  mark('shelk', 6, exit.x - 4.6, topY - 0.3, exit.z + 2.6);
  labels.push({ key: 'shelk', x: exit.x - 1, y: topY - PIT, z: exit.z });
  mark('return', 6, exit.x + 0.4, topY - PIT, exit.z - 1.6);
  // trees: tall irregular pillars topped with green, in the middle distance (towards the sun)
  const trees = [];
  for (let k = 0; k < 110; k++) {
    const a = (R() - 0.5) * 2.4, r = 35 + Math.sqrt(R()) * 200;
    trees.push({ x: exit.x + Math.cos(a) * r, z: exit.z + Math.sin(a) * r, h: 7 + R() * 7, r: 2 + R() * 2.5 });
  }
  // the homes of the shelks, the other way: a dozen and more obelisks of metal, fifty to two hundred feet high, not
  // fifteen feet round, built at angles up to thirty degrees, a small round door at the bottom
  const towers = [];
  for (let k = 0; k < 15; k++) {
    const a = Math.PI + (R() - 0.5) * 1.6, r = 32 + R() * 110;
    towers.push({ x: exit.x + Math.cos(a) * r, z: exit.z + Math.sin(a) * r, h: 15 + R() * 46, rot: R() * Math.PI * 2, lean: R() < 0.2 ? R() * 0.04 : 0.08 + R() * 0.44 });
  }
  const shawm = { x: exit.x - 80, z: exit.z };
  labels.push({ key: 'shawm', x: shawm.x, y: topY, z: shawm.z });
  // the ground: packed dust, gently uneven, flat around the pit — and the pit itself, a shallow bowl
  const GX = exit.x, GZ = exit.z;
  function ground(x, z) {
    const d = Math.hypot(x - GX, z - GZ), flat = Math.min(1, d / 30);
    const t = Math.min(1, Math.max(0, (d - 2.4) / 2.6)), pit = PIT * (1 - t * t * (3 - 2 * t));
    return topY - pit + (fbm3(x * 0.012, 0.5, z * 0.012, 3) * 3.2 + noise3(x * 0.08, 1.5, z * 0.08) * 0.25) * flat;
  }
  const SURF_R = 330;                                  // how far from the pit the Surface is meshed (the rest is a far plane)
  const surfaceChunk = (i, j, k) => j * CH <= topY + 6 && (j + 1) * CH >= topY - 6 && Math.hypot((i + 0.5) * CH - GX, (k + 0.5) * CH - GZ) < SURF_R;

  // side caves: natural branching tunnels (rough, unlit), some ending in caverns
  function sideCaves(from, depth) {
    if (!from || depth <= 0) return;
    const n = 1 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const ang = (R() < 0.5 ? -1 : 1) * (Math.PI / 2 + (R() - 0.5) * 0.8), steps = 6 + Math.floor(R() * 16);
      const start = [from[0], from[1], from[2]];
      // side caves only climb (slowly) away from where they start: where they cross another tunnel they open its
      // ceiling, never its floor (no pits on the way you must walk)
      const pts = wander(start, ang, steps, 8, 0.15 + R() * 0.45, 0.7);
      const w = 1.1 + R() * 1.4;
      path(pts, { w, h: 2.4 + R() * 2.5, rt: w * 0.9, rb: 0.5, amp: 0.55 + R() * 0.4, zone: Z.cave, ext: w });
      const end = pts[pts.length - 1];
      if (R() < 0.45) cavern(end[0], end[1] + 3, end[2], 7 + R() * 10, 4 + R() * 4, 6 + R() * 9, end[1] - 0.4, Z.cave);
      if (depth > 1) sideCaves(pts[Math.floor(pts.length * (0.4 + R() * 0.4))], depth - 1);
    }
  }

  /* ---- spatial hash of the primitives (4 m cells; the chunks that hold any primitive) ---- */
  const HC = 4;
  const cells = new Map(), chunks = new Set();
  const ckey = (i, j, k) => (i + 2048) * 16777216 + (j + 2048) * 4096 + (k + 2048);
  for (const s of prims) {
    const b = s.box;
    for (let k = Math.floor(b[2] / HC); k <= Math.floor(b[5] / HC); k++)
      for (let j = Math.floor(b[1] / HC); j <= Math.floor(b[4] / HC); j++)
        for (let i = Math.floor(b[0] / HC); i <= Math.floor(b[3] / HC); i++) {
          const key = ckey(i, j, k);
          let l = cells.get(key); if (!l) { l = []; cells.set(key, l); } l.push(s);
          chunks.add(ckey(Math.floor(i * HC / CH), Math.floor(j * HC / CH), Math.floor(k * HC / CH)));
        }
  }
  const near = (x, y, z) => cells.get(ckey(Math.floor(x / HC), Math.floor(y / HC), Math.floor(z / HC)));
  const hasChunk = (i, j, k) => chunks.has(ckey(i, j, k)) || surfaceChunk(i, j, k);

  // the dominant primitive at a point (zone, floor) and the field value
  let lastPrim = null;
  // the caves, and above them the Surface: rock is where the caves are not, and below the ground
  function field(x, y, z) {
    const fc = caveField(x, y, z);
    if (y < topY - 8 || Math.hypot(x - GX, z - GZ) > SURF_R + 40) return fc;
    const fg = ground(x, z) - y + noise3(x * 0.6, y * 0.6, z * 0.6) * 0.05;
    if (fg < fc) { lastPrim = surf; return fg; }
    return fc;
  }
  function caveField(x, y, z) {
    const list = near(x, y, z);
    if (!list) { lastPrim = null; return 4; }
    let d = 1e9, best = null, bd = 1e9;
    for (const s of list) {
      const di = DIST[s.k](s, x, y, z);
      if (di < bd) { bd = di; best = s; }
      d = smin(d, di, 0.9);
    }
    lastPrim = best;
    if (!best || d > 3) return Math.max(d, 0.5);
    if (d < -2.5) return d;                         // deep in the air: the noise cannot reach a wall
    // rock texture of the walls: strong in caves, faint on the glassy carved corridors; calmer near the floor
    const fl = best.floorAt(x, z), up = y - fl;
    const damp = up < 1.4 ? 0.22 + 0.78 * Math.max(0, up) / 1.4 : 1;
    const n = fbm3(x * 0.21, y * 0.21, z * 0.21, 3) * 0.75 + noise3(x * 0.85, y * 0.85, z * 0.85) * 0.25;
    return d + n * best.amp * 2 * damp;
  }
  function zoneAt(x, y, z) { field(x, y, z); return lastPrim ? lastPrim.zone : 0; }

  const lastZone = () => (lastPrim ? lastPrim.zone : 0);       // zone of the primitive that won the last field() call
  return { prims, lamps, ladders, curtains, labels, props, markers, murals, starts, trees, towers, ground, surfaceY: topY, exit, field, zoneAt, lastZone, hasChunk, near, topY, zones: ZONES };
}
