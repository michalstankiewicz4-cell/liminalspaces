// Mesh worker for the cave world: builds its own copy of the (deterministic) field and meshes chunks off the main
// thread, returning raw vertex buffers (caves/mesher.js).
import { buildCaves } from './field.js';
import { meshCaveChunk } from './mesher.js';

const W = buildCaves();
self.onmessage = (e) => {
  const m = e.data;
  if (!m || m.t !== 'mesh') return;
  const r = meshCaveChunk(W, m.i, m.j, m.k);
  const transfer = r ? [r.p.buffer, r.n.buffer, r.c.buffer, r.t.buffer, r.i.buffer] : [];
  self.postMessage({ t: 'mesh', i: m.i, j: m.j, k: m.k, r }, transfer);
};
self.postMessage({ t: 'ready' });
