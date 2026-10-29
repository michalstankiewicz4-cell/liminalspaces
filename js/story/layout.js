// The Great Path world: the district of Luceron and the halls around it, laid out from the story
// "Rudon's Plane – Part 1" (Solar Sands). Every element below is listed with its story timestamp in docs/GREAT_PATH.md.
// Distances that take hours, days or months in the story are shortened; a paper note on the wall says so each time.
// Coordinates in metres: +x = east, +z = south (north is -z). Hub (district centre) around (0, 0).
import { CS, CN, CW, H, F } from './grid.js';
import { M } from './textures.js';
import { rand4, hash4 } from '../core/util.js';
import { JOURNEY_ZONES, paintJourney, JX } from './journey.js';

const R = (a, b = 0, c = 0) => rand4(4242, Math.round(a * 2), Math.round(b * 2), c);

/* ---- zones: name key, story timestamp, light & fog, materials, map colour, label position ---- */
const W = [1.0, 0.92, 0.76];          // warm fluorescent
export const ZONES = [
  { key: 'none', amb: 0.05, tint: [1, 1, 1], fog: [0.05, 0.045, 0.03], map: '#333' },
  { key: 'plaza', t: '07:10', amb: 0.16, tint: W, fog: [0.32, 0.27, 0.16], map: '#c8b46a', fm: 'tile', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 0, lz: 6 },
  { key: 'cafeteria', t: '20:09', amb: 0.16, tint: W, fog: [0.3, 0.26, 0.17], map: '#d2a65a', fm: 'tile', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 3, 0], lx: 23, lz: -13 },
  { key: 'guild', t: '42:20', amb: 0.15, tint: [0.95, 0.97, 1.0], fog: [0.28, 0.28, 0.26], map: '#a8b8c8', fm: 'tile', wm: 'whitepanel', cm: 'ceiling', lamp: ['tube', 3, 0], lx: -24, lz: -13 },
  { key: 'seniorOffice', t: '42:50', amb: 0.06, tint: [1, 0.85, 0.65], fog: [0.18, 0.14, 0.09], map: '#9a8a6a', fm: 'carpetGrey', wm: 'wallpaper', cm: 'ceiling', lamp: ['bulb', 4, 0.25], lx: -36.5, lz: -11 },
  { key: 'library', t: '48:48', amb: 0.1, tint: [1, 0.9, 0.72], fog: [0.2, 0.16, 0.1], map: '#b08a5a', fm: 'parquet', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: -24, lz: -32 },
  { key: 'machine', t: '48:58', amb: 0.04, tint: [0.8, 0.9, 1.0], fog: [0.06, 0.07, 0.09], map: '#6a8aa8', fm: 'parquet', wm: 'wallpaper', cm: 'ceiling', lamp: ['bulb', 4, 0.4], lx: -24, lz: -44 },
  { key: 'court', t: '01:20', amb: 0.14, tint: W, fog: [0.26, 0.21, 0.14], map: '#b07a5a', fm: 'parquet', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 51, lz: 0 },
  { key: 'gardens', t: '07:15', amb: 0.17, tint: [1, 1, 0.9], fog: [0.25, 0.28, 0.2], map: '#7aa860', fm: 'tile', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 6, 0], lx: -24, lz: 13 },
  { key: 'market', t: '07:15', amb: 0.15, tint: W, fog: [0.3, 0.25, 0.16], map: '#c89a6a', fm: 'tile', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 17, lz: 22 },
  { key: 'factory', t: '07:15', amb: 0.12, tint: [0.9, 0.95, 1], fog: [0.18, 0.18, 0.17], map: '#8a8a8a', fm: 'concrete', wm: 'concrete', cm: 'ceiling', lamp: ['tube', 4, 0.05], lx: -20, lz: 40 },
  { key: 'offices', t: '07:15', amb: 0.15, tint: W, fog: [0.28, 0.25, 0.18], map: '#b4a882', fm: 'carpetGrey', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 3, 0], lx: 18, lz: -39 },
  { key: 'avenue', t: '07:10', amb: 0.13, tint: W, fog: [0.3, 0.26, 0.15], map: '#d8c88a', fm: 'carpet', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 6, 0.02], skirt: true },
  { key: 'ring1', t: '07:40', amb: 0.08, tint: [1, 0.88, 0.7], fog: [0.1, 0.085, 0.06], map: '#8a7a5a', fm: 'subfloor', wm: 'drywall', cm: 'ceiling', lamp: ['bulb', 8, 0.5], lx: 0, lz: 80 },
  { key: 'mine', t: '07:51', amb: 0.06, tint: [1, 0.8, 0.6], fog: [0.06, 0.045, 0.03], map: '#6a5040', fm: 'soil', wm: 'rock', cm: 'rock', lamp: ['bulb', 6, 0.2], lx: -86, lz: 6 },
  { key: 'ring2', t: '08:02', amb: 0.06, tint: W, fog: [0.14, 0.12, 0.08], map: '#a8986a', fm: 'carpet', wm: 'wallpaperOld', cm: 'ceiling', lamp: ['panel', 6, 0.3], skirt: true, lx: 0, lz: 130 },
  { key: 'gate', t: '12:28', amb: 0.12, tint: [1, 0.95, 0.85], fog: [0.18, 0.16, 0.12], map: '#909aa8', fm: 'steel', wm: 'concrete', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 0, lz: 158 },
  { key: 'wastes', t: '15:03', amb: 0.06, tint: W, fog: [0.16, 0.14, 0.09], map: '#c8b878', fm: 'carpet', wm: 'wallpaperOld', cm: 'ceiling', lamp: ['panel', 6, 0.15], skirt: true, lx: 0, lz: 270 },
  { key: 'cluster', t: '08:25', amb: 0.05, tint: W, fog: [0.12, 0.1, 0.07], map: '#b8a070', fm: 'carpet', wm: 'wallpaperOld', cm: 'ceiling', lamp: ['panel', 4, 0.3], lx: 64, lz: 255 },
  { key: 'doors', t: '08:37', amb: 0.1, tint: [0.95, 0.97, 1], fog: [0.15, 0.15, 0.15], map: '#9aa0a8', fm: 'steel', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 61, lz: 301 },
  { key: 'deadend', t: '43:28', amb: 0.04, tint: W, fog: [0.08, 0.07, 0.05], map: '#8a7a5a', fm: 'carpet', wm: 'wallpaperOld', cm: 'ceiling', lamp: ['panel', 8, 0.6], skirt: true, lx: -70, lz: 310 },
  { key: 'blue', t: '15:55', amb: 0.08, tint: [0.45, 0.6, 1.0], fog: [0.04, 0.07, 0.2], map: '#5a7ac8', fm: 'carpet', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 6, 0, [0.35, 0.5, 1.2]], lx: 0, lz: 388 },
  { key: 'chapel', t: '16:21', amb: 0.17, tint: [0.4, 0.55, 1.0], fog: [0.03, 0.06, 0.18], map: '#4a6ab8', fm: 'stone', wm: 'plaster', cm: 'plaster', sm: 'stone', lamp: null, lx: 0, lz: 428 },
  { key: 'greatPath', t: '02:34', amb: 0.07, tint: W, fog: [0.22, 0.19, 0.12], map: '#e0c060', fm: 'concrete', wm: 'wallpaperOld', cm: 'ceiling', lamp: null, lx: 90, lz: 0 },
  { key: 'westPath', t: '50:33', amb: 0.06, tint: W, fog: [0.2, 0.17, 0.11], map: '#d0b060', fm: 'carpet', wm: 'wallpaperOld', cm: 'ceiling', lamp: ['panel', 8, 0.35], lx: -90, lz: 0 },
  { key: 'booth', t: '12:32', amb: 0.08, tint: [1, 0.85, 0.6], fog: [0.14, 0.11, 0.07], map: '#a08a6a', fm: 'concrete', wm: 'concrete', cm: 'ceiling', lamp: ['bulb', 4, 0], lx: 4.5, lz: 156 },
  { key: 'school', t: '03:14', amb: 0.14, tint: W, fog: [0.28, 0.24, 0.16], map: '#c8b080', fm: 'parquet', wm: 'wallpaper', cm: 'ceiling', lamp: ['panel', 4, 0], lx: 46, lz: -26 },
  { key: 'holding', t: '25:21', amb: 0.05, tint: [1, 0.9, 0.75], fog: [0.12, 0.1, 0.07], map: '#8a7a6a', fm: 'concrete', wm: 'whitepanel', cm: 'ceiling', lamp: ['bulb', 4, 0], lx: 50, lz: 14 },
  ...JOURNEY_ZONES,                 // the journey down the Great Path (part 2 of the story), see journey.js
];
export const Z = Object.fromEntries(ZONES.map((z, i) => [z.key, i]));
for (const z of ZONES) for (const k of ['fm', 'wm', 'cm', 'sm']) z[k + 'i'] = z[k] ? M[z[k]] : 0;

