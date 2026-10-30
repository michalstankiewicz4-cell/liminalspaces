// The journey down the Great Path (part 2 of the story, "Rudon's Plane", the full story video yeHm6IBG9tQ from 57:51):
// from the gate of the West Court to the half-way point of the Design. Everything is painted one 32 m column at a
// time (layout.js clips every call to the column), so this code runs again for every column and must stay pure and
// deterministic (no Math.random). Months of walking are shortened to metres; a paper note says so at every episode.
// Every element is listed with its story time in docs/GREAT_PATH.md.
//
// The hallway runs east along z = zc (0, later -1 after the offset at 89:48). Floor height f follows the story: a
// step down at the offset, the 7 m drop into the shaft (93:17), then a slow descent while the ceiling comes down
// to a crawl (96:08–103:13). The round room (105:42) has the lever and the stairs up to the surface (surface.js).

/* ---- x positions of the episodes (metres from the Hub; the gate is at 58) ---- */
export const JX = {
  start: 60, closeGate: 112, cable: 170, dusk: 196, night: 256, camp: 300, morning: 336, marks: 344, niches: 412, cracks: 500,
  carpet: 560, cross1: 640, cross2: 720, cross3: 784, longNight: 808, floors: 904, scurry: 1048, bulge: 1076, turn: 1120,
  blackA: 1168, blackB: 1304, firstSky: 1308, year: 1360, fork: 1442, half: 1540, bar: 1608, offset: 1680, glass: 1728,
  winA: 1764, winB: 1796, glassEnd: 1832, grate: 1904, grateEnd: 1952, columns: 1968, columnsEnd: 2088, district: 2104,
  districtEnd: 2264, shaft: 2304, gap: 2308, trash: 2340, descent: 2400, squeeze: 2600, stuck: 2676, emerge: 2700,
  lightAgain: 2712, lastMeal: 2760, black: 2800, roomA: 2896, roomB: 2976, beyond: 2986,
};
export const ROOM_R = 10;                         // the round rooms (105:42), radius in metres
// the collapsible staircases (106:46): 13 steps of 0.3 m up to the roof; A rises east of the centre, B (the mirror) west
export const STAIRS = {
  steps: 13, rise: 0.3, run: 0.3, w: 1.2,
  A: { x0: JX.roomA + 2, dir: 1, hole: [JX.roomA + 3, JX.roomA + 6.5] },
  B: { x0: JX.roomB - 2, dir: -1, hole: [JX.roomB - 6.5, JX.roomB - 3] },
};
// the loop at the fork (85:22): a branch at a shallow angle into a ring that comes back to itself
export const LOOP = { fx: JX.fork, cx: 1478, cz: -34, r: 24, phi: -0.6 };
LOOP.tx = LOOP.cx + LOOP.r * Math.sin(LOOP.phi); LOOP.tz = LOOP.cz + LOOP.r * Math.cos(LOOP.phi);

// centre line and floor height of the hallway at x
export function base(x) {
  const zc = x < JX.offset ? 0 : -1;
  let f = 0;
  if (x >= JX.offset) f = -0.45;
  if (x >= JX.shaft) f = -7.45;
  if (x >= JX.descent) f = -7.45 - 2 * Math.min(1, (x - JX.descent) / (JX.squeeze - JX.descent));
  return { zc, f: Math.round(f * 100) / 100 };
}
export const DEEP_F = -9.45;                    // floor of the round rooms
export const SURFACE_Y = DEEP_F + 3.35 + 0.55;  // the roof: the white plane (107:27)
// ceiling height above the floor along the deep part (96:08 – 103:13): the ceiling comes down to a crawl
export function ceilRel(x) {
  const H = 3.35;
  if (x < JX.descent + 40) return H;
  if (x < JX.squeeze) return H - (H - 1.25) * (x - JX.descent - 40) / (JX.squeeze - JX.descent - 40);
  if (x < JX.stuck - 16) return 1.25 - 0.6 * (x - JX.squeeze) / (JX.stuck - 16 - JX.squeeze);
  if (x < JX.stuck + 4) return 0.65;
  if (x < JX.emerge) return 0.65 + (1.25 - 0.65) * (x - JX.stuck - 4) / (JX.emerge - JX.stuck - 4);
  if (x < JX.emerge + 8) return 1.25 + (H - 1.25) * (x - JX.emerge) / 8;
  return H;
}
// width of the hallway (the squeeze narrows to a shaft)
function width(x) {
  if (x < JX.squeeze + 20 || x >= JX.emerge + 4) return 3;
  if (x < JX.stuck - 10) return 3 - 1.8 * (x - JX.squeeze - 20) / (JX.stuck - 10 - JX.squeeze - 20);
  if (x < JX.emerge) return 1.2;
  return 3;
}

