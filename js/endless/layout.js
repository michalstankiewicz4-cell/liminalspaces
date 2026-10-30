// The endless world on the shared cell engine (story/grid.js + story/mesher.js): every 32 m chunk is painted on
// demand from the deterministic generator (world/gen.js: themes, walls on 4 m cell edges, door lintels, pillars,
// pools, ceiling lights, decorative doors, oddities). One generator chunk = one engine chunk (both 32 m, same origin),
// so a chunk paints only its own cells: walls take the last 0.5 m strip of the cell they bound on the east/south,
// lattice corners touched by a wall are filled, pillars are 1 m squares, pools are sunk 0.4 m with a water surface.
import { CS, F } from '../story/grid.js';
import { M } from '../story/textures.js';
import { createGenerator, CELL, N, CHUNK, LINTEL, ODDITIES } from '../world/gen.js';

export const H = 3;                 // ceiling height of the endless building
const WALL = CS;                    // wall strip thickness (one cell)
const POOL = -0.4, WATER = -0.08;   // pool floor and water surface

/* ---- zones (one per theme): light, fog, materials, ceiling lamps ---- */
export const ZONES = [
  { key: 'none', amb: 0.05, tint: [1, 1, 1], fog: [0.05, 0.045, 0.03], map: '#333' },
  { key: 'office', amb: 0.1, tint: [1.0, 0.94, 0.72], fog: [0.3, 0.25, 0.12], far: 42, map: '#c8b46a', fm: 'carpet', wm: 'wallpaper', cm: 'ceiling', skirt: true,
    lamp: { fixture: 'panel', col: [1.0, 0.95, 0.78], p: 0.62 } },
  { key: 'corridors', amb: 0.06, tint: [1.0, 0.82, 0.62], fog: [0.12, 0.06, 0.035], far: 36, map: '#a04a3a', fm: 'hotelCarpet', wm: 'hotelWall', cm: 'plaster', skirt: true,
    lamp: { fixture: 'bulb', col: [1.0, 0.82, 0.55], p: 0.55 } },
  { key: 'garage', amb: 0.02, tint: [0.78, 0.9, 0.82], fog: [0.025, 0.03, 0.026], far: 34, map: '#7a7c78', fm: 'garageFloor', wm: 'concrete', cm: 'concrete',
    lamp: { fixture: 'tube', col: [0.86, 1.0, 0.92], p: 0.7 } },
  { key: 'pools', amb: 0.09, tint: [0.84, 0.96, 1.0], fog: [0.3, 0.38, 0.4], far: 44, map: '#8ac0d0', fm: 'poolTile', wm: 'poolTile', cm: 'poolTile',
    lamp: { fixture: 'panel', col: [0.92, 1.0, 1.0], p: 0.6 } },
];
const ZI = Object.fromEntries(ZONES.map((z, i) => [z.key, i]));
for (const z of ZONES) for (const k of ['fm', 'wm', 'cm']) z[k + 'i'] = z[k] ? M[z[k]] : 0;

// World position and facing of a generator chunk's oddity (wall-mounted ones sit on the face of their cell's wall).
export function oddityPos(c) {
  const o = c.oddity, x0 = c.i * CHUNK + o.x * CELL, z0 = c.j * CHUNK + o.z * CELL;
  const pool = c.water[o.x + o.z * N] ? POOL : 0;
  if (o.wallSide === 0) return { x: x0 + CELL - WALL - 0.01, z: z0 + CELL / 2, y: pool, wall: true, rot: -Math.PI / 2 };
  if (o.wallSide === 1) return { x: x0 + CELL / 2, z: z0 + CELL - WALL - 0.01, y: pool, wall: true, rot: Math.PI };
  return { x: x0 + CELL / 2, z: z0 + CELL / 2, y: pool, wall: false, rot: o.rot * Math.PI / 2 };
}

