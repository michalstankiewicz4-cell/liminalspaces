// Infinite deterministic world generator (pure data, no three.js).
// The world is a grid of CELL x CELL metre cells grouped into N x N chunks. Every chunk is generated only from
// (seed, chunk coordinates), so any client with the same seed sees exactly the same building — multiplayer only
// has to share the seed and player positions.
//
// Walls live on cell edges: east[x + z*N] is the wall between local cell (x, z) and (x+1, z), south[...] the wall
// between (x, z) and (x, z+1). The last column/row (x = N-1 / z = N-1) is the border with the next chunk; borders are
// computed from both neighbouring chunks' coordinates, so the two chunks always agree and every border has openings.
// Inside office/corridor chunks a random spanning tree guarantees that every cell is reachable.
import { hash4, rand4, mulberry32 } from '../core/util.js';

export const CELL = 4;            // metres per cell
export const N = 8;               // cells per chunk side
export const CHUNK = CELL * N;    // metres per chunk side
export const H = 3;               // wall / ceiling height
export const T = 0.2;             // wall thickness
export const LINTEL = 2.3;        // bottom of door lintels

export const THEMES = ['office', 'corridors', 'garage', 'pools'];
// Per-theme generation and lighting parameters.
export const THEME = {
  office:    { open: 2, braid: 0.22, rooms: 2, lintel: 0.55, ambient: 0.32, tint: [1.0, 0.94, 0.72], light: 'grid' },
  corridors: { open: 1, braid: 0.06, rooms: 0, lintel: 0, ambient: 0.22, tint: [1.0, 0.82, 0.62], light: 'grid' },
  garage:    { open: 6, braid: 1, rooms: 0, lintel: 0, ambient: 0.08, tint: [0.78, 0.9, 0.82], light: 'sparse' },
  pools:     { open: 5, braid: 1, rooms: 0, lintel: 0, ambient: 0.36, tint: [0.84, 0.96, 1.0], light: 'grid' },
};
// Light states: 0 none, 1 on, 2 flickering, 3 dead.
export const LIGHT_POWER = [0, 1, 0.65, 0];

// Oddities: rare objects worth finding. solid = [width, depth] collision footprint (axis aligned, before rotation).
export const ODDITIES = {
  chair: { themes: ['office', 'corridors', 'pools'] },
  vending: { themes: ['office', 'garage'], solid: [1.0, 0.8] },
  cooler: { themes: ['office'] },
  plant: { themes: ['office', 'corridors'] },
  trolley: { themes: ['corridors'], solid: [0.7, 1.1] },
  painting: { themes: ['corridors', 'office'], wall: true },
  cone: { themes: ['garage'] },
  car: { themes: ['garage'], solid: [1.8, 4.0] },
  ball: { themes: ['pools'] },
  buoy: { themes: ['pools'], wall: true },
  door: { themes: ['office', 'corridors', 'garage', 'pools'], solid: [1.2, 0.2], rare: true },
  exit: { themes: ['office', 'corridors', 'garage'], wall: true, rare: true },
  phone: { themes: ['office', 'corridors'], wall: true },
  tv: { themes: ['office', 'corridors', 'pools'] },
};
export const ODDITY_KINDS = Object.keys(ODDITIES);

const idx = (x, z) => x + z * N;
const floorDiv = (a, b) => Math.floor(a / b);