/* ---- zones of the journey (appended to ZONES in layout.js) ---- */
const W = [1.0, 0.92, 0.76];
const DAY = { amb: 0.06, tint: W, fog: [0.22, 0.19, 0.12], fm: 'concrete', wm: 'wallpaper', cm: 'ceiling', lamp: null };
const z = (key, t, o, lx, lz) => ({ key, t, ...DAY, ...o, lx, lz });
export const JOURNEY_ZONES = [
  z('gpCable', '60:31', { map: '#d8bc60' }, JX.cable, 0),
  z('gpDusk', '61:13', { amb: 0.035, tint: [1, 0.78, 0.55], fog: [0.15, 0.1, 0.06], map: '#c89a58', skyGlow: [3.2, 1.9, 1.0] }, 226, 0),
  z('gpNight', '62:14', { amb: 0.012, tint: [0.55, 0.65, 1], fog: [0.015, 0.02, 0.04], map: '#4a5070', night: true, skyGlow: [0.5, 0.55, 0.8] }, JX.camp, 0),
  z('gpMorning', '62:58', { map: '#e0c060' }, 380, 0),
  z('gpNiches', '65:57', { map: '#d8b860' }, 460, 0),
  z('gpCracks', '67:12', { map: '#c0b080' }, 530, 0),
  z('gpCarpet', '67:28', { fm: 'carpetTaupe', map: '#b8a078' }, 600, 0),
  z('gpCross', '69:32', { fm: 'carpetTaupe', map: '#c8b070' }, JX.cross1, -20),
  z('gpLongNight', '72:25', { fm: 'carpetTaupe', amb: 0.014, tint: [0.55, 0.65, 1], fog: [0.02, 0.025, 0.045], map: '#505878', night: true, skyGlow: [0.5, 0.55, 0.8] }, 850, 0),
  z('gpFloors', '73:44', { fm: 'boards', map: '#b89060' }, 1000, 0),
  z('gpSkylights', '74:07', { map: '#d8c070' }, JX.bulge, 0),
  z('gpTurn', '75:33', { map: '#c8a868' }, JX.turn, 12),
  z('gpBlackout', '76:05', { amb: 0.0, tint: [1, 1, 1], fog: [0.0, 0.0, 0.0], far: 30, map: '#222' }, 1236, 0),
  z('gpLight', '83:16', { map: '#e8d070' }, JX.firstSky, 0),
  z('gpYear', '83:58', { map: '#d0b868' }, JX.year, 0),
  z('gpFork', '85:22', { map: '#c0a060' }, LOOP.cx, LOOP.cz),
  z('gpHalf', '88:47', { map: '#d0b868' }, JX.half, 0),
  z('gpBar', '89:25', { fm: 'boards', map: '#a87850' }, JX.bar + 16, -3.5),
  z('gpOffset', '89:48', { map: '#d0b868' }, 1700, -1),
  z('gpGlass', '89:54', { amb: 0.12, tint: [0.8, 0.92, 1.05], fog: [0.45, 0.6, 0.72], far: 380, map: '#5a9ac8', fm: 'steel' }, 1780, -1),
  z('gpCarpet2', '90:55', { fm: 'carpetTaupe', map: '#b8a078' }, 1868, -1),
  z('gpGrate', '91:07', { amb: 0.05, fog: [0.08, 0.08, 0.08], map: '#606060', wm: 'concrete' }, 1928, -1),
  z('gpColumns', '91:28', { amb: 0.03, tint: [1, 0.85, 0.65], fog: [0.04, 0.032, 0.024], far: 60, map: '#8a8070', wm: 'concrete', cm: 'concrete' }, 2028, 12),
  z('gpDistrict', '92:07', { amb: 0.05, map: '#b0a080', fm: 'carpetGrey', wm: 'wallpaperOld', lamp: ['panel', 6, 0.9] }, 2184, 12),
  z('gpShaft', '93:17', { amb: 0.05, map: '#908060', wm: 'concrete' }, JX.shaft, -1),
  z('gpDeep', '96:08', { amb: 0.025, fog: [0.08, 0.07, 0.05], map: '#807050' }, 2360, -1),
  z('gpSqueeze', '98:18', { amb: 0.004, tint: [1, 1, 1], fog: [0.0, 0.0, 0.0], far: 24, map: '#3a3020' }, 2640, -1),
  z('gpEmerge', '103:25', { map: '#d8c070' }, 2740, -1),
  z('gpBlack', '105:22', { fm: 'blackTile', map: '#202028' }, 2840, -1),
  z('gpRound', '105:42', { fm: 'blackTile', wm: 'plaster', amb: 0.1, map: '#d8d0c0' }, JX.roomA, -1),
  z('gpMirror', '109:36', { fm: 'blackTile', wm: 'plaster', amb: 0.1, map: '#c8c0b0' }, JX.roomB, -1),
  z('gpBeyond', '109:42', { map: '#e0c060' }, 3040, -1),
];