// Where a walk can start: { x, z, yaw } (yaw 0 = facing north / -z).
export const STARTS = {
  gate: { x: 50, z: 0, yaw: -Math.PI / 2 },
  hub: { x: 0, z: 7, yaw: 0 },
  wastes: { x: 0, z: 150, yaw: Math.PI },
};

export function buildLayout(grid0) {
  const beams = [], gates = [], water = [];
  // Everything below paints through `grid`, a view of the real grid that can be clipped to an x range: the journey
  // and the infinite paths are painted one 32 m column at a time (lazily), each call keeping only its own slice.
  let clip = null;
  const inClip = (x) => !clip || (x >= clip[0] && x < clip[1]);
  const grid = Object.create(grid0);
  grid.paint = (x0, z0, x1, z1, o) => {
    if (clip) { const a = Math.max(Math.min(x0, x1), clip[0]), b = Math.min(Math.max(x0, x1), clip[1]); if (b <= a) return; x0 = a; x1 = b; }
    grid0.paint(x0, z0, x1, z1, o);
  };
  grid.addProp = (p) => (inClip(p.x) ? grid0.addProp(p) : p);
  grid.addSign = (sg) => (inClip(sg.x) ? grid0.addSign(sg) : sg);
  grid.addLight = (l) => (inClip(l.x) ? grid0.addLight(l) : l);

  /* ---- painting helpers ---- */
  const zoneOpts = (zk, extra = {}) => {
    const z = ZONES[Z[zk]];
    return { zone: Z[zk], floor: 0, ceil: H, fm: z.fmi, wm: z.wmi, cm: z.cmi, sm: z.smi || 0, flags: z.skirt ? F.SKIRT : 0, ...extra };
  };
  const room = (zk, x0, z0, x1, z1, extra) => grid.paint(x0, z0, x1, z1, zoneOpts(zk, extra));
  const solid = (x0, z0, x1, z1, extra = {}) => grid.paint(x0, z0, x1, z1, { open: false, ...extra });
  // doorway between two rooms (with a lintel at 2.3 m)
  const door = (zk, x0, z0, x1, z1, ceil = 2.3) => room(zk, x0, z0, x1, z1, { ceil, flags: 0 });
  const fl = (x, z) => { const f = grid.floorAt(x, z); return Number.isFinite(f) ? f : 0; };
  // sound emitters follow some props (see story/audio.js EMIT)
  const emitters = [];
  const EMITS = { funnel: ['drip', 0.9], station: ['station', 1.4], vent: ['vent', 2.9], factory: ['factory', 1.2], machine: ['machine', 1.4] };
  const prop = (kind, x, z, rot = 0, extra = {}) => {
    if (!inClip(x)) return { kind, x, z, y: 0 };
    const p = grid.addProp({ kind, x, z, rot, ...extra, y: extra.y ?? fl(x, z) });
    if (EMITS[kind]) emitters.push({ kind: EMITS[kind][0], x, y: p.y + EMITS[kind][1], z });
    return p;
  };
  const emitter = (kind, x, y, z) => { if (inClip(x)) emitters.push({ kind, x, y, z }); };

  // Finds the wall face from (x, z) in direction (dx, dz) (max 6 m). Returns { x, z, rot } of a point on the face,
  // with rot turning a prop's local +z out of the wall.
  function wallAt(x, z, dx, dz) {
    for (let t = 0; t < 6; t += CS / 2) {
      const px = x + dx * t, pz = z + dz * t;
      if (!grid.isOpen(px, pz)) {
        // snap to the cell boundary
        const bx = dx ? Math.round(px / CS - dx * 0.5) * CS + (dx > 0 ? 0 : 0) : x;
        const bz = dz ? Math.round(pz / CS - dz * 0.5) * CS : z;
        const fx = dx ? (dx > 0 ? Math.floor(px / CS) * CS : (Math.floor(px / CS) + 1) * CS) : bx;
        const fz = dz ? (dz > 0 ? Math.floor(pz / CS) * CS : (Math.floor(pz / CS) + 1) * CS) : bz;
        return { x: fx, z: fz, rot: Math.atan2(-dx, -dz) };
      }
    }
    return { x: x + dx * 6, z: z + dz * 6, rot: Math.atan2(-dx, -dz) };
  }
  const onWall = (kind, x, z, dx, dz, extra = {}) => { const w = wallAt(x, z, dx, dz); return prop(kind, w.x + dx * -0.005, w.z + dz * -0.005, w.rot, { y: fl(x, z), ...extra }); };
  // Paper note on a wall: key/params are i18n strings (re-rendered when the language changes).
  const note = (x, z, dx, dz, key, params = {}, extra = {}) => {
    const w = wallAt(x, z, dx, dz);
    return grid.addSign({ x: w.x - dx * 0.012, z: w.z - dz * 0.012, y: fl(x, z) + (extra.h ?? 1.55), rot: w.rot, key, params, tilt: (R(x, z, 9) - 0.5) * 0.08, kind: extra.kind || 'note' });
  };
  // Skylight in the ceiling: the cells get the SKY flag; a sky light source and a sunbeam are recorded.
  // col: colour of the light coming in (dusk, night).
  function skylight(x0, z0, x1, z1, sun = 1, p = 1.1, col = [1.0, 1.0, 1.05]) {
    if (!inClip((x0 + x1) / 2)) return;
    grid.paint(x0, z0, x1, z1, { addFlags: F.SKY, where: (x, z) => grid.isOpen(x, z) });
    const top = grid.ceilAt((x0 + x1) / 2, (z0 + z1) / 2) + 0.55;
    if (!Number.isFinite(top)) return;
    grid.addLight({ sky: true, x: (x0 + x1) / 2, z: (z0 + z1) / 2, x0, z0, x1, z1, y: top, r: col[0], g: col[1], b: col[2], p, sun });
    beams.push({ x0, z0, x1, z1, top, sun, col });
  }
  // Vibra-cable along a wall, split in 16 m pieces so it streams with the chunks.
  function cable(x, z0, z1, dx, frayed) {
    for (let a = z0; a < z1; a += 16) {
      const b = Math.min(z1, a + 16), w = wallAt(x, (a + b) / 2, dx, 0);
      prop('cable', w.x - dx * 0.005, (a + b) / 2, w.rot, { len: b - a, frayed: frayed && b === z1, y: 0 });
    }
  }

  /* =========================== THE HUB (district centre, story 07:10) =========================== */
  room('plaza', -10, -10, 10, 10);
  skylight(-2, -2, 2, 2, 1.0, 1.4);
  prop('funnel', 0, 0, 0, { big: true, top: H });
  for (const [x, z, r] of [[-6, -6, 0], [6, -6, 0], [-6, 6, Math.PI], [6, 6, Math.PI]]) prop('bench', x, z, r);
  note(0, 9, 0, 1, 'gp.n.hub');
  // avenues
  room('avenue', -1.5, -60, 1.5, -10); room('avenue', -1.5, 10, 1.5, 60);
  room('avenue', 10, -1.5, 44, 1.5); room('avenue', -60, -1.5, -10, 1.5);
  for (const k of [-46, -34, -22]) { skylight(-1, k, 1, k + 2); skylight(-1, -k - 2, 1, -k); skylight(-k - 2, -1, -k, 1); skylight(k, -1, k + 2, 1); }
  // cafeteria (story 20:09)
  room('cafeteria', 14, -22, 32, -4); door('cafeteria', 21, -4, 23, -1.5);
  for (let k = 0; k < 3; k++) for (let r = 0; r < 3; r++) prop('table', 17.5 + k * 5, -16.5 + r * 4.5, 0, { benches: true, tray: (k + r) % 2 === 0 });
  prop('counter', 23, -20.6, 0, { w: 12, glassTop: true });
  // offices
  room('offices', 6, -48, 30, -30); door('offices', 1.5, -40, 6, -38);
  for (let k = 0; k < 4; k++) for (let r = 0; r < 3; r++) prop('desk', 10 + k * 5.5, -44 + r * 5, 0, { lamp: r === 1, chair: true });
  // explorers' guild: a room full of scientific equipment (42:50), with a cramped office at its end
  room('guild', -34, -22, -14, -4); door('guild', -25, -4, -23, -1.5);
  for (let k = 0; k < 3; k++) prop('labbench', -29 + k * 7.5, -16, 0, { w: 4 });
  for (let k = 0; k < 3; k++) prop('labbench', -29 + k * 7.5, -10, Math.PI, { w: 4 });
  for (let k = 0; k < 5; k++) prop('crate', -32.5, -20.5 + k * 0.7, 0, { bricks: k % 2 === 0, s: 0.6 });
  for (let k = 0; k < 4; k++) prop('jug', -16 + k * 0.35, -21.4, 0);
  prop('bike', -16.5, -7.5, Math.PI / 2, { drum: true }); prop('bike', -18.5, -7.5, Math.PI / 2, { drum: true });
  for (let k = 0; k < 3; k++) prop('backpack', -31 + k * 0.5, -5, Math.PI);
  prop('crate', -28.5, -7, 0, { s: 0.4 });                                // Rudon's seat when his friends visit (53:10)
  room('seniorOffice', -38.5, -14, -34.5, -8); door('seniorOffice', -34.5, -11.5, -34, -10.5);
  prop('desk', -36.5, -12.5, Math.PI, { lamp: true, w: 1.6 }); prop('chair', -36.5, -13.45, 0); prop('shelf', -38.2, -11, Math.PI / 2, { w: 2.4, books: true });
  // map library with every paper map (48:48); the machine behind a gate at the back
  room('library', -34, -40, -14, -24); door('library', -25, -24, -23, -22);
  for (let k = 0; k < 4; k++) { prop('shelf', -30 + k * 4.5, -37, 0, { w: 3.6, rolls: true }); prop('shelf', -30 + k * 4.5, -36.4, Math.PI, { w: 3.6, rolls: true }); }
  prop('maptable', -24, -29, 0);
  room('machine', -28, -47, -20, -40.5); door('machine', -25.5, -40.5, -22.5, -40, 2.6);
  prop('bars', -21.4, -40.25, Math.PI / 2, { w: 1.8, h: 2.3 });
  prop('machine', -24, -46.2, 0);
  note(-21, -43, 1, 0, 'gp.n.machine');
  // the court and the layered gate to the Great Path (01:20, 35:33)
  room('court', 44, -9, 58, 9); room('court', 58, -1.5, 60, 1.5, { flags: 0 });
  prop('judgeDesk', 51, 7, Math.PI);
  prop('chair', 51, 3.9, 0);                                             // the accused (statue scene, 35:33)
  for (let r = 0; r < 3; r++) { prop('bench', 48, -2.5 - r * 1.6, 0, { w: 3 }); prop('bench', 48, 2.5 + r * 1.6 - 2.5 + 2.5, Math.PI, { w: 3 }); }
  gates.push({ x: 58, z: 0, w: 3, layers: 6 });
  note(56.5, -3, 0, -1, 'gp.n.gate');
  // gardens (skylights over planters), market with a tailor, factory
  room('gardens', -34, 4, -14, 22); door('gardens', -25, 1.5, -23, 4);
  for (let k = 0; k < 3; k++) for (let r = 0; r < 2; r++) { prop('planter', -29 + k * 7, 9 + r * 7, 0, { w: 4.5, d: 1.4 }); skylight(-30 + k * 7, 8 + r * 7, -28 + k * 7, 10 + r * 7, 0.9, 0.9); }
  room('market', 4, 14, 30, 30); door('market', 1.5, 20, 4, 22);
  for (let k = 0; k < 4; k++) { prop('stall', 8 + k * 5.5, 17, 0, { w: 3.2 }); prop(k === 1 ? 'tailor' : 'stall', 8 + k * 5.5, 27, Math.PI, { w: 3.2 }); }
  room('factory', -32, 30, -8, 50); door('factory', -8, 38, -1.5, 40, 2.8);
  for (let k = 0; k < 3; k++) { prop('factory', -27 + k * 7, 34, 0); prop('factory', -27 + k * 7, 46, Math.PI); }
  prop('conveyor', -20, 40, 0, { w: 18 });
  prop('lumber', -11, 47, Math.PI / 2, { len: 3 });

  // the school (03:14): a classroom with a chalkboard, and a lobby by the corridor to the avenue
  room('school', 36, -38, 56, -14); room('school', 40, -14, 42, -1.5);
  prop('board', 46, -38, 0, { w: 5 });
  prop('desk', 46, -34.6, Math.PI, { w: 1.6, lamp: false });
  for (const [x, z] of [[-4, -4], [0, -4], [4, -4], [-4, -1], [0, -1], [4, -1]]) { prop('desk', 46 + x, -24 + z, 0, { w: 1.0 }); prop('chair', 46 + x, -24 + z + 0.7, Math.PI); }
  for (let k = 0; k < 4; k++) prop('backpack', 37 + k * 0.6, -15, 0);
  // the holding room (25:21): a table, two chairs, a bare bulb
  room('holding', 46, 11, 54, 17); door('holding', 49, 9, 50.5, 11);
  prop('table', 50, 14.2, 0, { w: 1.4, d: 0.8 }); prop('chair', 50, 13.2, 0); prop('chair', 50, 15.3, Math.PI);

  /* =========================== FIRST OUTER RING (07:40): walls knocked down by scavengers =========================== */
  const inRing1 = (x, z) => Math.max(Math.abs(x), Math.abs(z)) >= 60 && Math.max(Math.abs(x), Math.abs(z)) < 100;
  room('ring1', -100, -100, 100, 100, { where: inRing1, flags: 0 });
  // ceiling panels missing in patches: the metal Agarite layer shows, 15 cm higher
  for (let gz = -100; gz < 100; gz += 2) for (let gx = -100; gx < 100; gx += 2) {
    if (!inRing1(gx + 1, gz + 1) || R(gx, gz, 1) > 0.14) continue;
    grid.paint(gx, gz, gx + 2, gz + 2, { ceil: H + 0.15, cm: M.agarite, where: inRing1 });
  }
  // pillars on an 8 m grid, wall stubs, stud frames, lumber and rubble along the old wall lines
  for (let gz = -96; gz <= 96; gz += 8) for (let gx = -96; gx <= 96; gx += 8) {
    if (!inRing1(gx, gz)) continue;
    if (Math.abs(gx) < 2 || Math.abs(gz) < 2) continue;          // keep the avenue axes clear
    solid(gx - 0.5, gz - 0.5, gx + 0.5, gz + 0.5);
    const r = R(gx, gz, 2), horiz = R(gx, gz, 3) < 0.5;
    const len = 2 + Math.floor(R(gx, gz, 4) * 4);
    const ax = horiz ? gx + 1 : gx, az = horiz ? gz : gz + 1;
    if (r < 0.3) solid(horiz ? ax : ax - 0.25, horiz ? az - 0.25 : az, horiz ? ax + len : ax + 0.25, horiz ? az + 0.25 : az + len);
    else if (r < 0.6) prop('studs', horiz ? ax + len / 2 : ax, horiz ? az : az + len / 2, horiz ? 0 : Math.PI / 2, { len, panel: R(gx, gz, 5) < 0.5 });
    else if (r < 0.75) prop('lumber', gx + 3, gz + 3, R(gx, gz, 6) < 0.5 ? 0 : Math.PI / 2, { len: 2.5 + R(gx, gz, 7) * 2 });
    else if (r < 0.9) prop('rubble', gx + 4, gz + 2, 0, { n: 12, r: 1.3 });
  }
  note(0, 61.5, -1, 0, 'gp.n.ring1', {}, {});

  /* ---- mine (07:51, 18:50): dug in one direction, away from the Hub; descends into soil and stone ---- */
  function mineCells(x0, z0, x1, z1, fFloor, ceilH = 3.0) {
    // seal around, then open with floor heights from fFloor(x, z)
    solid(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
    for (let z = z0; z < z1; z += CS) for (let x = x0; x < x1; x += CS) {
      const f = Math.round(fFloor(x + CS / 2, z + CS / 2) * 100) / 100;
      grid.paint(x, z, x + CS, z + CS, { ...zoneOpts('mine'), floor: f, ceil: f + (typeof ceilH === 'function' ? ceilH(x, z) : ceilH), flags: 0 });
    }
  }
  // order matters: later segments re-open the seal of earlier ones where they meet
  mineCells(-98, -8, -72, 20, (x, z) => -8 + Math.round((R(Math.floor(x / 2), Math.floor(z / 2), 11) - 0.5) * 6) / 10, (x, z) => 3.6 + R(Math.floor(x / 3), Math.floor(z / 3), 12) * 1.6);
  mineCells(-83.5, 20, -80.5, 73.5, (x, z) => -3 - (73.5 - z) / 53.5 * 5);
  mineCells(-83.5, 70.5, -64, 73.5, (x, z) => Math.min(0, -(-64 - x) / 19.5 * 3));
  room('ring1', -64, 70.5, -62, 73.5, { flags: 0 });                   // reconnect the entrance to the ring
  for (let z = 24; z < 70; z += 3.5) prop('support', -82, z, 0, { w: 3 });
  for (let x = -79; x > -64; x -= 3.5) prop('support', x, 72, Math.PI / 2, { w: 3 });
  prop('rails', -82, 46, 0, { len: 46 }); prop('cart', -82, 30, 0);
  for (let k = 0; k < 6; k++) prop('rubble', -95 + k * 2.6, -5.5 + (k % 2), 0, { mat: 'rock', n: 14, r: 1.6 });
  solid(-98, -8, -72, -6.5);                                            // the collapse
  for (const [x, z] of [[-90, 2], [-80, 12], [-76, -2]]) prop('support', x, z, 0, { w: 4, h: 3.4 });
  note(-66, 72, 0, -1, 'gp.n.mine');
  for (const [x, z] of [[-82, 30], [-82, 55], [-90, 4], [-78, -2], [-86, 14], [-74, 8]]) emitters.push({ kind: 'drip', x, y: grid.floorAt(x, z) + 2.5, z });

  /* =========================== SECOND OUTER RING (08:02): barren hallways, a few rooms =========================== */
  const inRing2 = (x, z) => Math.max(Math.abs(x), Math.abs(z)) >= 100 && Math.max(Math.abs(x), Math.abs(z)) < 160;
  for (let k = -6; k <= 6; k++) {
    room('ring2', k * 24 - 1.5, -160, k * 24 + 1.5, 160, { where: inRing2 });
    room('ring2', -160, k * 24 - 1.5, 160, k * 24 + 1.5, { where: inRing2 });
  }
  for (const [x, z, w, d] of [[106, 30, 8, 6], [-120, 106, 10, 7], [40, -150, 7, 6], [-150, -60, 6, 9], [130, 132, 9, 6], [-60, 140, 7, 7]]) {
    room('ring2', x, z, x + w, z + d, { flags: 0 });
    room('ring2', x + w / 2 - 0.5, z - 3, x + w / 2 + 0.5, z, { ceil: 2.3, flags: 0 });
    room('ring2', x + w / 2 - 0.5, z + d, x + w / 2 + 0.5, z + d + 3, { ceil: 2.3, flags: 0 });
    prop('chair', x + 1.5, z + 1.5, R(x, z, 1) * 4 | 0);
  }
  note(0, 101, -1, 0, 'gp.n.ring2');

  /* =========================== THE GREAT PATH (02:34) and the WEST PATH (50:33) =========================== */
  // painted per 32 m column; static part now, the rest lazily as the player walks (infinite)
  const H_ = { grid, room, solid, door, prop, onWall, note, skylight, cable, wallAt, fl, zoneOpts, emitter, R, Z, ZONES, F, M, H, CS, beams, water };
  function pathColumn(ci) {
    const east = ci >= 0, x0 = ci * CW, x1 = x0 + CW;
    if (east) {
      clip = [Math.max(x0, 60), x1];
      if (clip[1] > clip[0]) paintJourney(H_, clip[0], clip[1]);
      clip = null;
      return;
    }
    plainColumn(ci, x0, x1, false);
  }
  // the plain endless hallway of the West Path
  function plainColumn(ci, x0, x1, east) {
    const xa = x0, xb = Math.min(x1, -60);
    if (xb <= xa) return;
    const zk = 'westPath';
    solid(xa, -3, xb, 3);
    for (let x = xa; x < xb; x += 16) {
      const seg = Math.floor(x / 16);
      const old = R(seg, 0, 21) < (east ? 0.35 : 0.6);
      room(zk, x, -1.5, Math.min(xb, x + 16), 1.5, { wm: old ? M.wallpaperOld : M.wallpaper, flags: R(seg, 0, 22) < 0.55 ? F.SKIRT : 0 });
    }
    // skylights every 8 m (centred on 8k + 4); lamps sit between them (lamp grid 8, offset 0)
    for (let x = Math.ceil(xa / 8) * 8; x + 8 <= xb + 1e-6; x += 8) skylight(x + 3, -1, x + 5, 1, 0.9, 0.8);
    // rain water collectors every 160 m under a skylight
    for (let x = Math.ceil((xa - 84) / 160) * 160 + 84; x < xb; x += 160) prop('funnel', x, 0, 0, { top: H });
    // explorers' chalk marks on the left wall
    for (let x = Math.ceil(xa / 48) * 48 + 20; x < xb; x += 48) {
      if (east) prop('chalk', x, -1.5, 0, { n: 1 + (Math.abs(x / 48) | 0) % 5, y: 0 }); else prop('chalk', x, 1.5, Math.PI, { n: 1 + (Math.abs(x / 48) | 0) % 5, y: 0 });
    }
    // rare anomalies, one per column at most (only past the rings, where the space around is free)
    const far = east ? xa >= 160 : xb <= -160;
    const r = R(ci, 0, 50), ax = xa + 6 + Math.floor(R(ci, 0, 51) * 18) * 0.5;
    const side = R(ci, 0, 52) < 0.5 ? -1 : 1;                        // -1 north wall, +1 south wall
    if (r < 0.1) solid(ax, side < 0 ? -1.5 : 0.5, ax + 1.5, side < 0 ? -0.5 : 1.5);          // drywall box jutting out
    else if (r < 0.2) {                                                                       // vent to nowhere
      room(zk, ax, side < 0 ? -2.5 : 1.5, ax + 1, side < 0 ? -1.5 : 2.5, { floor: 2.75, ceil: 3.15, flags: 0 });
      prop('vent', ax + 0.5, side * 1.5, side < 0 ? 0 : Math.PI, { y: 0 });
    } else if (r < 0.28) prop('doorClosed', ax, side * 1.5, side < 0 ? 0 : Math.PI, { y: 0 });  // a door into solid wall
    else if (r < 0.36) grid.paint(ax, -1.5, ax + 6, 1.5, { ceil: H + 0.15, cm: M.agarite, where: (x, z) => grid.isOpen(x, z) && !(grid.flagsAt(x, z) & F.SKY) });
    else if (r < 0.42) prop('chair', ax, side * 0.9, side < 0 ? Math.PI : 0);                  // a chair facing the wall
    else if (r < 0.48) prop('frame', ax, 0, 0, { w: 0.9 });                                    // a door frame with no wall
    else if (r < 0.54 && far) {                                                                // a small empty side room
      solid(ax - 1, side < 0 ? -7.5 : 1.5, ax + 6, side < 0 ? -1.5 : 7.5);
      room(zk, ax, side < 0 ? -6.5 : 2.5, ax + 4.5, side < 0 ? -2.5 : 6.5, { flags: 0 });
      door(zk, ax + 1.5, side < 0 ? -2.5 : 1.5, ax + 2.5, side < 0 ? -1.5 : 2.5);
    } else if (r < 0.62) prop('papers', ax, side * 0.6, 0, { seed: ci });
    // distance notes: every 200 m stands for about a day of walking in the story (West Path only)
    const start = east ? 60 : -60;
    if (!east) for (let d = 200; ; d += 200) {
      const x = east ? start + d : start - d;
      if (east ? x >= xb : x < xa) break;
      if (east ? x < xa : x >= xb) continue;
      note(x, 0, 0, east ? -1 : 1, east ? 'gp.n.day' : 'gp.n.dayWest', { n: d / 200 });
    }
  }
  for (let ci = 1; ci <= 4; ci++) pathColumn(ci);
  for (let ci = -2; ci >= -5; ci--) pathColumn(ci);
  note(-66, 0, 0, 1, 'gp.n.westPath');
  grid.lazy = (ci) => { if (ci >= 5 || ci <= -6) { pathColumn(ci); for (let cj = -6; cj <= 5; cj++) { const c = grid.chunk(ci, cj, false); if (c) placeLamps(c); } } };

  /* =========================== THE WASTELANDS DOOR (12:28): steel door, a guard, the Vibra-cable =========================== */
  room('gate', -1.5, 156, 1.5, 164);
  prop('steelDoor', 0, 160, 0, { w: 3 });
  room('booth', 2, 152, 7, 159);
  room('booth', 1.5, 154, 2, 157, { floor: 1.0, ceil: 2.2 });           // window into the hallway
  door('booth', 1.5, 157.5, 2, 158.5, 2.2);
  prop('booth', 5, 154.5, Math.PI);
  note(-1, 158, -1, 0, 'gp.n.wastesDoor');

  /* =========================== THE WASTELANDS: yellow halls (15:03) =========================== */
  room('wastes', -1.5, 164, 1.5, 370);
  cable(-1.5, 161, 380, -1, true);
  for (let z = 170; z < 380; z += 50) onWall('station', -1, z, -1, 0);
  for (let z = 190; z < 370; z += 40) onWall('chalk', 1, z, 1, 0, { n: 1 + ((z / 40) | 0) % 4 });
  note(-1, 166, -1, 0, 'gp.n.wastes');
  note(1, 205, 1, 0, 'gp.n.cable');

  /* ---- branch east: clusters of dense rooms and unusual structures (08:25), the room of doors (08:37) ---- */
  room('cluster', 1.5, 248.5, 40, 251.5, { flags: F.SKIRT });
  const RX = 7, RZ = 10, X0 = 40, Z0 = 220, SP = 6.5, SZ = 6;
  for (let j = 0; j < RZ; j++) for (let i = 0; i < RX; i++) {
    const x = X0 + i * SP, z = Z0 + j * SP;
    room('cluster', x, z, x + SZ, z + SZ, { flags: R(i, j, 31) < 0.45 ? F.SKIRT : 0 });   // skirting boards appear in some rooms only
  }
  // doors between rooms: a random spanning tree + a few extra openings
  {
    const seen = new Set(['0,4']), stack = [[0, 4]];
    let n = 0;
    const link = (a, b, c, d) => {
      const x = X0 + Math.min(a, c) * SP, z = Z0 + Math.min(b, d) * SP;
      if (a !== c) { const zc = z + 2.5 + Math.floor(R(a, b, 33) * 2) * 0.5; door('cluster', x + SZ, zc, x + SP, zc + 1); }
      else { const xc = x + 2.5 + Math.floor(R(a, b, 34) * 2) * 0.5; door('cluster', xc, z + SZ, xc + 1, z + SP); }
    };
    while (stack.length && n++ < 1000) {
      const [i, j] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < RX && b < RZ && !seen.has(a + ',' + b));
      if (!opts.length) { stack.pop(); continue; }
      const [a, b] = opts[Math.floor(R(i, j, 35 + n) * opts.length)];
      link(i, j, a, b); seen.add(a + ',' + b); stack.push([a, b]);
    }
    for (let k = 0; k < 14; k++) { const i = Math.floor(R(k, 0, 36) * (RX - 1)), j = Math.floor(R(k, 0, 37) * RZ); link(i, j, i + 1, j); }
  }
  // anomalies in the cluster
  const roomXY = (i, j) => [X0 + i * SP, Z0 + j * SP];
  { // solid boxes of drywall jutting out from walls (09:11)
    for (const [i, j, side] of [[1, 2, 0], [3, 5, 1], [5, 1, 2], [2, 8, 3], [6, 6, 0]]) {
      const [x, z] = roomXY(i, j);
      if (side === 0) solid(x, z + 2, x + 1, z + 3.5); else if (side === 1) solid(x + SZ - 1.5, z, x + SZ, z + 1);
      else if (side === 2) solid(x + 2, z + SZ - 1, x + 3, z + SZ); else solid(x + SZ - 1, z + 3, x + SZ, z + 4.5);
    }
  }
  { // vents near the ceiling that lead only a few feet behind the wall (09:34)
    for (const j of [1, 4, 7]) {
      const [x, z] = roomXY(RX - 1, j);
      room('cluster', x + SZ, z + 2.5, x + SZ + 1, z + 3.5, { floor: 2.75, ceil: 3.15, flags: 0 });
      prop('vent', x + SZ, z + 3, -Math.PI / 2, { y: 0 });
    }
    const [x, z] = roomXY(2, 0);
    room('cluster', x + 2.5, z - 1, x + 3.5, z, { floor: 2.75, ceil: 3.15, flags: 0 }); prop('vent', x + 3, z, 0, { y: 0 });
  }
  { // a rogue hole in a wall (06:26)
    const [x, z] = roomXY(3, 3);
    room('cluster', x + SZ, z + 2, x + SP, z + 3.5, { floor: 0.5, ceil: 1.5, flags: 0 });
    prop('rubble', x + SZ - 0.6, z + 2.7, 0, { n: 7, r: 0.5 });
  }
  { // a piece cut out of the carpet (06:26)
    const [x, z] = roomXY(4, 6);
    grid.paint(x + 2, z + 2, x + 3.5, z + 3, { fm: M.subfloor, floor: -0.02 });
  }
  { // leftovers: a chair facing the wall, a lonely desk
    let [x, z] = roomXY(1, 6); prop('chair', x + 3, z + 0.8, Math.PI);
    [x, z] = roomXY(5, 3); prop('desk', x + 3, z + 3, Math.PI / 2, {});
  }
  // clutter: loose papers and boxes left in some rooms
  for (let j = 0; j < RZ; j++) for (let i = 0; i < RX; i++) {
    const [x, z] = roomXY(i, j), r = R(i, j, 60);
    if (r < 0.35) prop('papers', x + 1 + R(i, j, 61) * 4, z + 1 + R(i, j, 62) * 4, 0, { seed: i * 7 + j });
    else if (r < 0.5) prop('crate', x + 0.5 + R(i, j, 63) * 0.2, z + SZ - 0.6, 0, { s: 0.5 });
  }
  for (let z = 175; z < 365; z += 23) if (R(z, 0, 64) < 0.5) prop('papers', (R(z, 0, 65) - 0.5) * 1.6, z, 0, { seed: z, n: 3 });
  note(3, 250, 0, -1, 'gp.n.cluster');
  // the room of doors (08:37): steel floor, doors every ~4 ft on each wall, one opens into door after door
  room('cluster', 59.5, 284, 62.5, 295, { flags: F.SKIRT });
  room('doors', 55, 295, 67, 307);
  for (let k = 0; k < 7; k++) {
    const t = 56.25 + k * 1.6;
    if (Math.abs(t - 61) > 1.3) prop('doorClosed', t, 295, 0, { y: 0 });
    if (Math.abs(t - 61) > 1.3) prop('doorClosed', t, 307, Math.PI, { y: 0 });
    prop('doorClosed', 55, t + 39, Math.PI / 2, { y: 0 });
    prop('doorClosed', 67, t + 39, -Math.PI / 2, { y: 0 });
  }
  room('doors', 60.5, 307, 61.5, 311, { ceil: 2.2, flags: 0 });
  for (let k = 0; k < 6; k++) prop('doorFrame', 61, 307.3 + k * 0.62, 0, { w: 1.0, y: 0 });
  room('doors', 60.5, 311, 61.5, 312, { ceil: 2.4, flags: 0 });            // the tiny room at the end
  grid.addLight({ x: 61, z: 311.5, y: 2.3, r: 1, g: 0.85, b: 0.6, p: 0.5, fixture: 'bulb', ceil: 2.4 });
  note(56, 300, -1, 0, 'gp.n.doors');

  /* ---- branch west: a corridor that ends in a blank wall; behind the first layer only Agarite (43:28) ---- */
  room('wastes', -20, 308.5, -1.5, 311.5);
  room('deadend', -120, 308.5, -20, 311.5);
  room('deadend', -120, 308.5, -119.5, 311.5, { wm: M.agarite });
  prop('planks', -120, 310, Math.PI / 2, { w: 3, y: 0 });
  prop('rubble', -119, 310, 0, { n: 9, r: 0.9 });
  note(-3, 309, 0, -1, 'gp.n.deadEndStart');
  note(-118.5, 309, 0, -1, 'gp.n.deadEnd');

  /* ---- deep blue at the end of the hall (15:55), the chapel (16:21) ---- */
  room('blue', -1.5, 370, 1.5, 400);
  note(1, 382, 1, 0, 'gp.n.cableEnd');
  const CF = -6;                                                  // the floor falls about 20 ft
  // an enormous, roughly square room: 56 x 56 m
  const CX0 = -28, CX1 = 28, CZ0 = 400, CZ1 = 456;
  room('chapel', CX0, CZ0, CX1, CZ1, { floor: CF, flags: 0 });
  room('chapel', -1.5, 400, 1.5, 402, { floor: 0, flags: 0 });   // landing at the threshold
  // a stair of podiums down to the floor (1 m steps, 0.4 m drops)
  for (let k = 0; k < 15; k++) room('chapel', -2.5 - k, 400, -1.5 - k, 402.5, { floor: -0.4 * (k + 1), flags: 0 });
  const reserved = (x, z) => (z < 404 && x > -18 && x < 2.5) || (x > -5 && x < 5 && z > CZ1 - 10);
  // podiums of every height rising from the floor and hanging from the ceiling
  for (let bz = 404.5; bz < CZ1 - 2; bz += 2.5) for (let bx = CX0 + 0.5; bx < CX1 - 2; bx += 2.5) {
    const cx = bx + 1, cz = bz + 1;
    if (reserved(cx, cz)) continue;
    const r = R(bx, bz, 41);
    if (r < 0.4) room('chapel', bx, bz, bx + 2, bz + 2, { floor: CF + 0.5 + Math.floor(R(bx, bz, 42) * 13) * 0.5, flags: 0 });
    else if (r < 0.68) room('chapel', bx, bz, bx + 2, bz + 2, { floor: CF, ceil: H - 1 - Math.floor(R(bx, bz, 43) * 9) * 0.5, flags: 0 });
  }
  skylight(-2, CZ1 - 4.5, 2, CZ1 - 0.5, 1.9, 4.0);
  prop('symbol', 0, CZ1, Math.PI, { y: CF + 1.0, w: 7, h: 4.5 });
  note(2.2, 401, 1, 0, 'gp.n.chapel', {}, { h: 1.6 });

  /* ---- brass plaques on stone pedestals next to the statue scenes (statues.js), text from the guide step ---- */
  const PLAQUES = {
    gate: [54.5, -5.2, Math.PI, '02:18'], classroom: [39, -30, Math.PI / 2, '03:14'], sketch: [9, -5.5, -Math.PI / 2, '06:21'],
    friends: [-1.1, 122, Math.PI, '06:45'], rebecca: [50.5, -17.5, -Math.PI / 2, '10:51'], door: [-1.1, 151.5, Math.PI, '12:32'],
    station: [1.1, 225, Math.PI, '15:38'], blue: [1.1, 392.5, Math.PI, '15:55'], chapel: [-4.5, 451, Math.PI / 2, '16:44'],
    cafeteria: [31.2, -9.2, -Math.PI / 2, '21:16'], holding: [53.2, 12.2, -Math.PI / 2, '25:21'], court: [55.2, 6.5, -Math.PI / 2, '35:33'],
    office: [-34.9, -13.4, -Math.PI / 2, '42:56'], deadEnd: [-112.5, 311, -Math.PI / 2, '45:47'], collector: [3.6, 3.6, -Math.PI / 2, '47:42'],
    machine: [-20.6, -45.2, -Math.PI / 2, '49:15'], visit: [-25.5, -5.2, -Math.PI / 2, '53:10'], path: [96, 1.15, -Math.PI / 2, '02:34'],
  };
  for (const [key, [x, z, face, time]] of Object.entries(PLAQUES)) {
    prop('pedestal', x, z, face);
    grid.addSign({ x: x + Math.sin(face) * 0.165, z: z + Math.cos(face) * 0.165, y: fl(x, z) + 0.8, rot: face, key: 'gp.s.' + key, params: {}, step: key, time, tilt: 0, kind: 'plaque' });
  }

  /* ---- lamps everywhere (by zone rules) ---- */
  for (const c of grid.chunks.values()) placeLamps(c);

  return { beams, gates, emitters, water };

  // Places ceiling lamps on the zone's grid in one chunk (deterministic: some are dead, some flicker).
  function placeLamps(c) {
    if (c.lamped) return;
    c.lamped = true;
    for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
      const k = i + j * CN;
      if (!c.open[k]) continue;
      const zd = ZONES[c.zone[k]];
      if (!zd || !zd.lamp) continue;
      const [fixture, sp, deadP, col] = zd.lamp;
      const gx = c.ci * CN + i, gz = c.cj * CN + j;
      const x = gx * CS, z = gz * CS;                              // lamp centre = cell corner
      if (Math.abs(x / sp - Math.round(x / sp)) > 1e-6 || Math.abs(z / sp - Math.round(z / sp)) > 1e-6) continue;
      // the 1 m square around the corner must be open, level and under a normal ceiling
      let ok = true;
      const ce = c.ceil[k];
      for (const [a, b] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const [cc, kk] = grid.at(gx + a, gz + b);
        if (!cc || !cc.open[kk] || Math.abs(cc.ceil[kk] - ce) > 0.01 || (cc.flags[kk] & F.SKY) || ce < 2.5 || cc.zone[kk] !== c.zone[k]) { ok = false; break; }
      }
      if (!ok) continue;
      const r = rand4(99, gx, gz, 1), dead = r < deadP, flicker = !dead && rand4(99, gx, gz, 2) < 0.06;
      const cl = col || [1.0, 0.93, 0.78];
      const along = zd.key === 'greatPath' || zd.key === 'westPath' || zd.key === 'avenue';
      c.lights.push({ x, z, y: ce - 0.15, ceil: ce, r: cl[0], g: cl[1], b: cl[2], p: dead ? 0 : (fixture === 'bulb' ? 0.6 : 0.6) * (flicker ? 0.6 : 1), fixture: fixture === 'tube' ? 'tube' : fixture === 'bulb' ? 'bulb' : 'panel', dead, flicker, along });
    }
  }
}
