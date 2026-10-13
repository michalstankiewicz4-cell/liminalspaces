// Turns generated chunk data (gen.js) into meshes: walls, lintels, floors, ceilings, light panels, pillars,
// doors, water and oddities. Lighting is baked into vertex colours from the ceiling lights of nearby cells.
import { MeshBuilder } from './mesh.js';
import { CELL, N, CHUNK, H, T, LINTEL, PILLAR, THEME, LIGHT_POWER } from './gen.js';
import { THEME_SURFACES } from './textures.js';
import { buildOddity } from './oddities.js';

const M = 2;                       // light grid margin (cells) around the chunk
const G = N + 2 * M;
const R2 = 2.4 * 2.4;              // light falloff scale (squared)

// Light/ambient/tint field for a chunk and its surroundings, sampled from the generator.
function lightGrid(gen, c) {
  const L = new Float32Array(G * G), A = new Float32Array(G * G), Tn = new Float32Array(G * G * 3);
  for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
    const cx = c.i * N + x - M, cz = c.j * N + z - M, k = x + z * G;
    const th = THEME[gen.themeAtCell(cx, cz)];
    L[k] = LIGHT_POWER[gen.lightAt(cx, cz)];
    A[k] = th.ambient;
    Tn[k * 3] = th.tint[0]; Tn[k * 3 + 1] = th.tint[1]; Tn[k * 3 + 2] = th.tint[2];
  }
  return { L, A, Tn, ox: c.i * CHUNK - M * CELL, oz: c.j * CHUNK - M * CELL };
}

// Baked brightness at a world point: bilinear ambient + soft falloff from ceiling lights in a 5x5 cell window.
function makeShade(grid) {
  const { L, A, Tn, ox, oz } = grid;
  const at = (x, z) => Math.max(0, Math.min(G - 1, x)) + Math.max(0, Math.min(G - 1, z)) * G;
  return (x, y, z, mul = 1) => {
    const fx = (x - ox) / CELL - 0.5, fz = (z - oz) / CELL - 0.5;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const k00 = at(ix, iz), k10 = at(ix + 1, iz), k01 = at(ix, iz + 1), k11 = at(ix + 1, iz + 1);
    const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
    let v = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
    const cx = Math.round(fx), cz = Math.round(fz);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const gx = cx + dx, gz = cz + dz;
      if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
      const p = L[gx + gz * G];
      if (!p) continue;
      const lx = ox + (gx + 0.5) * CELL, lz = oz + (gz + 0.5) * CELL;
      const d2 = (lx - x) ** 2 + (lz - z) ** 2 + (H - y) ** 2 * 0.6;
      v += p * 0.95 / (1 + d2 / R2);
    }
    v = Math.min(1.35, v * mul);
    const r = Tn[k00 * 3] * w00 + Tn[k10 * 3] * w10 + Tn[k01 * 3] * w01 + Tn[k11 * 3] * w11;
    const g = Tn[k00 * 3 + 1] * w00 + Tn[k10 * 3 + 1] * w10 + Tn[k01 * 3 + 1] * w01 + Tn[k11 * 3 + 1] * w11;
    const b = Tn[k00 * 3 + 2] * w00 + Tn[k10 * 3 + 2] * w10 + Tn[k01 * 3 + 2] * w01 + Tn[k11 * 3 + 2] * w11;
    return [r * v, g * v, b * v];
  };
}

// Panel size [w, d] and drop below the ceiling for each theme.
const PANEL = { office: [1.2, 0.6, 0], corridors: [0.5, 0.5, 0], garage: [1.5, 0.18, 0.12], pools: [0.8, 0.8, 0] };
const PANEL_TINT = { office: [1, 0.98, 0.86], corridors: [1, 0.86, 0.6], garage: [0.86, 1, 0.92], pools: [0.92, 1, 1] };