/* ---- painting ---- */
// h: helpers from layout.js; [xa, xb): the column being painted (calls outside it are clipped anyway)
export function paintJourney(h, xa, xb) {
  const { room, solid, prop, onWall, note, skylight, grid, R, F, M, H, emitter } = h;
  const zo = h.zoneOpts;
  const over = (a, b) => b > xa - 8 && a < xb + 8;          // skip work for far episodes
  const zoneAtX = (x) => {
    for (let i = SEG.length - 1; i >= 0; i--) if (x >= SEG[i][0]) return SEG[i][1];
    return 'greatPath';
  };

  /* -- the hallway, in slices where the floor, ceiling or width change -- */
  const step = 0.5;
  const sliceA = Math.max(JX.start, Math.floor(xa / step) * step), sliceB = Math.min(xb, JX.beyond + 4);
  for (let x = sliceA; x < sliceB; x += step) {
    if (x >= JX.roomA - ROOM_R - 0.01 && x < JX.beyond - 0.01) continue;          // the round rooms are painted below
    const { zc, f } = base(x), w = width(x), zk = zoneAtX(x);
    const cr = ceilRel(x);
    solid(x, zc - 3, x + step, zc + 3);
    room(zk, x, zc - w / 2, x + step, zc + w / 2, { floor: f, ceil: f + cr, flags: 0 });
  }
  // beyond the mirror room: the other hallway, endless (109:42)
  if (xb > JX.beyond) {
    const a = Math.max(xa, JX.beyond), { zc, f } = base(a);
    solid(a, zc - 3, xb, zc + 3);
    room('gpBeyond', a, zc - 1.5, xb, zc + 1.5, { floor: f, ceil: f + H, flags: 0 });
  }

  /* -- skylights every 8 m (centred on 8k + 4), styled by the episode -- */
  for (let x = Math.floor(xa / 8) * 8; x < xb; x += 8) {
    const cx = x + 4;
    if (cx < JX.start + 4) continue;
    const sk = skyStyle(cx);
    if (!sk) continue;
    const { zc, f } = base(cx);
    if (sk.well) grid.paint(cx - 1, zc - 1, cx + 1, zc + 1, { ceil: f + ceilRel(cx) + sk.well, where: (px, pz) => grid.isOpen(px, pz) });
    skylight(cx - 1, zc - 1, cx + 1, zc + 1, sk.sun, sk.p, sk.col);
  }

  /* -- explorers' marks (white, until the turn-around point) and Rudon's red chalk (from the first morning) -- */
  for (let x = Math.ceil((xa - 20) / 48) * 48 + 20; x < Math.min(xb, JX.turn); x += 48) if (plainWall(x)) prop('chalk', x, base(x).zc - 1.5, 0, { n: 1 + (Math.abs(x / 48) | 0) % 5, y: 0 });
  for (let x = Math.ceil((xa - JX.marks) / 32) * 32 + JX.marks; x < Math.min(xb, JX.roomA - 12); x += 32) {
    if (!plainWall(x + 2) || (x > JX.blackA && x < JX.blackB && (x / 32) % 2)) continue;
    const { zc, f } = base(x + 2);
    if (x >= JX.squeeze && x < JX.emerge) continue;
    prop('chalk', x + 2, zc - width(x + 2) / 2, 0, { n: 1, red: true, y: f });
  }
  // rain water collectors under a skylight every 160 m (64:28, 104:35)
  for (const x of [84, 244, 404, 724, 884, 1044, 1364, 1524, 1844, 2164, 2324, JX.lastMeal - 4]) if (x >= xa && x < xb) prop('funnel', x, base(x).zc, 0, { top: grid.ceilAt(x, base(x).zc) - base(x).f, y: base(x).f });

  /* ================= 59:21 departure: decay and trash that thin out ================= */
  if (over(60, 140)) {
    for (let k = 0; k < 28; k++) {
      const x = 62 + k * 2.6 + R(k, 3, 71) * 2, p = Math.max(0, 1 - (x - 60) / 80);
      if (R(k, 0, 72) > p) continue;
      const zz = (R(k, 1, 73) - 0.5) * 1.3;
      prop(R(k, 2, 74) < 0.5 ? 'papers' : 'trash', x, zz, R(k, 4, 75) * 6, { seed: k, n: 2 + (k % 3) });
    }
    note(66, 0, 0, -1, 'gp.n.greatPath');
    note(98, 0, 0, 1, 'gp.n.j.depart');
  }
  /* 60:31 the first and last Vibra-cable */
  if (over(150, 200)) {
    for (let a = 150; a < 186; a += 12) { const w = h.wallAt(a + 6, 0, 0, -1); prop('cable', a + 6, w.z + 0.005, 0, { len: 12, frayed: a + 12 >= 186, y: 0 }); }
    onWall('station', JX.cable, 0, 0, -1);
    note(JX.cable + 3, 0, 0, -1, 'gp.n.j.cable');
  }
  /* 61:13 dusk, a meal (61:18); 62:14 the first night: the camp */
  if (over(196, 340)) {
    note(200, 0, 0, 1, 'gp.n.j.dusk');
    prop('meal', 229, 1.0, Math.PI);
    note(263, 0, 0, -1, 'gp.n.j.night');
    prop('camp', JX.camp, 0.4, Math.PI / 2);
  }
  /* 62:58 morning: the explorers' marks, Rudon starts his own red marks (63:15) */
  if (over(336, 420)) {
    for (let k = 0; k < 5; k++) prop('chalk', JX.marks - 2 + k * 0.6, -1.5, 0, { n: 2 + k, y: 0, low: true });
    note(JX.marks + 4, 0, 0, -1, 'gp.n.j.morning');
  }
  /* 65:57 the toilet niches, "every hour or so" */
  for (const x of [JX.niches + 12, JX.niches + 52, 1012, 1396, 1572, 2236, 2780]) if (x >= xa - 2 && x < xb + 2) niche(x);
  if (over(410, 430)) note(JX.niches + 8, 0, 0, 1, 'gp.n.j.niches');
  /* 67:12 cracks in the concrete; 67:28 the floor turns to carpet at a line between skylights */
  if (over(500, 570)) {
    for (let k = 0; k < 16; k++) { const x = 502 + k * 3.4 + R(k, 0, 81) * 1.5; prop('crack', x, (R(k, 1, 82) - 0.5) * 1.6, R(k, 2, 83) < 0.5 ? 0 : Math.PI, { seed: k }); }
    note(504, 0, 0, -1, 'gp.n.j.cracks');
    note(JX.carpet + 3, 0, 0, 1, 'gp.n.j.carpet');
  }
  /* 69:32 – 72:04 intersections; the side halls end after "20 minutes" (shortened): shelves, a ramp */
  if (over(JX.cross1 - 2, JX.cross1 + 2)) { crossHall(JX.cross1, -38, 38); note(JX.cross1 - 3, 0, 0, -1, 'gp.n.j.cross'); }
  if (over(JX.cross2 - 2, JX.cross2 + 2)) {
    crossHall(JX.cross2, -20, 30);
    prop('builtShelves', JX.cross2, 29.5, Math.PI, { w: 2.6 });
    note(JX.cross2 + 1.5, 27, 1, 0, 'gp.n.j.shelves');
  }
  if (over(JX.cross3 - 2, JX.cross3 + 2)) {
    crossHall(JX.cross3, -24, 14);
    // the last 6 m of the north arm slide down to a wall 12 ft deep
    for (let k = 0; k < 12; k++) room('gpCross', JX.cross3 - 1.5, -24 - k * 0.5 - 0.5, JX.cross3 + 1.5, -24 - k * 0.5, { floor: -0.3 * (k + 1), ceil: H, flags: 0 });
    note(JX.cross3 + 1.5, -22, 1, 0, 'gp.n.j.ramp');
  }
  /* 72:25 days shorter, nights longer */
  if (over(JX.longNight, JX.longNight + 6)) note(JX.longNight + 3, 0, 0, -1, 'gp.n.j.longNight');
  /* 73:44 concrete → carpet → floorboards → concrete; 73:53 counting skylights */
  if (over(904, 1046)) {
    room('gpFloors', 904, -1.5, 944, 1.5, { fm: M.concrete, floor: 0, ceil: H, flags: 0 });
    room('gpFloors', 944, -1.5, 984, 1.5, { fm: M.carpetTaupe, floor: 0, ceil: H, flags: 0 });
    room('gpFloors', 1024, -1.5, 1046, 1.5, { fm: M.concrete, floor: 0, ceil: H, flags: 0 });
    note(908, 0, 0, 1, 'gp.n.j.floors');
    note(1001, 0, 0, -1, 'gp.n.j.count');
  }
  /* 74:07 something scurries across the skylights, knocking; 74:42 a skylight curved outward, a stack of books */
  if (over(1046, 1090)) {
    prop('bulge', JX.bulge, 0, 0, { y: H + 0.55 });
    prop('books', JX.bulge + 0.3, 0.2, 0.4);
    note(JX.bulge + 3, 0, 0, 1, 'gp.n.j.bulge');
  }
  /* 75:33 the turn-around point; "blackout" beyond */
  if (over(JX.turn - 2, JX.turn + 2)) {
    crossHall(JX.turn, -14, 40);
    note(JX.turn + 1.5, 38, 1, 0, 'gp.n.j.turnEnd');
    note(JX.turn - 3, 0, 0, -1, 'gp.n.j.turn');
  }
  if (over(JX.blackA - 6, JX.blackA)) note(JX.blackA - 4, 0, 0, 1, 'gp.n.j.blackout');
  /* 83:16 the first skylight after the dark; 83:58 one year passed: a broken skateboard */
  if (over(JX.firstSky, JX.year + 6)) {
    note(JX.firstSky + 3, 0, 0, -1, 'gp.n.j.light');
    prop('skateboard', JX.year, 1.0, 0.3, { broken: true });
    note(JX.year + 2, 0, 0, 1, 'gp.n.j.year');
  }
  /* 85:22 the split: a branch at a shallow angle that curves back into itself */
  if (over(JX.fork - 2, LOOP.cx + LOOP.r + 3)) paintLoop();
  /* 88:47 half the food is gone */
  if (over(JX.half - 2, JX.half + 4)) { prop('boxes', JX.half, 1.1, 0); note(JX.half + 2, 0, 0, 1, 'gp.n.j.half'); }
  /* 89:25 a long shallow room on the left: bar stools bolted to the floor, a counter, cupboards */
  if (over(JX.bar, JX.bar + 34)) {
    room('gpBar', JX.bar + 2, -4.5, JX.bar + 30, -1.5, { floor: 0, ceil: H, flags: F.SKIRT });
    prop('counter', JX.bar + 16, -3.55, 0, { w: 24 });
    for (let k = 0; k < 18; k++) prop('stool', JX.bar + 4 + k * 1.35, -2.75, 0);
    for (let k = 0; k < 9; k++) prop('cupboard', JX.bar + 4.5 + k * 2.7, -4.5, 0, { y: 0 });
    note(JX.bar + 1, 0, 0, -1, 'gp.n.j.bar');
  }
  /* 89:48 the hall moves a few feet to the left and down */
  if (over(JX.offset - 4, JX.offset + 4)) note(JX.offset + 2, -1, 0, 1, 'gp.n.j.offset');
  /* 89:54 a glass floor over flowing water; 90:13 an opening to the outside, the ocean */
  if (over(JX.glass - 2, JX.glassEnd + 30)) paintGlass();
  /* 91:07 a metal grate over an abyss, wind howling through it */
  if (over(JX.grate - 2, JX.grateEnd + 2)) {
    const { zc, f } = base(JX.grate);
    room('gpGrate', JX.grate, zc - 1.5, JX.grateEnd, zc + 1.5, { floor: f, ceil: f + H, flags: F.NOFLOOR, fm: M.steel });
    h.water.push({ kind: 'pit', x0: Math.max(xa, JX.grate), x1: Math.min(xb, JX.grateEnd), z0: zc - 1.5, z1: zc + 1.5, y: f - 40, top: f });
    for (let x = JX.grate; x < JX.grateEnd; x += 4) prop('grate', x + 2, zc, 0, { w: 3, len: 4, y: f });
    emitter('abyss', (JX.grate + JX.grateEnd) / 2, f - 2, zc);
    note(JX.grate - 2, zc, 0, -1, 'gp.n.j.grate');
  }
  /* 91:28 a room of columns, a soft glow along the path */
  if (over(JX.columns, JX.columnsEnd)) paintColumns();
  /* 92:07 an abandoned district */
  if (over(JX.district, JX.districtEnd)) paintDistrict();
  /* 93:17 the floor gives way: the path continues 20–30 ft below */
  if (over(JX.shaft - 8, JX.gap + 4)) {
    const top = base(JX.shaft - 1), low = base(JX.shaft);
    room('gpShaft', JX.shaft, low.zc - 1.5, JX.gap, low.zc + 1.5, { floor: low.f, ceil: top.f + H, flags: 0 });
    prop('holds', JX.shaft, low.zc, Math.PI / 2, { y: low.f, h: top.f - low.f });
    note(JX.shaft - 3, top.zc, 0, -1, 'gp.n.j.shaft');
    note(JX.gap + 3, low.zc, 0, 1, 'gp.n.j.deep', {}, { h: 1.55 });
  }
  /* 96:30 bits of trash: broken glass, torn material, string */
  if (over(JX.trash, JX.trash + 40)) for (let k = 0; k < 14; k++) {
    const x = JX.trash + k * 2.8 + R(k, 0, 91) * 1.5, { zc } = base(x);
    prop(['shards', 'cloth', 'string'][k % 3], x, zc + (R(k, 1, 92) - 0.5) * 2, R(k, 2, 93) * 6, { seed: k });
  }
  /* 97:17 deeper and darker; the ceiling comes down (98:18); crawling, stuck (101:25); light again (103:25) */
  if (over(JX.descent, JX.descent + 4)) note(JX.descent + 2, base(JX.descent).zc, 0, -1, 'gp.n.j.descent');
  if (over(JX.squeeze - 4, JX.squeeze)) note(JX.squeeze - 2, base(JX.squeeze).zc, 0, 1, 'gp.n.j.squeeze', {}, { h: 0.9 });
  if (over(JX.lightAgain, JX.lightAgain + 6)) note(JX.lightAgain + 3, base(JX.lightAgain).zc, 0, -1, 'gp.n.j.emerge');
  if (over(JX.lastMeal - 6, JX.lastMeal + 6)) note(JX.lastMeal + 2, base(JX.lastMeal).zc, 0, 1, 'gp.n.j.lastMeal');
  /* 105:22 black tiles that reflect the sun */
  if (over(JX.black, JX.roomA - ROOM_R)) {
    const { zc, f } = base(JX.black);
    room('gpBlack', JX.black, zc - 1.5, JX.roomA - ROOM_R + 0.5, zc + 1.5, { floor: f, ceil: f + H, flags: 0 });
    note(JX.black + 3, zc, 0, -1, 'gp.n.j.black');
  }
  /* 105:42 the round rooms (ours and the mirror), the switch, the stairs up; 109:42 the other hallway */
  if (over(JX.roomA - ROOM_R, JX.roomB + ROOM_R)) { roundRoom('gpRound', JX.roomA, STAIRS.A); roundRoom('gpMirror', JX.roomB, STAIRS.B); }
  if (over(JX.beyond, JX.beyond + 6)) note(JX.beyond + 3, base(JX.beyond).zc, 0, -1, 'gp.n.j.beyond');
  if (over(JX.roomA - 12, JX.roomA - 8)) note(JX.roomA - ROOM_R - 1, base(JX.roomA).zc, 0, 1, 'gp.n.j.round');

  /* ---------------- helpers ---------------- */
  // which skylight style an x gets (null = none)
  function skyStyle(x) {
    if (x >= JX.blackA && x < JX.blackB) return null;                                          // blackout
    if (x >= JX.squeeze - 30 && x < JX.lightAgain - 1) return null;                             // too deep, too dark
    if ((x >= JX.columns && x < JX.columnsEnd) || (x >= JX.shaft - 2 && x < JX.gap + 2) || (x >= JX.roomA - ROOM_R - 1)) return null;
    if (x >= JX.grate && x < JX.grateEnd) return { sun: 0.5, p: 0.5 };
    if (x >= JX.night && x < JX.morning) return { sun: 0, p: 0.12, col: [0.45, 0.55, 1] };
    if (x >= JX.longNight && x < JX.floors - 8) return { sun: 0, p: 0.12, col: [0.45, 0.55, 1] };
    if (x >= JX.dusk && x < JX.night) { const k = (x - JX.dusk) / (JX.night - JX.dusk); return { sun: 0.6 - 0.5 * k, p: 0.7 - 0.45 * k, col: [1, 0.72, 0.45] }; }
    if (x >= JX.gap) {                                                                          // deep: skylights in ever higher wells
      const k = Math.min(1, (x - JX.gap) / (JX.squeeze - 30 - JX.gap));
      if (x >= JX.lightAgain - 1) return { sun: x < JX.lightAgain + 8 ? 0.5 : 0.85, p: 0.7, well: 0 };
      return { sun: 0.55 - 0.4 * k, p: 0.5 - 0.35 * k, well: 2 + 8 * k };
    }
    return { sun: 0.9, p: 0.8 };
  }
  // is the left wall at x a plain hallway wall (no side room, crossing or special section)?
  function plainWall(x) {
    for (const c of [JX.cross1, JX.cross2, JX.cross3, JX.turn]) if (Math.abs(x - c) < 3) return false;
    if (x > JX.bar && x < JX.bar + 32) return false;
    if (x > JX.glass - 1 && x < JX.glassEnd + 1) return false;
    if (x > JX.columns - 1 && x < JX.districtEnd + 1) return false;
    if (x > JX.fork - 3 && x < JX.fork + 26) return false;
    return true;
  }
  // a cross hall at x from z0 to z1 (dead ends)
  function crossHall(x, z0, z1) {
    room('gpCross', x - 1.5, z0, x + 1.5, z1, { floor: 0, ceil: H, flags: 0 });
    for (let zz = z0 + 6; zz < z1 - 4; zz += 8) if (Math.abs(zz) > 3) skylight(x - 1, zz, x + 1, zz + 2, 0.85, 0.7);
  }
  // a small human-sized alcove in the right wall with a hole at the bottom (65:57)
  function niche(x) {
    const { zc, f } = base(x), w = width(x);
    room(zoneAtX(x), x - 0.5, zc + w / 2, x + 0.5, zc + w / 2 + 1, { floor: f, ceil: f + 2.2, flags: 0 });
    prop('toilet', x, zc + w / 2 + 0.5, Math.PI, { y: f });
  }
  // the fork and the loop (85:22 – 88:02)
  function paintLoop() {
    const fx = LOOP.fx, fz = -1.5, tx = LOOP.tx, tz = LOOP.tz;
    const dx = tx - fx, dz = tz - fz, L = Math.hypot(dx, dz);
    const inBranch = (px, pz) => { const t = Math.max(0, Math.min(1, ((px - fx) * dx + (pz - fz) * dz) / (L * L))); return Math.hypot(px - fx - dx * t, pz - fz - dz * t) < 1.5; };
    const inRing = (px, pz) => Math.abs(Math.hypot(px - LOOP.cx, pz - LOOP.cz) - LOOP.r) < 1.5;
    room('gpFork', fx - 3, LOOP.cz - LOOP.r - 2, LOOP.cx + LOOP.r + 2, -1.5, { floor: 0, ceil: H, flags: 0, where: (px, pz) => inBranch(px, pz) || inRing(px, pz) });
    // skylights along the branch and the ring (snapped to the cell grid)
    const sky = (px, pz) => { const a = Math.round(px * 2) / 2, b = Math.round(pz * 2) / 2; skylight(a - 1, b - 1, a + 1, b + 1, 0.85, 0.75); };
    for (let t = 6; t < L - 3; t += 8) sky(fx + dx * t / L, fz + dz * t / L);
    for (let k = 0; k < 18; k++) { const a = LOOP.phi + 0.18 + k * (Math.PI * 2 - 0.36) / 18; sky(LOOP.cx + LOOP.r * Math.sin(a), LOOP.cz + LOOP.r * Math.cos(a)); }
    // his own red marks on the outer wall of the ring, where it runs straight along x or z (and one by the junction)
    for (const a of [LOOP.phi - 0.32, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const ix = LOOP.cx + (LOOP.r + 0.5) * Math.sin(a), iz = LOOP.cz + (LOOP.r + 0.5) * Math.cos(a);
      const ax = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a));
      onWall('chalk', ix, iz, ax ? Math.sign(Math.sin(a)) : 0, ax ? 0 : Math.sign(Math.cos(a)), { n: 1, red: true, y: 0 });
    }
    note(fx - 2, 0, 0, 1, 'gp.n.j.fork');
    note(tx - 1.2, tz - 0.6, -1, 0, 'gp.n.j.loop');
  }
  // the glass floor over the water channel, the opening to the outside
  function paintGlass() {
    const { zc, f } = base(JX.glass);
    // the floor is glass: walkable cells with no floor drawn; the water and the channel's sides are drawn by water.js
    room('gpGlass', JX.glass, zc - 1.5, JX.glassEnd, zc + 1.5, { floor: f, ceil: f + H, flags: F.NOFLOOR, fm: M.steel, wm: M.concrete });
    for (let x = JX.glass; x < JX.glassEnd; x += 4) prop('glassFloor', x + 2, zc, 0, { w: 3, len: 4, y: f });
    h.water.push({ kind: 'channel', x0: Math.max(xa, JX.glass), x1: Math.min(xb, JX.glassEnd), z0: zc - 1.5, z1: zc + 1.5, y: f - 0.45, top: f });
    // the opening (90:13): the wall is cut out; beyond it the open air above the ocean (no ceiling, no walls)
    room('gpGlass', JX.winA, zc - 2.0, JX.winB, zc - 1.5, { floor: f, ceil: f + 2.9, flags: 0, fm: M.concrete });
    grid.paint(JX.winA - 60, zc - 140, JX.winB + 60, zc - 2.0, { ...zo('gpGlass'), floor: f - 30, ceil: f + 300, flags: F.OUT, fm: M.dark });
    prop('blocker', (JX.winA + JX.winB) / 2, zc - 1.9, 0, { w: JX.winB - JX.winA, h: 3, y: f });
    prop('sill', (JX.winA + JX.winB) / 2, zc - 1.75, 0, { w: JX.winB - JX.winA, y: f });
    if (JX.winA >= xa && JX.winA < xb) h.water.push({ kind: 'ocean', x: (JX.winA + JX.winB) / 2, z: zc - 2, y: f - 14 });
    emitter('water', (JX.glass + JX.glassEnd) / 2, f - 0.6, zc);
    emitter('surf', (JX.winA + JX.winB) / 2, f - 6, zc - 12);
    note(JX.glass - 2, zc, 0, -1, 'gp.n.j.glass');
    note(JX.winB + 2, zc, 0, 1, 'gp.n.j.window');
    note(JX.glassEnd + 3, zc, 0, -1, 'gp.n.j.carpet2');
  }
  // forests of concrete columns in a dim room (91:28)
  function paintColumns() {
    const { zc, f } = base(JX.columns), z0 = zc - 40, z1 = zc + 40;
    room('gpColumns', JX.columns, z0, JX.columnsEnd, z1, { floor: f, ceil: f + 5.5, flags: 0 });
    for (let x = JX.columns + 2.5; x < JX.columnsEnd - 1; x += 5) for (let zz = z0 + 2.5; zz < z1 - 1; zz += 5) {
      if (Math.abs(zz - zc) < 2.6) continue;
      prop('column', x, zz, 0, { h: 5.5, r: 0.45, y: f });
    }
    for (let x = JX.columns + 2; x + 8 <= JX.columnsEnd - 1; x += 8) for (const s of [-1, 1]) prop('glowStrip', x + 4, zc + s * 1.9, 0, { len: 8, y: f });
    for (let x = JX.columns + 4; x < JX.columnsEnd; x += 6) for (const s of [-1, 1]) grid.addLight({ x, z: zc + s * 1.9, y: f + 0.12, r: 1, g: 0.8, b: 0.55, p: 0.32 });
    note(JX.columns + 0.5, zc - 3.4, -1, 0, 'gp.n.j.columns', {}, {});          // on the west wall, beside the way in
  }
  // an empty district: halls branch off more and more often; rooms with windows, dusty furniture (92:07)
  function paintDistrict() {
    const { zc, f } = base(JX.district);
    note(JX.district + 2, zc, 0, -1, 'gp.n.j.district');
    let i = 0;
    for (let x = JX.district + 8; x < JX.districtEnd - 8; x += 16, i++) {
      const s = i % 2 ? 1 : -1;                         // alternate sides
      const len = 10 + (i % 3) * 4;
      // the branch hall
      room('gpDistrict', x - 1, s < 0 ? zc - 1.5 - len : zc + 1.5, x + 1, s < 0 ? zc - 1.5 : zc + 1.5 + len, { floor: f, ceil: f + H, flags: F.SKIRT });
      // two rooms on the branch, with a window between them
      for (const side of [-1, 1]) {
        const rx0 = side < 0 ? x - 7.5 : x + 1.5, zA = s < 0 ? zc - 1.5 - len + 1 : zc + 1.5 + len - 6;
        room('gpDistrict', rx0, zA, rx0 + 6, zA + 5, { floor: f, ceil: f + H, flags: F.SKIRT });
        room('gpDistrict', side < 0 ? x - 1.5 : x + 1, zA + 2, side < 0 ? x - 1 : x + 1.5, zA + 3, { floor: f, ceil: f + 2.3, flags: 0 });
        // interior window from the room to the branch hall
        room('gpDistrict', side < 0 ? x - 1.5 : x + 1, zA + 3.5, side < 0 ? x - 1 : x + 1.5, zA + 4.5, { floor: f + 1.0, ceil: f + 2.1, flags: 0 });
        const cx = rx0 + 3, cz = zA + 2.5, r = R(i, side, 95);
        prop('table', cx, cz, 0, { w: 1.4, d: 0.8, y: f });
        prop('chair', cx + 0.95, cz, -Math.PI / 2, { y: f });
        if (r < 0.5) prop('bed', rx0 + 1.2, zA + 2.5, Math.PI / 2, { y: f }); else prop('shelf', rx0 + 3, zA + 0.3, 0, { w: 2.2, books: r > 0.75, y: f });
        prop('papers', cx - 0.3, cz - 1.5, 0, { seed: i * 3 + side + 3, n: 3, y: f });
        if (r > 0.6) emitter('commotion', cx, f + 1.4, cz);
      }
      skylight(x - 1, s < 0 ? zc - 1.5 - len / 2 - 1 : zc + 1.5 + len / 2 - 1, x + 1, s < 0 ? zc - 1.5 - len / 2 + 1 : zc + 1.5 + len / 2 + 1, 0.6, 0.6);
    }
  }
  // a round room with skylights along its curved border, the plate, and the stair hole to the roof (105:42)
  function roundRoom(zk, cx, st) {
    const { zc, f } = base(cx);
    const inside = (px, pz) => Math.hypot(px - cx, pz - zc) < ROOM_R;
    solid(cx - ROOM_R - 1, zc - ROOM_R - 1, cx + ROOM_R + 1, zc + ROOM_R + 1, { where: (px, pz) => !inside(px, pz) && Math.abs(pz - zc) > 1.5 });
    room(zk, cx - ROOM_R, zc - ROOM_R, cx + ROOM_R, zc + ROOM_R, { floor: f, ceil: f + H, flags: 0, where: inside });
    if (zk === 'gpMirror') solid(cx - ROOM_R - 0.5, zc - 1.5, cx - ROOM_R + 0.01, zc + 1.5);          // the mirror room has no way west
    else solid(cx + ROOM_R - 0.01, zc - 1.5, cx + ROOM_R + 0.5, zc + 1.5);                             // ours ends: "the hallway did not go any further"
    for (let k = 0; k < 16; k++) {
      const a = (k + 0.5) * Math.PI / 8, px = Math.round((cx + Math.cos(a) * 8.3) * 2) / 2, pz = Math.round((zc + Math.sin(a) * 8.3) * 2) / 2;
      skylight(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5, 0.22, 0.45);
    }
    // the hole for the stairs: open to the sky once the stairs are down (stairs and lid are built in journey-run.js)
    grid.paint(st.hole[0], zc - 0.75, st.hole[1], zc + 0.75, { ...zo(zk), floor: f, ceil: f + 300, flags: F.OUT });
    prop('plate', cx, zc, 0, { y: f });
    if (zk === 'gpRound') prop('backpack', st.x0 - 0.6, zc + 1.1, Math.PI / 2, { y: f });     // he lets it slide off (107:11)
  }
}

