// Props for the Great Path world, built from boxes and prisms in local coordinates (front = +z, quarter-turn rotations).
// Every prop is described by plain data { kind, x, y, z, rot, ...params } placed by layout.js; the same function also
// runs in "dry" mode to collect colliders (box(..., { solid: true })).
const S = { solid: true };

export function buildProp(E, p) {
  E.at(p.x, p.y || 0, p.z, p.rot || 0);
  const f = PROPS[p.kind];
  if (f) f(E, p);
  E.T = null;
}

function legs4(E, w, d, h, mat = 'steel', t = 0.04) {
  for (const [x, z] of [[-w / 2 + t, -d / 2 + t], [w / 2 - t, -d / 2 + t], [-w / 2 + t, d / 2 - t], [w / 2 - t, d / 2 - t]]) E.box(mat, x - t / 2, 0, z - t / 2, x + t / 2, h, z + t / 2);
}

const PROPS = {
  /* ---- furniture ---- */
  table(E, p) {
    const w = p.w || 1.8, d = p.d || 0.8, h = p.h || 0.75;
    E.box(p.mat || 'wood', -w / 2, h - 0.04, -d / 2, w / 2, h, d / 2, S);
    legs4(E, w, d, h - 0.04);
    if (p.benches) for (const s of [-1, 1]) {
      E.box('wood', -w / 2, 0.42, s * (d / 2 + 0.3) - 0.15, w / 2, 0.46, s * (d / 2 + 0.3) + 0.15, S);
      legs4({ box: (m, a, b, c, e, f2, g) => E.box(m, a, b, c + s * (d / 2 + 0.3), e, f2, g + s * (d / 2 + 0.3)) }, w, 0.3, 0.42);
    }
    if (p.tray) { E.box('plastic', -0.2, h, -0.15, 0.2, h + 0.02, 0.15); E.prism('plastic', 0.1, 0, 0.04, 0.05, h + 0.02, h + 0.12, 8, { capTop: true }); }
  },
  chair(E, p) {
    E.box(p.mat || 'fabric', -0.22, 0.44, -0.22, 0.22, 0.5, 0.22, S);
    E.box(p.mat || 'fabric', -0.22, 0.5, -0.24, 0.22, 0.95, -0.19);
    legs4(E, 0.44, 0.44, 0.44, 'dark', 0.03);
  },
  desk(E, p) {
    const w = p.w || 1.4;
    E.box('wood', -w / 2, 0.72, -0.35, w / 2, 0.76, 0.35, S);
    E.box('wood', -w / 2, 0, -0.35, -w / 2 + 0.04, 0.72, 0.35); E.box('wood', w / 2 - 0.04, 0, -0.35, w / 2, 0.72, 0.35);
    E.box('wood', w / 2 - 0.44, 0.1, -0.33, w / 2 - 0.04, 0.72, 0.33);
    for (let k = 0; k < 3; k++) E.box('paper', -0.4 + k * 0.05, 0.76 + k * 0.004, -0.15 + k * 0.03, -0.1 + k * 0.05, 0.764 + k * 0.004, 0.12 + k * 0.03);
    if (p.lamp) { E.prism('brass', 0.45, -0.15, 0.08, 0.06, 0.76, 0.79, 8); E.box('brass', 0.44, 0.79, -0.16, 0.46, 1.1, -0.14); E.prism('dark', 0.45, -0.05, 0.12, 0.05, 1.0, 1.12, 8); E.prism('bulb', 0.45, -0.05, 0.05, 0.05, 0.99, 1.0, 6, { capBottom: true, glow: [1.6, 1.4, 1] }); }
    if (p.chair) { E.at(p.x, p.y || 0, p.z, p.rot || 0); PROPS.chair({ box: (m, a, b, c, d2, e, f) => E.box(m, a, b, c + 0.75, d2, e, f + 0.75), prism: E.prism.bind(E) }, { mat: 'fabric' }); }
  },
  bench(E, p) {
    const w = p.w || 2.4;
    E.box('wood', -w / 2, 0.42, -0.2, w / 2, 0.47, 0.2, S);
    E.box('wood', -w / 2, 0.5, 0.16, w / 2, 0.95, 0.2);
    legs4(E, w, 0.4, 0.42, 'dark');
  },
  counter(E, p) {
    const w = p.w || 4;
    E.box('whitepanel', -w / 2, 0, -0.35, w / 2, 1.0, 0.35, S);
    E.box('steel', -w / 2 - 0.03, 1.0, -0.38, w / 2 + 0.03, 1.04, 0.38);
    for (let x = -w / 2 + 0.4; x < w / 2 - 0.2; x += 0.8) E.box('steel', x, 1.04, -0.25, x + 0.5, 1.09, 0.25);
    if (p.glassTop) { E.box('glass', -w / 2, 1.09, -0.05, w / 2, 1.45, -0.03); }
  },
  shelf(E, p) {
    const w = p.w || 2, h = p.h || 2.2, d = 0.45;
    E.box('wood', -w / 2, 0, -d / 2, -w / 2 + 0.04, h, d / 2, S); E.box('wood', w / 2 - 0.04, 0, -d / 2, w / 2, h, d / 2, S);
    E.box('wood', -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02, S);
    for (let k = 0; k < 5; k++) {
      const y = 0.1 + k * (h - 0.2) / 4;
      E.box('wood', -w / 2, y, -d / 2, w / 2, y + 0.03, d / 2, S);
      if (k < 4 && p.rolls) for (let r = 0; r < 9; r++) {
        const rx = -w / 2 + 0.15 + r * (w - 0.3) / 8, len = 0.3 + ((r * 7 + k * 3) % 5) * 0.03;
        E.at(p.x, p.y || 0, p.z, (p.rot || 0));
        E.box('paper', rx - 0.045, y + 0.03, -len / 2 + 0.02, rx + 0.045, y + 0.12, len / 2);
      }
      if (k < 4 && p.books) for (let r = 0; r < 14; r++) {
        const rx = -w / 2 + 0.08 + r * (w - 0.16) / 14, hh = 0.2 + ((r * 5 + k) % 4) * 0.03;
        E.box(r % 3 ? 'fabric' : 'paper', rx, y + 0.03, -0.15, rx + (w - 0.2) / 15, y + 0.03 + hh, 0.17);
      }
    }
  },
  maptable(E, p) {
    E.box('wood', -1.5, 0.86, -0.9, 1.5, 0.9, 0.9, S); legs4(E, 3, 1.8, 0.86, 'wood', 0.08);
    E.box('mapsheet', -1.3, 0.9, -0.75, 1.3, 0.905, 0.75, { uv: 'local' });
    E.prism('paper', -1.2, 0.6, 0.05, 0.05, 0.905, 0.95, 8);
  },
  machine(E, p) {
    // the only one of its kind: a cabinet with a lit glass window showing the big map
    E.box('dark', -1.4, 0, -0.5, 1.4, 2.4, 0.4, S);
    E.box('steel', -1.45, 2.4, -0.55, 1.45, 2.5, 0.45);
    E.box('screen', -1.2, 0.7, 0.4, 1.2, 2.2, 0.41, { uv: 'local', glow: [1.3, 1.3, 1.3], skip: 'nz,px,nx,py,ny' });
    E.box('steel', -1.25, 0.65, 0.4, 1.25, 0.7, 0.45); E.box('steel', -1.25, 2.2, 0.4, 1.25, 2.25, 0.45);
    for (let k = 0; k < 6; k++) E.prism('brass', -1.0 + k * 0.4, 0.5, 0.04, 0.04, 0.42, 0.5, 6, { capTop: true });
    E.box('steel', -0.6, 0.2, 0.4, 0.6, 0.35, 0.5);
  },
  bars(E, p) {
    const w = p.w || 2.5, h = p.h || 2.3;
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += 0.15) E.box('steel', x - 0.015, 0, -0.015, x + 0.015, h, 0.015, p.closed ? S : {});
    E.box('steel', -w / 2, h - 0.06, -0.03, w / 2, h, 0.03); E.box('steel', -w / 2, 1.0, -0.03, w / 2, 1.05, 0.03);
  },
  labbench(E, p) {
    const w = p.w || 2.4;
    E.box('whitepanel', -w / 2, 0, -0.4, w / 2, 0.88, 0.4, S);
    E.box('dark', -w / 2 - 0.02, 0.88, -0.42, w / 2 + 0.02, 0.92, 0.42);
    // instruments: boxes, dials, flasks
    E.box('steel', -w / 2 + 0.15, 0.92, -0.3, -w / 2 + 0.65, 1.25, 0.15);
    E.box('glow', -w / 2 + 0.22, 1.05, 0.15, -w / 2 + 0.58, 1.2, 0.16, { glow: [0.4, 1.2, 0.6] });
    E.box('plastic', -0.2, 0.92, -0.25, 0.3, 1.08, 0.2);
    for (let k = 0; k < 3; k++) E.prism('glass', 0.55 + k * 0.18, -0.1, 0.06, 0.02, 0.92, 1.12, 8);
    E.box('brass', w / 2 - 0.5, 0.92, -0.2, w / 2 - 0.15, 1.05, 0.1);
    E.prism('brass', w / 2 - 0.32, -0.05, 0.015, 0.015, 1.05, 1.4, 6);
  },
  crate(E, p) {
    const s = p.s || 0.6;
    E.box('wood', -s / 2, 0, -s / 2, s / 2, s * 0.8, s / 2, S);
    if (p.bricks) for (let k = 0; k < 4; k++) E.box('soil', -s / 2 + 0.05 + k * (s - 0.1) / 4, s * 0.8, -0.1, -s / 2 + 0.03 + (k + 1) * (s - 0.1) / 4, s * 0.8 + 0.08, 0.12);
  },
  jug(E) { E.prism('plastic', 0, 0, 0.14, 0.14, 0, 0.32, 10, { capTop: true }); E.prism('plastic', 0, 0, 0.14, 0.04, 0.32, 0.4, 10); E.prism('dark', 0, 0, 0.04, 0.04, 0.4, 0.44, 8, { capTop: true }); },
  backpack(E) { E.box('fabric', -0.18, 0, -0.12, 0.18, 0.5, 0.12, S); E.box('fabric', -0.15, 0.08, 0.12, 0.15, 0.3, 0.2); E.box('dark', -0.12, 0.5, -0.02, 0.12, 0.54, 0.02); },
  bike(E, p) {
    for (const z of [-0.55, 0.55]) { E.at(p.x, p.y || 0, p.z, p.rot || 0); wheel(E, 0, z); }
    E.box('steel', -0.02, 0.34, -0.55, 0.02, 0.38, 0.55); E.box('steel', -0.02, 0.38, 0.1, 0.02, 0.85, 0.14);
    E.box('dark', -0.08, 0.85, 0.02, 0.08, 0.9, 0.25); E.box('steel', -0.3, 0.95, -0.5, 0.3, 0.98, -0.46); E.box('steel', -0.02, 0.38, -0.5, 0.02, 0.97, -0.46);
    if (p.drum) { E.prism('steel', 0, 1.15, 0.3, 0.3, 0.2, 0.6, 12, { capTop: true, capBottom: true }); E.box('dark', -0.04, 0.2, 0.8, 0.04, 0.4, 1.0); }
  },
  planter(E, p) {
    const w = p.w || 3, d = p.d || 1.2;
    E.box('wood', -w / 2, 0, -d / 2, w / 2, 0.55, d / 2, S);
    E.box('earth', -w / 2 + 0.06, 0.5, -d / 2 + 0.06, w / 2 - 0.06, 0.52, d / 2 - 0.06);
    for (let k = 0; k < Math.floor(w / 0.35); k++) for (let r = 0; r < 3; r++) {
      const x = -w / 2 + 0.2 + k * 0.35 + (r % 2) * 0.1, z = -d / 2 + 0.25 + r * (d - 0.5) / 2, h = 0.25 + ((k * 7 + r * 3) % 5) * 0.06;
      E.prism('leaf', x, z, 0.12, 0.02, 0.52, 0.52 + h, 5);
    }
  },
  stall(E, p) {
    const w = p.w || 3;
    E.box('wood', -w / 2, 0, -0.4, w / 2, 0.95, 0.4, S);
    for (const x of [-w / 2, w / 2 - 0.06]) E.box('wood', x, 0, -0.45, x + 0.06, 2.3, -0.39);
    E.box('fabric', -w / 2 - 0.1, 2.3, -0.5, w / 2 + 0.1, 2.36, 0.6);
    for (let k = 0; k < 5; k++) E.box(k % 2 ? 'leaf' : 'plastic', -w / 2 + 0.2 + k * (w - 0.4) / 5, 0.95, -0.25, -w / 2 + 0.45 + k * (w - 0.4) / 5, 1.1, 0.2);
  },
  tailor(E, p) {
    PROPS.stall(E, { ...p, w: 2.6 });
    E.at(p.x, p.y || 0, p.z, p.rot || 0);
    for (let k = 0; k < 4; k++) E.prism('fabric', -0.9 + k * 0.6, 0, 0.12, 0.12, 0.95, 1.55, 10, { capTop: true });
    E.box('fabric', 1.5, 0.95, -0.2, 1.8, 1.7, 0.1); E.prism('dark', 1.65, -0.05, 0.03, 0.03, 0, 0.95, 6);
  },
  factory(E, p) {
    E.box('steel', -1.2, 0, -0.8, 1.2, 1.6, 0.8, S);
    E.box('dark', -1.0, 1.6, -0.6, 0.2, 2.2, 0.6, S);
    E.prism('steel', 0.7, 0, 0.18, 0.18, 1.6, 3.3, 10);
    E.box('glow', -0.9, 1.0, 0.8, -0.5, 1.2, 0.81, { glow: [1.4, 0.5, 0.2] });
    for (let k = 0; k < 3; k++) E.prism('brass', -0.2 + k * 0.3, 0.81, 0.05, 0.05, 1.1, 1.13, 8);
  },
  conveyor(E, p) {
    const w = p.w || 6;
    E.box('dark', -w / 2, 0.75, -0.35, w / 2, 0.82, 0.35, S);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 1.2) legs4({ box: (m, a, b, c, d, e, f) => E.box(m, a + x, b, c, d + x, e, f) }, 0.1, 0.7, 0.75);
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.9) E.box('wood', x, 0.82, -0.2, x + 0.4, 1.05, 0.2);
  },
  judgeDesk(E) {
    E.box('wood', -2, 0, -0.5, 2, 1.2, 0.5, S); E.box('wood', -2.1, 1.2, -0.6, 2.1, 1.26, 0.6);
    E.box('wood', -0.3, 0, -1.4, 0.3, 1.2, -0.8); PROPS.chair({ box: (m, a, b, c, d, e, f) => E.box(m, a, b, c - 1.1, d, e, f - 1.1) }, { mat: 'fabric' });
    E.box('brass', 1.2, 1.26, -0.1, 1.5, 1.3, 0.1);
  },
  /* ---- infrastructure ---- */
  cable(E, p) {
    // Vibra-cable: steel cable along a wall (local x from -len/2 to len/2) on small brackets
    const L = p.len, y = p.h || 1.35;
    E.box('steel', -L / 2, y - 0.012, -0.012, L / 2, y + 0.012, 0.012);
    for (let x = -L / 2; x <= L / 2; x += 2) E.box('dark', x - 0.02, y - 0.04, -0.06, x + 0.02, y + 0.01, 0.0);
    if (p.frayed) for (let k = 0; k < 5; k++) E.box('steel', L / 2, y - 0.004 * k, -0.004, L / 2 + 0.06 + k * 0.02, y - 0.004 * k + 0.004, 0.004);
  },
  station(E) {
    // a Vibra-cable station: a box on the wall with a tin cup on a hook
    E.box('steel', -0.25, 1.1, -0.06, 0.25, 1.6, 0.12, S);
    E.box('dark', -0.2, 1.4, 0.12, 0.2, 1.55, 0.13);
    E.prism('steel', 0.05, 0.2, 0.05, 0.06, 1.18, 1.3, 10, { capBottom: true });
    E.box('steel', 0.04, 1.3, 0.12, 0.06, 1.42, 0.14);
    E.box('glow', -0.15, 1.2, 0.12, -0.08, 1.24, 0.125, { glow: [1.4, 0.2, 0.1] });
  },
  funnel(E, p) {
    // rain water collector: funnel above the ceiling opening, pipe down to waist height, bowl on a stand
    const big = p.big, top = p.top || 3.35, r = big ? 1.8 : 0.45;
    E.prism('steel', 0, 0, big ? 0.15 : 0.05, r, top - 0.2, top + 0.5, 12, { inside: false });
    E.prism('steel', 0, 0, big ? 0.15 : 0.05, r, top - 0.2, top + 0.5, 12, { inside: true });
    E.prism('steel', 0, 0, big ? 0.1 : 0.03, big ? 0.1 : 0.03, big ? 1.3 : 1.0, top - 0.2, 8);
    const br = big ? 1.4 : 0.32;
    E.prism('stone', 0, 0, br * 0.75, br, big ? 0.55 : 0.8, big ? 0.95 : 0.95, 12, {});
    E.prism('stone', 0, 0, br * 0.7, br * 0.95, big ? 0.6 : 0.82, big ? 0.95 : 0.95, 12, { inside: true });
    E.disc('water', ...E.tp(0, big ? 0.85 : 0.9, 0), br * 0.9, 12, 1, null);
    E.prism('stone', 0, 0, br * 0.35, br * 0.5, 0, big ? 0.55 : 0.8, 8, { solid: true });
  },
  chalk(E, p) {
    // chalk mark on the left wall: an arrow and tally strokes (local z = wall normal); red = Rudon's own (1:03:21),
    // low = the explorers' marks at waist level (1:03:15)
    const g = p.red ? [0.95, 0.12, 0.08] : [1.05, 1.05, 1.0], y = p.low ? -0.3 : 0;
    E.box('glow', -0.25, 1.2 + y, 0, 0.25, 1.23 + y, 0.004, { glow: g });
    E.box('glow', 0.12, 1.23 + y, 0, 0.16, 1.32 + y, 0.004, { glow: g }); E.box('glow', 0.12, 1.11 + y, 0, 0.16, 1.2 + y, 0.004, { glow: g });
    for (let k = 0; k < (p.n || 3); k++) E.box('glow', -0.2 + k * 0.06, 1.38 + y, 0, -0.18 + k * 0.06, 1.55 + y, 0.004, { glow: g });
  },

  /* ---- the journey down the Great Path (journey.js) ---- */
  trash(E, p) {
    // bits of unidentifiable trash (59:51): a can, a wrapper, a broken box
    const k = p.seed || 0;
    E.prism('steel', 0.1, 0.05, 0.035, 0.035, 0, 0.11, 8, { capTop: true });
    E.box('plastic', -0.25, 0, -0.1 + (k % 3) * 0.05, -0.08, 0.008, 0.02 + (k % 3) * 0.05);
    if (k % 2) E.box('paper', -0.1, 0, 0.1, 0.15, 0.09, 0.28);
  },
  meal(E) {
    // a portable stove, a plate and the small boxes the food cube comes in (1:01:18)
    E.box('steel', -0.15, 0, -0.12, 0.15, 0.1, 0.12); E.prism('dark', 0, 0, 0.09, 0.09, 0.1, 0.12, 10, { capTop: true });
    E.prism('steel', 0.38, 0.05, 0.12, 0.13, 0, 0.02, 12, { capTop: true });
    E.prism('glow', 0.38, 0.05, 0.05, 0.05, 0.02, 0.035, 10, { capTop: true, glow: [0.35, 0.18, 0.1] });
    for (let k = 0; k < 3; k++) E.box('paper', -0.5 + k * 0.08, 0, 0.1, -0.42 + k * 0.08, 0.06 - k * 0.015, 0.18);
  },
  camp(E) {
    // a thin mattress, a sleeping bag, one pillow, the backpack (1:02:14)
    E.box('fabric', -0.35, 0, -1.0, 0.35, 0.04, 1.0, S);
    E.box('fabric', -0.33, 0.04, -0.75, 0.33, 0.16, 0.95);
    E.box('paper', -0.25, 0.04, -0.98, 0.25, 0.14, -0.72);
    E.box('fabric', 0.55, 0, -0.9, 0.9, 0.5, -0.65, S); E.box('dark', 0.6, 0.5, -0.8, 0.85, 0.54, -0.75);
  },
  toilet(E) {
    // a hole at the bottom of the niche (1:05:57): a rim and darkness
    E.prism('stone', 0, 0, 0.24, 0.22, 0, 0.03, 12, { inside: false });
    E.prism('dark', 0, 0, 0.16, 0.16, -0.4, 0.03, 12, { inside: true });
    E.prism('dark', 0, 0, 0.16, 0.16, -0.4, -0.39, 12, { capTop: true });
  },
  crack(E, p) {
    // a crack in the concrete floor (1:07:12): thin dark segments wandering along
    let x = -0.8, z = 0; const k = p.seed || 0;
    for (let s = 0; s < 9; s++) {
      const nx = x + 0.2, nz = z + (((k * 7 + s * 13) % 9) - 4) * 0.025;
      E.box('dark', x, 0.002, Math.min(z, nz) - 0.006, nx, 0.004, Math.max(z, nz) + 0.006, { skip: 'ny' });
      x = nx; z = nz;
    }
  },
  bulge(E) {
    // a skylight curved outward (1:14:42): a glass dome over the opening
    for (let k = 0; k < 4; k++) E.prism('glass', 0, 0, 1.0 - k * 0.22, 0.78 - k * 0.24, k * 0.13, (k + 1) * 0.13, 16, k === 3 ? { capTop: true } : {});
  },
  books(E) {
    // a stack of books to stand on (1:14:52)
    for (let k = 0; k < 5; k++) E.box(k % 2 ? 'fabric' : 'paper', -0.12 + (k % 2) * 0.02, k * 0.05, -0.17, 0.12 + (k % 2) * 0.02, k * 0.05 + 0.048, 0.17, k === 4 ? S : {});
  },
  skateboard(E, p) {
    // a handmade board on plastic wheels; broken in half (1:24:24)
    const b = p.broken;
    E.box('wood', -0.1, 0.07, -0.4, 0.1, 0.09, b ? -0.02 : 0.4);
    if (b) { E.at(p.x + 0.15, p.y || 0, p.z + 0.35, 1.57); E.box('wood', -0.1, 0, -0.38, 0.1, 0.02, 0.02); E.at(p.x, p.y || 0, p.z, p.rot || 0); }
    for (const z of [-0.3, 0.3]) for (const x of [-0.09, 0.09]) if (!b || z < 0) E.prism('plastic', x, z, 0.03, 0.03, 0, 0.07, 8, { capTop: true });
  },
  boxes(E) {
    // empty food boxes stacked by the wall, half of the stack (1:28:47)
    for (let k = 0; k < 4; k++) E.box('paper', -0.3 + (k % 2) * 0.32, Math.floor(k / 2) * 0.12, -0.12, -0.02 + (k % 2) * 0.32, Math.floor(k / 2) * 0.12 + 0.11, 0.12);
  },
  stool(E) {
    // a bar stool bolted to the floor (1:29:31)
    E.prism('steel', 0, 0, 0.16, 0.16, 0, 0.02, 10, { capTop: true });
    E.prism('steel', 0, 0, 0.03, 0.03, 0.02, 0.7, 8);
    E.prism('fabric', 0, 0, 0.18, 0.18, 0.7, 0.76, 12, { capTop: true, solid: true });
  },
  cupboard(E) {
    // cupboards on the back wall of the bar room (1:29:37)
    E.box('wood', -1.2, 0, 0, 1.2, 0.9, 0.5, S); E.box('wood', -1.2, 1.5, 0, 1.2, 2.3, 0.35);
    for (const x of [-0.6, 0.6]) { E.box('dark', x - 0.02, 0.4, 0.5, x + 0.02, 0.6, 0.52); E.box('dark', x - 0.02, 1.7, 0.35, x + 0.02, 1.9, 0.37); }
  },
  glassFloor(E, p) {
    // a glass path over the water channel (1:29:54): glass panes on steel bearers, walkable (invisible collider)
    const L = p.len || 4, w = p.w || 3;
    E.box('glass', -L / 2, -0.03, -w / 2, L / 2, 0, w / 2, { skip: 'nx,px,nz,pz' });
    E.box('steel', -L / 2, -0.12, -w / 2, -L / 2 + 0.06, -0.031, w / 2);          // under the glass, not flush with it
    for (const z of [-w / 2 + 0.03, 0, w / 2 - 0.03]) E.box('steel', -L / 2, -0.1, z - 0.03, L / 2, -0.03, z + 0.03);
  },
  blocker(E, p) { const w = p.w || 2; E.box('dark', -w / 2, 0, -0.1, w / 2, p.h || 3, 0.1, { solid: true, hide: true }); },
  sill(E, p) { const w = p.w || 2; E.box('concrete', -w / 2, 0, -0.25, w / 2, 0.95, 0.05, S); E.box('steel', -w / 2, 0.95, -0.28, w / 2, 1.0, 0.08); },
  grate(E, p) {
    // a metal grate over the abyss (1:31:07): bars across, two bearers, walkable (invisible collider)
    const L = p.len || 4, w = p.w || 3;
    for (let x = -L / 2 + 0.03; x < L / 2; x += 0.09) E.box('steel', x, -0.04, -w / 2, x + 0.025, 0, w / 2, { skip: 'ny' });
    for (const z of [-w / 2 + 0.2, w / 2 - 0.2, 0]) E.box('steel', -L / 2, -0.25, z - 0.04, L / 2, -0.04, z + 0.04);
  },
  column(E, p) {
    // a concrete cylinder holding up the ceiling (1:31:28)
    const h = p.h || 5.5, r = p.r || 0.45;
    E.prism('concrete', 0, 0, r * 1.15, r, 0, 0.3, 16, {});
    E.prism('concrete', 0, 0, r, r, 0.3, h, 16, { solid: true });
  },
  glowStrip(E, p) {
    // the soft glow along the path between the columns
    const L = p.len || 8;
    E.box('steel', -L / 2, 0, -0.08, L / 2, 0.06, 0.08);
    E.box('glow', -L / 2 + 0.05, 0.06, -0.04, L / 2 - 0.05, 0.075, 0.04, { glow: [1.6, 1.2, 0.75] });
  },
  bed(E) {
    E.box('wood', -0.5, 0, -1.0, 0.5, 0.35, 1.0, S);
    E.box('fabric', -0.47, 0.35, -0.97, 0.47, 0.5, 0.97);
    E.box('wood', -0.5, 0, -1.05, 0.5, 0.85, -1.0);
    E.box('paper', -0.3, 0.5, -0.9, 0.3, 0.6, -0.6);
  },
  holds(E, p) {
    // hand and foot holds carved into the wall of the shaft (1:35:16), local z = out of the wall
    const h = p.h || 7;
    for (let k = 0; k < Math.floor(h / 0.45); k++) {
      const y = 0.4 + k * 0.45, x = (k % 2 ? 0.25 : -0.25) + ((k * 7) % 3 - 1) * 0.05;
      E.box('dark', x - 0.1, y, 0, x + 0.1, y + 0.05, 0.004);
    }
  },
  shards(E, p) {
    // broken glass (1:36:30)
    const k = p.seed || 0;
    for (let i = 0; i < 6; i++) { const a = i * 1.7 + k, d = 0.08 + i * 0.05; E.box('glass', Math.cos(a) * d - 0.04, 0, Math.sin(a) * d - 0.03, Math.cos(a) * d + 0.04, 0.006, Math.sin(a) * d + 0.03); }
  },
  cloth(E, p) { const k = p.seed || 0; E.box('fabric', -0.3, 0, -0.15, 0.25, 0.012, 0.18); E.box('fabric', 0.2, 0, 0.1 + (k % 2) * 0.1, 0.45, 0.02, 0.22 + (k % 2) * 0.1); },
  string(E) { for (let i = 0; i < 6; i++) E.box('paper', -0.4 + i * 0.13, 0, -0.005 + Math.sin(i * 1.3) * 0.08, -0.27 + i * 0.13, 0.004, 0.005 + Math.sin(i * 1.3) * 0.08); },
  plate(E) {
    // a movable plate in the floor at the centre of the round room (1:46:04)
    E.box('steel', -0.6, 0, -0.6, 0.6, 0.012, 0.6);
    E.box('dark', -0.62, 0, -0.62, 0.62, 0.006, 0.62);
  },
  builtShelves(E, p) {
    // shelves built into the end wall of a side hall, empty (1:11:50); local z = out of the wall
    const w = p.w || 2.6;
    E.box('concrete', -w / 2, 0, 0, -w / 2 + 0.05, 2.4, 0.4); E.box('concrete', w / 2 - 0.05, 0, 0, w / 2, 2.4, 0.4);
    for (let k = 0; k < 5; k++) E.box('concrete', -w / 2, 0.3 + k * 0.5, 0, w / 2, 0.34 + k * 0.5, 0.4, k === 0 ? S : {});
  },
  vent(E) {
    E.box('steel', -0.35, 2.75, 0, 0.35, 2.78, 0.03); E.box('steel', -0.35, 3.12, 0, 0.35, 3.15, 0.03);
    E.box('steel', -0.35, 2.75, 0, -0.32, 3.15, 0.03); E.box('steel', 0.32, 2.75, 0, 0.35, 3.15, 0.03);
    for (let k = 0; k < 6; k++) E.box('steel', -0.32, 2.8 + k * 0.055, 0, 0.32, 2.815 + k * 0.055, 0.025);
  },
  doorClosed(E, p) {
    // a plain door on a wall surface (local z = out of the wall)
    const m = p.mat || 'wood';
    E.box('whitepanel', -0.55, 0, 0, -0.48, 2.15, 0.06); E.box('whitepanel', 0.48, 0, 0, 0.55, 2.15, 0.06); E.box('whitepanel', -0.55, 2.1, 0, 0.55, 2.17, 0.06);
    E.box(m, -0.48, 0, 0, 0.48, 2.1, 0.035);
    E.prism('brass', 0.36, 0.06, 0.025, 0.025, 1.0, 1.04, 6, { capTop: true, capBottom: true });
  },
  doorFrame(E, p) {
    // an open door frame across a passage (local x across), with the leaf swung open against the side
    const w = p.w || 1.0, m = p.mat || 'wood';
    E.box('whitepanel', -w / 2 - 0.08, 0, -0.06, -w / 2, 2.17, 0.06, S); E.box('whitepanel', w / 2, 0, -0.06, w / 2 + 0.08, 2.17, 0.06, S);
    E.box('whitepanel', -w / 2 - 0.08, 2.1, -0.06, w / 2 + 0.08, 2.17, 0.06);
    E.box(m, w / 2 - 0.04, 0, 0.06, w / 2, 2.08, 0.06 + w * 0.92);
    E.prism('brass', w / 2 - 0.06, 0.06 + w * 0.8, 0.02, 0.02, 1.0, 1.03, 6);
  },
  steelDoor(E, p) {
    // heavy steel door in a frame, standing open (Wastelands door)
    const w = p.w || 2.0;
    E.box('steel', -w / 2 - 0.25, 0, -0.25, -w / 2, 3.35, 0.25, S); E.box('steel', w / 2, 0, -0.25, w / 2 + 0.25, 3.35, 0.25, S);
    E.box('steel', -w / 2, 2.4, -0.25, w / 2, 3.35, 0.25);
    E.box('steel', w / 2 - 0.12, 0, 0.25, w / 2, 2.4, 0.25 + w * 0.95, S);
    for (let k = 0; k < 4; k++) E.box('dark', w / 2 - 0.14, 0.4 + k * 0.5, 0.4, w / 2 - 0.12, 0.45 + k * 0.5, 0.25 + w * 0.9);
    E.box('glow', -w / 2 - 0.2, 2.6, 0.25, -w / 2 - 0.05, 2.7, 0.26, { glow: [0.3, 1.4, 0.4] });
  },
  support(E, p) {
    // mine timber frame across the tunnel (local x across)
    const w = p.w || 3, h = p.h || 2.8;
    E.box('wood', -w / 2, 0, -0.12, -w / 2 + 0.22, h, 0.12, S); E.box('wood', w / 2 - 0.22, 0, -0.12, w / 2, h, 0.12, S);
    E.box('wood', -w / 2, h - 0.22, -0.14, w / 2, h, 0.14);
  },
  cart(E) {
    E.box('steel', -0.5, 0.25, -0.75, 0.5, 0.95, 0.75, S);
    E.box('rock', -0.42, 0.95, -0.65, 0.42, 1.12, 0.65);
    for (const z of [-0.5, 0.5]) for (const x of [-0.52, 0.48]) E.box('dark', x, 0, z - 0.15, x + 0.04, 0.3, z + 0.15);
  },
  rails(E, p) {
    const L = p.len || 8;
    for (const x of [-0.45, 0.45]) E.box('steel', x - 0.03, 0, -L / 2, x + 0.03, 0.08, L / 2);
    for (let z = -L / 2; z < L / 2; z += 0.6) E.box('wood', -0.6, 0, z, 0.6, 0.05, z + 0.18);
  },
  rubble(E, p) {
    // a heap of broken drywall / stone: deterministic tilted-ish blocks
    const n = p.n || 10, m = p.mat || 'drywall', r = p.r || 1.2;
    for (let k = 0; k < n; k++) {
      const a = k * 2.399, d = r * Math.sqrt((k + 0.5) / n), x = Math.cos(a) * d, z = Math.sin(a) * d;
      const s = 0.12 + ((k * 37) % 11) / 30, hgt = (r - d) * 0.6 + 0.06;
      E.box(m, x - s, 0, z - s * 0.7, x + s, hgt, z + s * 0.7, hgt > 0.45 ? S : {});
    }
  },
  lumber(E, p) {
    const L = p.len || 3;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5 - r; k++) E.box('wood', -L / 2 + r * 0.05, r * 0.1, -0.3 + k * 0.12 + r * 0.06, L / 2 - r * 0.05, r * 0.1 + 0.09, -0.21 + k * 0.12 + r * 0.06, r === 0 && k === 0 ? S : {});
    E.box('wood', -L / 2, 0, -0.35, L / 2, 0.38, 0.3, S);
  },
  studs(E, p) {
    // remains of a wall: stud frame (local x along the old wall), some drywall still hanging
    const L = p.len || 4, H = p.h || 3.35;
    E.box('wood', -L / 2, 0, -0.045, L / 2, 0.04, 0.045, {}); E.box('wood', -L / 2, H - 0.06, -0.045, L / 2, H - 0.02, 0.045);
    for (let x = -L / 2; x <= L / 2 + 1e-6; x += 0.4) if (((x * 10) | 0) % 7 !== 3) E.box('wood', x - 0.02, 0.04, -0.045, x + 0.02, H - 0.06, 0.045, S);
    if (p.panel) E.box('drywall', -L / 2, 1.6, 0.045, -L / 2 + 1.2, H - 0.06, 0.06);
  },
  booth(E) {
    // guard booth furniture: chair, small desk, lamp, rack
    PROPS.desk(E, { lamp: true, w: 1.2 });
    PROPS.chair({ box: (m, a, b, c, d, e, f) => E.box(m, a, b, c + 0.7, d, e, f + 0.7) }, {});
  },
  symbol(E, p) {
    // the builders' symbol as a relief panel (local z = out of the wall)
    const w = p.w || 6, h = p.h || 4;
    E.box('stone', -w / 2 - 0.2, -0.2, 0, w / 2 + 0.2, h + 0.2, 0.08);
    E.box('symbol', -w / 2, 0, 0.08, w / 2, h, 0.1, { uv: 'local', skip: 'nz,px,nx,py,ny' });
  },
  papers(E, p) {
    // a few loose sheets on the floor
    const n = p.n || 5;
    for (let k = 0; k < n; k++) {
      const a = k * 2.1 + (p.seed || 0), x = Math.cos(a) * 0.35 * (k % 3), z = Math.sin(a) * 0.3 * ((k + 1) % 3);
      const w = k % 2 ? 0.21 : 0.297, d = k % 2 ? 0.297 : 0.21;
      E.box('paper', x - w / 2, 0.002 + k * 0.0015, z - d / 2, x + w / 2, 0.0035 + k * 0.0015, z + d / 2, { skip: 'ny' });
    }
  },
  frame(E, p) {
    // a door frame standing on its own in the middle of a hallway, no wall around it
    const w = p.w || 0.9;
    E.box('whitepanel', -w / 2 - 0.08, 0, -0.06, -w / 2, 2.15, 0.06, S); E.box('whitepanel', w / 2, 0, -0.06, w / 2 + 0.08, 2.15, 0.06, S);
    E.box('whitepanel', -w / 2 - 0.08, 2.08, -0.06, w / 2 + 0.08, 2.15, 0.06);
  },
  pedestal(E) {
    E.box('stone', -0.27, 0, -0.17, 0.27, 1.05, 0.17, S);
    E.box('stone', -0.32, 0, -0.22, 0.32, 0.08, 0.22);
    E.box('stone', -0.3, 1.05, -0.2, 0.3, 1.1, 0.2);
  },
  board(E, p) {
    // chalkboard on a wall (local z = out of the wall)
    const w = p.w || 4;
    E.box('wood', -w / 2 - 0.06, 0.84, 0, w / 2 + 0.06, 2.26, 0.03);
    E.box('chalkboard', -w / 2, 0.9, 0.03, w / 2, 2.2, 0.035, { uv: 'local', skip: 'nz,px,nx,py,ny' });
    E.box('wood', -w / 2, 0.88, 0.03, w / 2, 0.92, 0.11);
  },
  skateboard(E) {
    E.box('wood', -0.1, 0.08, -0.4, 0.1, 0.1, 0.4);
    for (const z of [-0.3, 0.3]) for (const x of [-0.08, 0.08]) E.prism('plastic', x, z, 0.03, 0.03, 0, 0.06, 6, { capTop: true });
  },
  planks(E, p) {
    // wall section where drywall is broken off and the Agarite layer shows (dead end) — fragments around the hole
    const w = p.w || 3;
    for (let k = 0; k < 7; k++) {
      const x = -w / 2 + k * w / 7, h0 = 0.2 + ((k * 13) % 7) * 0.12, h1 = 2.6 + ((k * 5) % 4) * 0.15;
      E.box('drywall', x, 0, 0, x + w / 7 * (0.4 + (k % 3) * 0.2), h0, 0.03);
      E.box('drywall', x, h1, 0, x + w / 7 * (0.5 + (k % 2) * 0.3), 3.35, 0.03);
    }
  },
};

function wheel(E, x, z) {
  const R = 0.34;
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2, b = (k + 1) / 10 * Math.PI * 2;
    const y0 = R + Math.sin(a) * R, z0 = z + Math.cos(a) * R, y1 = R + Math.sin(b) * R, z1 = z + Math.cos(b) * R;
    E.box('dark', x - 0.02, Math.min(y0, y1), Math.min(z0, z1), x + 0.02, Math.max(y0, y1) + 0.03, Math.max(z0, z1) + 0.03);
  }
}