// Sets the grid up to paint the endless world of `seed` chunk by chunk. Returns what the engine needs.
export function buildEndless(grid, seed) {
  const gen = createGenerator(seed);

  grid.lazyChunk = (ci, cj) => {
    const c = gen.chunk(ci, cj), zone = ZI[c.theme], zd = ZONES[zone];
    const X = ci * CHUNK, Z = cj * CHUNK;
    const base = { zone, floor: 0, ceil: H, fm: zd.fmi, wm: zd.wmi, cm: zd.cmi, flags: zd.skirt ? F.SKIRT : 0 };
    grid.paint(X, Z, X + CHUNK, Z + CHUNK, base);
    // pools: sunk floor (skirting would float above the water)
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!c.water[x + z * N]) continue;
      const x0 = X + x * CELL, z0 = Z + z * CELL;
      grid.paint(x0, z0, x0 + CELL, z0 + CELL, { ...base, floor: POOL, flags: 0 });
    }
    // door lintels (from 2.3 m to the ceiling) on openings, then the walls
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const k = x + z * N, x0 = X + x * CELL, z0 = Z + z * CELL;
      if (!c.east[k] && c.lintE[k]) grid.paint(x0 + CELL - WALL, z0, x0 + CELL, z0 + CELL, { ceil: LINTEL, where: (px, pz) => grid.isOpen(px, pz) });
      if (!c.south[k] && c.lintS[k]) grid.paint(x0, z0 + CELL - WALL, x0 + CELL, z0 + CELL, { ceil: LINTEL, where: (px, pz) => grid.isOpen(px, pz) });
    }
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const k = x + z * N, x0 = X + x * CELL, z0 = Z + z * CELL;
      if (c.east[k]) grid.paint(x0 + CELL - WALL, z0, x0 + CELL, z0 + CELL, { open: false, zone });
      if (c.south[k]) grid.paint(x0, z0 + CELL - WALL, x0 + CELL, z0 + CELL, { open: false, zone });
    }
    // lattice corners touched by any wall: fill the cell just north-west of the corner (no notches at L and T joints)
    for (let gz = 1; gz <= N; gz++) for (let gx = 1; gx <= N; gx++) {
      const cx = ci * N + gx, cz = cj * N + gz;
      if (gen.wallE(cx - 1, cz - 1) || gen.wallE(cx - 1, cz) || gen.wallS(cx - 1, cz - 1) || gen.wallS(cx, cz - 1)) {
        const px = X + gx * CELL, pz = Z + gz * CELL;
        grid.paint(px - WALL, pz - WALL, px, pz, { open: false, zone });
      }
    }
    // pillars (garage, pools): 1 m squares on lattice corners
    for (const [px, pz] of c.pillars) { const wx = X + px * CELL, wz = Z + pz * CELL; grid.paint(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5, { open: false, zone }); }
    // water surface over the pools
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (c.water[x + z * N]) grid.addProp({ kind: 'poolWater', x: X + (x + 0.5) * CELL, z: Z + (z + 0.5) * CELL, y: WATER, w: CELL, d: CELL });
    // ceiling lights: one per cell centre (on / flickering / dead), the fixture by theme
    const L = zd.lamp;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const s = c.lights[x + z * N];
      if (!s) continue;
      const lx = X + (x + 0.5) * CELL, lz = Z + (z + 0.5) * CELL;
      if (!grid.isOpen(lx, lz)) continue;
      const dead = s === 3, flicker = s === 2;
      grid.addLight({ x: lx, z: lz, y: H - 0.15, ceil: H, r: L.col[0], g: L.col[1], b: L.col[2], p: dead ? 0 : L.p * (flicker ? 0.65 : 1), fixture: L.fixture, dead, flicker });
    }
    // decorative doors on wall faces (hotel corridors)
    // (a door on the far face of the chunk's east/south border wall would belong to the next chunk: left out)
    const inside = (p) => p.x >= X && p.x < X + CHUNK && p.z >= Z && p.z < Z + CHUNK;
    for (const d of c.doors) {
      const x0 = X + d.x * CELL, z0 = Z + d.z * CELL;
      const p = d.axis === 0
        ? { kind: 'doorClosed', x: d.side < 0 ? x0 + CELL - WALL : x0 + CELL, z: z0 + CELL / 2, rot: d.side < 0 ? -Math.PI / 2 : Math.PI / 2, mat: 'wood' }
        : { kind: 'doorClosed', x: x0 + CELL / 2, z: d.side < 0 ? z0 + CELL - WALL : z0 + CELL, rot: d.side < 0 ? Math.PI : 0, mat: 'wood' };
      if (inside(p)) grid.addProp(p);
    }
    // the oddity of this chunk
    if (c.oddity) { const p = oddityPos(c); grid.addProp({ kind: 'oddity', odd: c.oddity.kind, ...p }); }
  };

  return {
    gen, zones: ZONES, beams: [], gates: [], emitters: [], water: [],
    starts: { spawn: { x: gen.spawn.x, z: gen.spawn.z, yaw: 0 } },
  };
}

export { ODDITIES };