// x ranges of the zones along the hallway (the first match from the end wins)
const SEG = [
  [JX.start, 'greatPath'], [140, 'gpCable'], [JX.dusk, 'gpDusk'], [JX.night, 'gpNight'], [JX.morning, 'gpMorning'], [JX.niches, 'gpNiches'],
  [JX.cracks, 'gpCracks'], [JX.carpet, 'gpCarpet'], [JX.cross1 - 8, 'gpCross'], [JX.longNight, 'gpLongNight'], [JX.floors, 'gpFloors'],
  [JX.scurry - 8, 'gpSkylights'], [JX.turn - 8, 'gpTurn'], [JX.blackA, 'gpBlackout'], [JX.blackB, 'gpLight'], [JX.year - 10, 'gpYear'],
  [JX.fork - 6, 'gpFork'], [JX.half - 20, 'gpHalf'], [JX.bar - 4, 'gpBar'], [JX.offset, 'gpOffset'], [JX.glass, 'gpGlass'], [JX.glassEnd, 'gpCarpet2'],
  [JX.grate, 'gpGrate'], [JX.grateEnd, 'gpCarpet2'], [JX.columns, 'gpColumns'], [JX.columnsEnd, 'gpOffset'], [JX.district, 'gpDistrict'],
  [JX.districtEnd, 'gpOffset'], [JX.shaft, 'gpShaft'], [JX.gap, 'gpDeep'], [JX.squeeze - 30, 'gpSqueeze'], [JX.emerge, 'gpEmerge'], [JX.black, 'gpBlack'],
];
