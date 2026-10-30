// Sparse multi-level cell grid for the Great Path world.
// The world is a plane of CS x CS metre cells grouped into CN x CN chunks. Every cell is either closed (solid rock /
// wall mass) or open; an open cell has its own floor height and ceiling height, so steps, drops, podiums, windows,
// lintels, tunnels and hanging blocks all come out of the same data. Walls, risers and headers are generated from
// differences between neighbouring cells (see mesher.js). Chunks that were never painted are closed.
export const CS = 0.5;            // cell size (m)
export const CN = 64;             // cells per chunk side
export const CW = CS * CN;        // chunk size (m) = 32
export const H = 3.35;            // standard ceiling height: 11 ft

// Cell flags
// NOFLOOR: walkable but no floor drawn (glass over water, the grate over the abyss — drawn by water.js / props)
// OUT: open to the sky (no ceiling; walls only as a roof edge above lower neighbours) — the ocean view, stair holes
export const F = { SKY: 1, SKIRT: 2, NOLAMP: 4, LAMP: 8, CHALK: 16, OUT: 32, NOFLOOR: 64 };

class Chunk {
  constructor(ci, cj) {
    const n = CN * CN;
    this.ci = ci; this.cj = cj;
    this.open = new Uint8Array(n);
    this.floor = new Float32Array(n);
    this.ceil = new Float32Array(n).fill(H);
    this.zone = new Uint8Array(n);
    this.fm = new Uint8Array(n); this.wm = new Uint8Array(n); this.cm = new Uint8Array(n); this.sm = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.seen = new Uint8Array(n);
    this.props = [];     // { kind, x, y, z, rot, ... } built by props.js
    this.lights = [];    // { x, y, z, r, g, b, p } baked lights
    this.signs = [];     // paper notes
    this.solids = [];    // [x0,y0,z0,x1,y1,z1] prop colliders
    this.version = 0;    // bumped on every paint (mesh / map rebuild)
  }
}

