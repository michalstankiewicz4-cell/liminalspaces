// The worlds built on the cell engine (grid + mesher): 'path' (the Great Path, hand laid from the story) and
// 'endless' (painted chunk by chunk from the seeded generator). Used by the facade (index.js) and the mesh worker,
// which builds its own copy of the same world.
import { buildLayout, ZONES, STARTS } from './layout.js';
import { buildEndless } from '../endless/layout.js';

// Paints (or sets up lazy painting of) a world into `grid`. Returns { zones, starts, beams, gates, emitters, water, gen? }.
export function buildWorld(name, grid, seed = 0) {
  if (name === 'endless') return buildEndless(grid, seed);
  return { ...buildLayout(grid), zones: ZONES, starts: STARTS };
}
