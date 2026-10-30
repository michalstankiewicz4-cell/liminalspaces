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
  { key: 'upper', amb: 0.002, tint: [0.4, 0.35, 0.3], rough: 0.6, fog: [0.01, 0.01, 0.01], map: '#807060', far: 40 },
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
  const v = y - (s.ay + s.sy * tc);                   // above the floor line
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
  const prims = [], lamps = [], ladders = [], curtains = [], labels = [], props = [];
  // story markers: a stone stele with the chapter's number where something of the story happens (read it up close)
  const markers = [];
  const mark = (key, ch, x, y, z) => markers.push({ key, ch, x, y, z });
  const starts = {};

  function tube(a, b, o) {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1e-3;
    const s = { k: 'tube', ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], dx: dx / L, dz: dz / L, L, sy: (b[1] - a[1]) / L,
      w: o.w, h: o.h, rt: Math.min(o.rt ?? o.w * 0.75, o.w - 0.01, o.h / 2 - 0.01), rb: o.rb ?? 0.35, ext: o.ext ?? o.w * 0.6, amp: o.amp ?? 0.05, zone: o.zone };
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
    lamps.push({ x, y: ceil - 0.08, z, ceil, p: dead ? 0 : p, dead, flicker, r: 0.86, g: 0.92, b: 1.0 });
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
    p = pts[pts.length - 1];
    if (i % 2 === 1) {                                  // a ladder shaft up to the next level
      const top = p[1] + 14 + R() * 6;
      shaft(p[0] + 2.2, p[2], p[1], top + 2.5, 1.5, Z.shaft);
      tube([p[0], p[1], p[2]], [p[0] + 2.2, p[1], p[2]], { ...NAR, ext: 0.4 });
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
  room(nx0 + 75, NY, nz0 - 26, 9, 7, 5, { rr: 2, zone: Z.nonone });           // Nennapuss' hall
  path([[nx0 + 75, NY, nz0], [nx0 + 75, NY, nz0 - 18]], { ...COR, w: 1.9, h: 4.2, zone: Z.nonone, lamp: 9 });
  labels.push({ key: 'hall', x: nx0 + 75, y: NY, z: nz0 - 26 });
  props.push({ kind: 'feast', x: nx0 + 75, y: NY, z: nz0 - 27 });
  mark('nonone', 2, nx0 + 71, NY, nz0 - 21);
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
      tube([p[0], p[1], p[2]], [p[0] + 2.2, p[1], p[2]], { ...NAR, ext: 0.4 });
      p = [p[0] + 2.2, top, p[2]];
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
  mark('stampede', 3, yx0 + 52, YY, p[2] + 1.3);
  // the forgotten corridor where the Yakran woman hid him, and the shaft she led him up (chapter 3)
  {
    const hx = yx0 + 140, hz = p[2];
    const hp = path([[hx, YY, hz], [hx + 3, YY + 0.4, hz - 14], [hx - 2, YY + 0.8, hz - 28], [hx + 4, YY + 1.2, hz - 40]], { ...COR, w: 1.3, h: 3.2, amp: 0.1, zone: Z.yakra });
    const e = hp[hp.length - 1];
    room(e[0], e[1], e[2] - 4, 3, 3, 2.8, { rr: 1, zone: Z.yakra, amp: 0.1 });
    mark('hideout', 3, e[0] + 1.2, e[1], e[2] - 3);
    labels.push({ key: 'hideout', x: e[0], y: e[1], z: e[2] - 4 });
  }
  starts.yakra = { x: yx0 + 20, y: YY, z: p[2], yaw: -Math.PI / 2 };

  /* ---- beyond Yakra: the lamps dim and fail; the Dark Corridors and the caves (chapter 4) ---- */
  p = [yx0 + 170, YY, p[2]];
  let lampP = 0.45, lastLeg = null;
  for (let i = 0; i < 6; i++) {
    const pts = lastLeg = wander(p, (R() - 0.5) * 0.6, 12, 9, 0.5, 0.5);
    path(pts, { ...COR, w: 1.9 - i * 0.1, h: 4 - i * 0.15, amp: 0.06 + i * 0.05, zone: i < 2 ? Z.yakra : Z.dark, lamp: lampP > 0.05 ? 12 : 0, lampP, dead: 0.3 + i * 0.15 });
    if (i === 2) { const m = pts[Math.floor(pts.length / 2)]; labels.push({ key: 'dark', x: m[0], y: m[1], z: m[2] }); }
    if (i === 1) { const m = pts[3]; mark('lampsFail', 4, m[0], m[1], m[2] + 1.0); }
    if (i === 3) { const m = pts[5]; mark('follower', 4, m[0], m[1], m[2] + 0.9); }
    lampP *= 0.45;
    p = pts[pts.length - 1];
    sideCaves(pts[Math.floor(pts.length / 2)], 3);
    if (i === 3) { cavern(p[0] + 18, p[1] + 4, p[2] + 6, 22, 8, 16, p[1] - 0.5, Z.cave); labels.push({ key: 'bigCave', x: p[0] + 18, y: p[1], z: p[2] + 6 }); mark('dwellers', 4, p[0] + 12, p[1], p[2] + 3); props.push({ kind: 'dogBones', x: p[0] + 22, y: p[1] - 0.4, z: p[2] + 10 }); p = [p[0] + 36, p[1], p[2] + 4]; }
  }
  // the cells of the dwellers of the dark (their prison room, chapter 4)
  const cp = lastLeg[lastLeg.length - 4];
  tube([cp[0], cp[1], cp[2]], [cp[0], cp[1], cp[2] + 11], { w: 0.8, h: 2.3, rt: 0.6, rb: 0.2, amp: 0.15, zone: Z.dark });
  room(cp[0], cp[1], cp[2] + 14, 4, 3, 2.6, { rr: 1, zone: Z.dark, amp: 0.25 });
  labels.push({ key: 'cells', x: cp[0], y: cp[1], z: cp[2] + 14 });
  mark('dogs', 4, cp[0] + 0.9, cp[1], cp[2] + 4);
  mark('cells', 4, cp[0] - 2, cp[1], cp[2] + 15.5);
  props.push({ kind: 'bonds', x: cp[0] + 1, y: cp[1], z: cp[2] + 14.5 });

  /* ---- chapter 5: out of the cell, away from the dwellers and their dogs, on up through the black corridors ---- */
  mark('escape', 5, cp[0] + 0.7, cp[1], cp[2] + 7);
  const pts = wander(p, -0.2, 16, 9, 1.0, 0.5);
  path(pts, { ...COR, w: 1.6, h: 3.6, amp: 0.2, zone: Z.upper });
  // the den of the dogs: a low cave off the way, littered with bones
  {
    const d = pts[4];
    path([d, [d[0] + 2, d[1] + 0.3, d[2] + 9], [d[0] - 1, d[1] + 0.6, d[2] + 17]], { w: 1.2, h: 2.4, rt: 1.0, rb: 0.4, amp: 0.45, zone: Z.dark, ext: 1.2 });
    cavern(d[0] - 2, d[1] + 2.2, d[2] + 24, 7, 3, 6, d[1] + 0.3, Z.dark, 0.6);
    props.push({ kind: 'dogBones', x: d[0] - 2, y: d[1] + 0.3, z: d[2] + 24 }, { kind: 'dogBones', x: d[0] + 1, y: d[1] + 0.3, z: d[2] + 21 });
    mark('den', 5, d[0] - 4.5, d[1] + 0.3, d[2] + 22);
    labels.push({ key: 'den', x: d[0] - 2, y: d[1] + 0.3, z: d[2] + 24 });
  }
  { const m = pts[10]; mark('climb', 5, m[0], m[1], m[2] + 0.9); }
  p = pts[pts.length - 1];
  shaft(p[0] + 2, p[2], p[1], p[1] + 30, 1.5, Z.upper);
  tube([p[0], p[1], p[2]], [p[0] + 2, p[1], p[2]], { ...NAR, zone: Z.upper, ext: 0.4 });
  props.push({ kind: 'hatch', x: p[0] + 2, y: p[1] + 30, z: p[2] });
  labels.push({ key: 'toSurface', x: p[0] + 2, y: p[1], z: p[2] });
  const topY = p[1] + 30;

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
  const hasChunk = (i, j, k) => chunks.has(ckey(i, j, k));

  // the dominant primitive at a point (zone, floor) and the field value
  let lastPrim = null;
  function field(x, y, z) {
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
  return { prims, lamps, ladders, curtains, labels, props, markers, starts, field, zoneAt, lastZone, hasChunk, near, topY, zones: ZONES };
}
