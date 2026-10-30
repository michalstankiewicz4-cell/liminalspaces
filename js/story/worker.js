// Mesh worker for the Great Path world: builds its own copy of the (deterministic) layout and meshes chunks off the
// main thread, returning raw vertex buffers. The main thread turns them into meshes (mesher.groupFromBuffers).
import { createGrid } from './grid.js';
import { buildLayout, ZONES } from './layout.js';
import { meshChunk } from './mesher.js';
import { MAT_SCALE } from './textures.js';

const grid = createGrid();
buildLayout(grid);
const ctx = { zones: ZONES, scale: MAT_SCALE };

self.onmessage = (e) => {
  const m = e.data;
  if (!m || m.t !== 'mesh') return;
  ctx.round = m.round; ctx.cove = m.cove;    // rounded corners and coves (settings)
  for (let a = -1; a <= 1; a++) grid.ensure(m.ci + a);
  const c = grid.chunk(m.ci, m.cj, false);
  const list = c ? meshChunk(grid, c, ctx).export() : [];
  const transfer = [];
  for (const b of list) transfer.push(b.p.buffer, b.n.buffer, b.uv.buffer, b.c.buffer, b.i.buffer);
  self.postMessage({ t: 'mesh', ci: m.ci, cj: m.cj, gen: m.gen, list }, transfer);
};
self.postMessage({ t: 'ready' });