export function buildChunk(gen, c, materials) {
  const mb = new MeshBuilder();
  const grid = lightGrid(gen, c);
  const shade = makeShade(grid);
  const S = THEME_SURFACES[c.theme];
  const x0 = c.i * CHUNK, z0 = c.j * CHUNK, h = T / 2;
  const wallName = c.theme + ':wall', floorName = c.theme + ':floor', ceilName = c.theme + ':ceil';
  // walls a bit darker at the bottom, ceilings a bit darker overall
  const wallCol = (x, y, z) => shade(x, y, z, 0.78 + 0.22 * (y / H));
  const wallOpt = { scale: S.wall[1], seg: 1.4, col: wallCol, skip: new Set(['py', 'ny']) };
  const lintOpt = { scale: S.wall[1], seg: 1.4, col: wallCol, skip: new Set(['py']) };

  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = x + z * N, wx = x0 + x * CELL, wz = z0 + z * CELL;
    // floor and ceiling of the cell
    mb.face(floorName, [wx, 0, wz], [CELL, 0, 0], [0, 0, CELL], [0, 1, 0], 3, 3, (px, py, pz) => [px / S.floor[1], pz / S.floor[1]], (px, py, pz) => shade(px, py, pz, 0.92));
    mb.face(ceilName, [wx, H, wz], [CELL, 0, 0], [0, 0, CELL], [0, -1, 0], 3, 3, (px, py, pz) => [px / S.ceil[1], pz / S.ceil[1]], (px, py, pz) => shade(px, py, pz, 0.72));
    // walls on the east / south edge (ends overlap by half a thickness so corners close)
    if (c.east[k]) mb.box(wallName, wx + CELL - h, 0, wz - h, wx + CELL + h, H, wz + CELL + h, wallOpt);
    else if (c.lintE[k]) mb.box(wallName, wx + CELL - h, LINTEL, wz + h, wx + CELL + h, H, wz + CELL - h, lintOpt);
    if (c.south[k]) mb.box(wallName, wx - h, 0, wz + CELL - h, wx + CELL + h, H, wz + CELL + h, wallOpt);
    else if (c.lintS[k]) mb.box(wallName, wx + h, LINTEL, wz + CELL - h, wx + CELL - h, H, wz + CELL + h, lintOpt);
    // light panel
    const ls = c.lights[k];
    if (ls) {
      const [pw, pd, drop] = PANEL[c.theme], cx = wx + CELL / 2, cz = wz + CELL / 2;
      const name = ls === 1 ? 'lightOn' : ls === 2 ? 'lightFlicker' : 'lightDead';
      const tint = PANEL_TINT[c.theme];
      const col = ls === 3 ? () => [0.35, 0.34, 0.3] : () => tint;
      mb.box(name, cx - pw / 2, H - 0.04 - drop, cz - pd / 2, cx + pw / 2, H - drop, cz + pd / 2, { uv: 'local', col, skip: new Set(['py']) });
      if (drop) mb.box('prop', cx - 0.02, H - drop, cz - 0.02, cx + 0.02, H, cz + 0.02, { uv: 'local', col: () => [0.2, 0.2, 0.2] });
    }
    // water: a translucent sheet at knee height
    if (c.water[k]) mb.face('water', [wx, 0.32, wz], [CELL, 0, 0], [0, 0, CELL], [0, 1, 0], 1, 1, (px, py, pz) => [px / 2, pz / 2], (px, py, pz) => shade(px, 1.5, pz));
  }

  for (const [px, pz] of c.pillars) {
    const cx = x0 + px * CELL, cz = z0 + pz * CELL, p = PILLAR / 2;
    mb.box(wallName, cx - p, 0, cz - p, cx + p, H, cz + p, { scale: S.wall[1], seg: 1.5, col: wallCol, skip: new Set(['py', 'ny']) });
  }

  // decorative doors on wall faces (corridors)
  for (const d of c.doors) {
    const wx = x0 + d.x * CELL, wz = z0 + d.z * CELL, col = (x, y, z) => shade(x, y, z, 0.9);
    const opt = { uv: 'local', col, skip: new Set(['ny']) };
    const frame = { uv: 'local', col: (x, y, z) => shade(x, y, z, 0.55).map((v, i) => v * [0.7, 0.55, 0.4][i]), skip: new Set(['ny']) };
    const span = (f, a, b) => [Math.min(f + d.side * a, f + d.side * b), Math.max(f + d.side * a, f + d.side * b)];
    if (d.axis === 0) {
      const fx = wx + CELL + d.side * h, cz = wz + CELL / 2;
      const [f0, f1] = span(fx, 0, 0.06), [d0, d1] = span(fx, 0.03, 0.1);
      mb.box('prop', f0, 0, cz - 0.6, f1, 2.25, cz + 0.6, frame);
      mb.box('door', d0, 0, cz - 0.5, d1, 2.15, cz + 0.5, opt);
    } else {
      const fz = wz + CELL + d.side * h, cx = wx + CELL / 2;
      const [f0, f1] = span(fz, 0, 0.06), [d0, d1] = span(fz, 0.03, 0.1);
      mb.box('prop', cx - 0.6, 0, f0, cx + 0.6, 2.25, f1, frame);
      mb.box('door', cx - 0.5, 0, d0, cx + 0.5, 2.15, d1, opt);
    }
  }

  if (c.oddity) buildOddity(mb, c.oddity.kind, gen.oddityPos(c), shade);

  const group = mb.build(materials);
  return group;
}
