// Mesh worker for the cell engine: builds its own copy of the (deterministic) world — the Great Path or an endless
// world of a seed, told by the first message — and meshes chunks off the main thread, returning raw vertex buffers.
// The main thread turns them into meshes (mesher.groupFromBuffers).
import { createGrid } from './grid.js';
import { buildWorld } from './worlds.js';
import { meshChunk } from './mesher.js';
import { MAT_SCALE } from './textures.js';

let grid = null, ctx = null, lazyChunks = false;

self.onmessage = (e) => {
  const m = e.data;
  if (!m) return;
  if (m.t === 'init') {
    grid = createGrid();
    const w = buildWorld(m.world, grid, m.seed);
    ctx = { zones: w.zones, scale: MAT_SCALE };
    lazyChunks = m.world === 'endless';
    self.postMessage({ t: 'ready' });
    return;
  }
  if (m.t !== 'mesh' || !grid) return;
  ctx.round = m.round; ctx.cove = m.cove;    // rounded corners and coves (settings)
  if (lazyChunks) grid.ensureAround(m.ci, m.cj); else for (let a = -1; a <= 1; a++) grid.ensure(m.ci + a);
  const c = grid.chunk(m.ci, m.cj, false);
  const list = c ? meshChunk(grid, c, ctx).export() : [];
  const transfer = [];
  for (const b of list) transfer.push(b.p.buffer, b.n.buffer, b.uv.buffer, b.c.buffer, b.i.buffer);
  self.postMessage({ t: 'mesh', ci: m.ci, cj: m.cj, gen: m.gen, list }, transfer);
};