export function createGenerator(seed) {
  seed = seed | 0;
  const cache = new Map();
  const MAX_CACHE = 600;

  /* ---- themes: staggered 3x3-chunk regions with weighted random themes; the spawn region is always offices ---- */
  function themeOf(i, j) {
    const rj = floorDiv(j, 3);
    const shift = Math.floor(rand4(seed, rj, 0, 12) * 3);
    const ri = floorDiv(i + shift, 3);
    if (ri === floorDiv(shift, 3) && rj === 0) return 'office';
    const r = rand4(seed, ri, rj, 11);
    return r < 0.4 ? 'office' : r < 0.62 ? 'corridors' : r < 0.82 ? 'garage' : 'pools';
  }

  // Border between chunk (i, j) and its east (axis 0) or south (axis 1) neighbour: 1 = wall, 0 = opening.
  function border(i, j, axis) {
    const a = THEME[themeOf(i, j)], b = THEME[themeOf(axis ? i : i + 1, axis ? j + 1 : j)];
    const open = Math.max(1, Math.min(a.open, b.open));
    const rnd = mulberry32(hash4(seed, i, j, 30 + axis));
    const out = new Uint8Array(N).fill(1);
    let made = 0, guard = 0;
    while (made < open && guard++ < 64) {
      const k = Math.floor(rnd() * N);
      if (out[k]) { out[k] = 0; made++; }
    }
    return out;
  }

  function lightOf(theme, cx, cz) {
    const r = rand4(seed, cx, cz, 21);
    if (THEME[theme].light === 'sparse') {
      if ((cx & 1) || (cz & 1)) return 0;
      return r < 0.45 ? 3 : r < 0.6 ? 2 : 1;
    }
    if (theme === 'office') return r < 0.08 ? 3 : r < 0.14 ? 2 : 1;
    if (theme === 'corridors') return r < 0.12 ? 3 : r < 0.18 ? 2 : 1;
    return r < 0.04 ? 3 : r < 0.07 ? 2 : 1;
  }

  /* ---- one chunk ---- */
  function build(i, j) {
    const theme = themeOf(i, j), P = THEME[theme];
    const rnd = mulberry32(hash4(seed, i, j, 1));
    const east = new Uint8Array(N * N), south = new Uint8Array(N * N);
    const lintE = new Uint8Array(N * N), lintS = new Uint8Array(N * N);
    const pillars = [];      // corner coordinates (local, 0..N) where a pillar stands
    const doors = [];        // { x, z, axis, side } decorative doors on wall faces
    const water = new Uint8Array(N * N);
    const lights = new Uint8Array(N * N);

    if (theme === 'office' || theme === 'corridors') {
      // all internal walls up, then carve a spanning tree (randomised DFS; corridors prefer straight runs)
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { if (x < N - 1) east[idx(x, z)] = 1; if (z < N - 1) south[idx(x, z)] = 1; }
      const seen = new Uint8Array(N * N);
      const stack = [[Math.floor(rnd() * N), Math.floor(rnd() * N), -1]];
      seen[idx(stack[0][0], stack[0][1])] = 1;
      const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const [x, z, last] = top;
        const opts = [];
        for (let d = 0; d < 4; d++) {
          const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
          if (nx >= 0 && nz >= 0 && nx < N && nz < N && !seen[idx(nx, nz)]) opts.push(d);
        }
        if (!opts.length) { stack.pop(); continue; }
        let d = opts[Math.floor(rnd() * opts.length)];
        if (theme === 'corridors' && opts.includes(last) && rnd() < 0.8) d = last;
        const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
        if (d === 0) { east[idx(x, z)] = 0; lintE[idx(x, z)] = 1; }
        else if (d === 1) { east[idx(nx, nz)] = 0; lintE[idx(nx, nz)] = 1; }
        else if (d === 2) { south[idx(x, z)] = 0; lintS[idx(x, z)] = 1; }
        else { south[idx(nx, nz)] = 0; lintS[idx(nx, nz)] = 1; }
        seen[idx(nx, nz)] = 1;
        stack.push([nx, nz, d]);
      }
      // braid: knock out extra walls so it feels like rooms, not a maze
      for (let k = 0; k < N * N; k++) {
        if (east[k] && k % N < N - 1 && rnd() < P.braid) { east[k] = 0; lintE[k] = rnd() < 0.5 ? 1 : 0; }
        if (south[k] && Math.floor(k / N) < N - 1 && rnd() < P.braid) { south[k] = 0; lintS[k] = rnd() < 0.5 ? 1 : 0; }
      }
      // rooms: open rectangles
      for (let r = 0; r < P.rooms; r++) {
        const w = 2 + Math.floor(rnd() * 3), d = 2 + Math.floor(rnd() * 3);
        const x0 = Math.floor(rnd() * (N - w)), z0 = Math.floor(rnd() * (N - d));
        for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
          if (x < x0 + w - 1) { east[idx(x, z)] = 0; lintE[idx(x, z)] = 0; }
          if (z < z0 + d - 1) { south[idx(x, z)] = 0; lintS[idx(x, z)] = 0; }
        }
      }
      if (P.lintel < 1) for (let k = 0; k < N * N; k++) { if (rnd() > P.lintel) lintE[k] = 0; if (rnd() > P.lintel) lintS[k] = 0; }
    } else {
      // open halls: a few free-standing wall pieces and pillars
      const pWall = theme === 'garage' ? 0.05 : 0.1;
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        if (x < N - 1 && rnd() < pWall) east[idx(x, z)] = 1;
        if (z < N - 1 && rnd() < pWall) south[idx(x, z)] = 1;
      }
      for (let z = 1; z < N; z++) for (let x = 1; x < N; x++) {
        if (theme === 'garage' ? (x % 2 === 0 && z % 2 === 0) : rnd() < 0.18) pillars.push([x, z]);
      }
    }

    // borders (east column and south row)
    const bx = border(i, j, 0), bz = border(i, j, 1);
    for (let k = 0; k < N; k++) { east[idx(N - 1, k)] = bx[k]; south[idx(k, N - 1)] = bz[k]; }

    // water (pools): smooth blobs from a coarse hash
    if (theme === 'pools') {
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const cx = i * N + x, cz = j * N + z;
        const v = rand4(seed, cx >> 1, cz >> 1, 40) * 0.7 + rand4(seed, cx, cz, 41) * 0.3;
        water[idx(x, z)] = v > 0.5 ? 1 : 0;
      }
    }

    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) lights[idx(x, z)] = lightOf(theme, i * N + x, j * N + z);

    // decorative doors on wall faces (hotel corridors)
    if (theme === 'corridors') {
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const k = idx(x, z);
        if (east[k] && rnd() < 0.35) doors.push({ x, z, axis: 0, side: rnd() < 0.5 ? -1 : 1 });
        if (south[k] && rnd() < 0.35) doors.push({ x, z, axis: 1, side: rnd() < 0.5 ? -1 : 1 });
      }
    }

    // one oddity in some chunks
    let oddity = null;
    if (rnd() < 0.42) {
      const pool = ODDITY_KINDS.filter((k) => ODDITIES[k].themes.includes(theme) && (!ODDITIES[k].rare || rnd() < 0.35));
      const kind = pool[Math.floor(rnd() * pool.length)];
      let x = Math.floor(rnd() * N), z = Math.floor(rnd() * N);
      if (i === 0 && j === 0 && x === SPAWN_CELL && z === SPAWN_CELL) x = (x + 2) % N;
      oddity = { kind, x, z, rot: Math.floor(rnd() * 4), id: `${i},${j}` };
      if (ODDITIES[kind].wall) {
        // stick it to a wall of that cell if there is one
        const walls = [];
        if (east[idx(x, z)]) walls.push(0);
        if (z < N && south[idx(x, z)]) walls.push(1);
        oddity.wallSide = walls.length ? walls[Math.floor(rnd() * walls.length)] : -1;
      }
    }

    return { i, j, theme, east, south, lintE, lintS, pillars, doors, water, lights, oddity };
  }

  function chunk(i, j) {
    const key = i + ',' + j;
    let c = cache.get(key);
    if (c) { cache.delete(key); cache.set(key, c); return c; }   // LRU touch
    c = build(i, j);
    cache.set(key, c);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return c;
  }

  /* ---- global cell queries ---- */
  const at = (cx, cz) => { const i = floorDiv(cx, N), j = floorDiv(cz, N); return [chunk(i, j), cx - i * N, cz - j * N]; };
  function wallE(cx, cz) { const [c, x, z] = at(cx, cz); return c.east[idx(x, z)]; }
  function wallS(cx, cz) { const [c, x, z] = at(cx, cz); return c.south[idx(x, z)]; }
  function lightAt(cx, cz) { const [c, x, z] = at(cx, cz); return c.lights[idx(x, z)]; }
  function themeAtCell(cx, cz) { return themeOf(floorDiv(cx, N), floorDiv(cz, N)); }
  function waterAt(cx, cz) { const [c, x, z] = at(cx, cz); return c.water[idx(x, z)]; }
  const cellOf = (x) => Math.floor(x / CELL);

  // Axis-aligned solid boxes [minX, minZ, maxX, maxZ] around world point (x, z) (walls, pillars, solid oddities).
  function solidsNear(x, z, out = []) {
    out.length = 0;
    const cx = cellOf(x), cz = cellOf(z), h = T / 2;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx, gz = cz + dz;
      const x0 = gx * CELL, z0 = gz * CELL;
      if (wallE(gx, gz)) out.push([x0 + CELL - h, z0 - h, x0 + CELL + h, z0 + CELL + h]);
      if (wallS(gx, gz)) out.push([x0 - h, z0 + CELL - h, x0 + CELL + h, z0 + CELL + h]);
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = floorDiv(cx, N) + di, j = floorDiv(cz, N) + dj;
      if (Math.abs((i + 0.5) * CHUNK - x) > CHUNK || Math.abs((j + 0.5) * CHUNK - z) > CHUNK) continue;
      const c = chunk(i, j);
      for (const [px, pz] of c.pillars) {
        const wx = i * CHUNK + px * CELL, wz = j * CHUNK + pz * CELL;
        if (Math.abs(wx - x) < 3 && Math.abs(wz - z) < 3) out.push([wx - PILLAR / 2, wz - PILLAR / 2, wx + PILLAR / 2, wz + PILLAR / 2]);
      }
      const o = c.oddity, def = o && ODDITIES[o.kind];
      if (def && def.solid) {
        const p = oddityPos(c), [w, d] = o.rot % 2 ? [def.solid[1], def.solid[0]] : def.solid;
        if (Math.abs(p.x - x) < 5 && Math.abs(p.z - z) < 5) out.push([p.x - w / 2, p.z - d / 2, p.x + w / 2, p.z + d / 2]);
      }
    }
    return out;
  }

  // World position (and facing angle) of a chunk's oddity. Wall-mounted ones sit on the cell's east/south wall.
  function oddityPos(c) {
    const o = c.oddity;
    const x0 = c.i * CHUNK + o.x * CELL, z0 = c.j * CHUNK + o.z * CELL;
    if (o.wallSide === 0) return { x: x0 + CELL - T / 2 - 0.02, z: z0 + CELL / 2, y: 1.5, rot: -Math.PI / 2 };
    if (o.wallSide === 1) return { x: x0 + CELL / 2, z: z0 + CELL - T / 2 - 0.02, y: 1.5, rot: Math.PI };
    return { x: x0 + CELL / 2, z: z0 + CELL / 2, y: 0, rot: o.rot * Math.PI / 2 };
  }

  const spawn = { x: (SPAWN_CELL + 0.5) * CELL, z: (SPAWN_CELL + 0.5) * CELL };

  return { seed, themeOf, chunk, wallE, wallS, lightAt, themeAtCell, waterAt, cellOf, solidsNear, oddityPos, spawn };
}

export const PILLAR = 0.7;
export const SPAWN_CELL = 4;