export function createGrid() {
  const chunks = new Map();
  let lazy = null;                 // (ci, grid) => void: paints infinite parts column by column
  let lazyChunk = null;            // (ci, cj, grid) => void: paints a whole world chunk by chunk (the endless world)
  const lazyDone = new Set();
  const key = (ci, cj) => ci * 100003 + cj;

  function chunk(ci, cj, create) {
    let c = chunks.get(key(ci, cj));
    if (!c && create) { c = new Chunk(ci, cj); chunks.set(key(ci, cj), c); }
    return c || null;
  }
  // Runs the lazy painter for a chunk column (or, in chunk mode, for chunk (ci, cj)) once.
  let painting = false;
  function ensure(ci, cj = 0) {
    if (painting) return;
    if (lazyChunk) {
      const k = key(ci, cj);
      if (lazyDone.has(k)) return;
      lazyDone.add(k);
      painting = true;
      try { lazyChunk(ci, cj, api); } finally { painting = false; }
      return;
    }
    if (!lazy || lazyDone.has(ci)) return;
    lazyDone.add(ci);
    painting = true;                 // queries made while painting never trigger more lazy painting
    try { lazy(ci, api); } finally { painting = false; }
  }
  // The chunks around (ci, cj) painted (meshing and lighting look one chunk past the edge).
  function ensureAround(ci, cj) { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) ensure(ci + a, cj + b); }
  const fdiv = (a, b) => Math.floor(a / b);

  // Global integer cell -> [chunk, index] (chunk may be null = closed).
  function at(gx, gz) {
    const ci = fdiv(gx, CN), cj = fdiv(gz, CN);
    if (!painting && !lazyChunk) ensure(ci);
    let c = chunk(ci, cj, false);
    if (!c && !painting && lazyChunk) { ensure(ci, cj); c = chunk(ci, cj, false); }     // endless: every painted chunk exists
    return c ? [c, (gx - ci * CN) + (gz - cj * CN) * CN] : [null, 0];
  }

  /* ---- painting ---- */
  // Paints every cell whose centre lies inside [x0,x1) x [z0,z1). o: { open (default true), floor, ceil, zone, fm, wm, cm, sm,
  // flags (replace), addFlags, clearFlags, where(x, z) -> bool }. Undefined fields keep their value for open=false only.
  function paint(x0, z0, x1, z1, o = {}) {
    const gx0 = Math.round(Math.min(x0, x1) / CS), gx1 = Math.round(Math.max(x0, x1) / CS);
    const gz0 = Math.round(Math.min(z0, z1) / CS), gz1 = Math.round(Math.max(z0, z1) / CS);
    const open = o.open !== false;
    for (let gz = gz0; gz < gz1; gz++) for (let gx = gx0; gx < gx1; gx++) {
      if (o.where && !o.where((gx + 0.5) * CS, (gz + 0.5) * CS)) continue;
      const ci = fdiv(gx, CN), cj = fdiv(gz, CN);
      const c = chunk(ci, cj, true), k = (gx - ci * CN) + (gz - cj * CN) * CN;
      c.version++;
      if (!open) { c.open[k] = 0; if (o.zone !== undefined) c.zone[k] = o.zone; continue; }
      c.open[k] = 1;
      if (o.floor !== undefined) c.floor[k] = o.floor;
      if (o.ceil !== undefined) c.ceil[k] = o.ceil;
      if (o.zone !== undefined) c.zone[k] = o.zone;
      if (o.fm !== undefined) c.fm[k] = o.fm;
      if (o.wm !== undefined) c.wm[k] = o.wm;
      if (o.cm !== undefined) c.cm[k] = o.cm;
      if (o.sm !== undefined) c.sm[k] = o.sm;
      if (o.flags !== undefined) c.flags[k] = o.flags;
      if (o.addFlags) c.flags[k] |= o.addFlags;
      if (o.clearFlags) c.flags[k] &= ~o.clearFlags;
    }
  }
  // Adds an object (prop / light / sign) to the chunk that contains (x, z).
  function chunkAt(x, z) { return chunk(fdiv(Math.floor(x / CS), CN), fdiv(Math.floor(z / CS), CN), true); }
  const addProp = (p) => { const c = chunkAt(p.x, p.z); c.props.push(p); c.version++; return p; };
  const addLight = (l) => { chunkAt(l.x, l.z).lights.push(l); return l; };
  const addSign = (s) => { const c = chunkAt(s.x, s.z); c.signs.push(s); return s; };
  const addSolid = (b) => { chunkAt((b[0] + b[3]) / 2, (b[2] + b[5]) / 2).solids.push(b); };

  /* ---- queries (world metres) ---- */
  const gi = (x) => Math.floor(x / CS);
  function cell(x, z) { return at(gi(x), gi(z)); }
  function isOpen(x, z) { const [c, k] = cell(x, z); return !!(c && c.open[k]); }
  function floorAt(x, z) { const [c, k] = cell(x, z); return c && c.open[k] ? c.floor[k] : Infinity; }
  function ceilAt(x, z) { const [c, k] = cell(x, z); return c && c.open[k] ? c.ceil[k] : -Infinity; }
  function zoneAt(x, z) { const [c, k] = cell(x, z); return c ? c.zone[k] : 0; }
  function flagsAt(x, z) { const [c, k] = cell(x, z); return c && c.open[k] ? c.flags[k] : 0; }

  // Prop colliders overlapping a horizontal box (x0,z0)-(x1,z1).
  function solidsIn(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const ci0 = fdiv(gi(x0), CN), ci1 = fdiv(gi(x1), CN), cj0 = fdiv(gi(z0), CN), cj1 = fdiv(gi(z1), CN);
    for (let cj = cj0 - 1; cj <= cj1 + 1; cj++) for (let ci = ci0 - 1; ci <= ci1 + 1; ci++) {
      const c = chunk(ci, cj, false);
      if (!c) continue;
      for (const b of c.solids) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1) out.push(b);
    }
    return out;
  }

  const api = {
    chunks, chunk, at, ensure, ensureAround, paint, addProp, addLight, addSign, addSolid,
    isOpen, floorAt, ceilAt, zoneAt, flagsAt, solidsIn, gi,
    set lazy(fn) { lazy = fn; },
    set lazyChunk(fn) { lazyChunk = fn; },
  };
  return api;
}
