// Oddities of the endless world: rare objects that make some rooms memorable (finding one counts). Built as a prop
// of the shared engine (story/props.js: kind 'oddity', p.odd = the oddity kind) from boxes painted with a colour
// (Emitter.tint) over a plain plastic surface; glowing parts (screens, lamps) are emissive. Every model faces local +z;
// p.rot turns it in quarter turns. Wall-mounted kinds are built around their anchor height (1.5 m on a wall); when no
// wall is available they stand on the floor at FLOOR_Y instead. Kinds with a footprint in gen.js ODDITIES are solid.
import { ODDITIES } from '../world/gen.js';

const FLOOR_Y = { painting: 0.36, buoy: 0.4, exit: 2.6, phone: 1.2 };
const BROWN = [0.42, 0.27, 0.16], GREY = [0.45, 0.46, 0.48], DARK = [0.12, 0.12, 0.13], WHITE = [0.86, 0.86, 0.84];

export function buildOddity(E, p) {
  const kind = p.odd, wall = p.wall;
  const y0 = (p.y || 0) + (kind in FLOOR_Y ? (wall ? 1.5 : FLOOR_Y[kind]) : 0);
  const solid = !!(ODDITIES[kind] && ODDITIES[kind].solid);
  E.at(p.x, y0, p.z, p.rot || 0);
  const box = (ax, ay, az, bx, by, bz, albedo, glow) => {
    if (glow) { E.tint = null; E.box('glow', ax, ay, az, bx, by, bz, { uv: 'local', glow: albedo.map((v) => v * 2.2) }); return; }
    E.tint = albedo;
    E.box('plastic', ax, ay, az, bx, by, bz, { uv: 'local', solid });
    E.tint = null;
  };

  switch (kind) {
    case 'chair': {
      const k = [0.22, 0.3, 0.42];
      box(-0.24, 0.42, -0.24, 0.24, 0.48, 0.24, k);
      box(-0.24, 0.48, -0.26, 0.24, 1.0, -0.2, k);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(x - 0.025, 0, z - 0.025, x + 0.025, 0.42, z + 0.025, DARK);
      break;
    }
    case 'vending':
      box(-0.5, 0, -0.4, 0.5, 1.9, 0.4, [0.62, 0.1, 0.12]);
      box(-0.38, 0.6, 0.4, 0.22, 1.75, 0.43, [0.9, 0.95, 1.0], true);
      box(0.26, 0.9, 0.4, 0.42, 1.4, 0.43, DARK);
      box(-0.38, 0.15, 0.4, 0.22, 0.4, 0.44, DARK);
      break;
    case 'cooler':
      box(-0.18, 0, -0.18, 0.18, 1.0, 0.18, WHITE);
      box(-0.14, 1.0, -0.14, 0.14, 1.42, 0.14, [0.45, 0.7, 0.95]);
      box(-0.04, 0.72, 0.18, 0.04, 0.8, 0.24, [0.2, 0.4, 0.8]);
      break;
    case 'plant':
      box(-0.2, 0, -0.2, 0.2, 0.4, 0.2, [0.62, 0.32, 0.2]);
      box(-0.05, 0.4, -0.05, 0.05, 0.9, 0.05, [0.3, 0.22, 0.12]);
      box(-0.32, 0.8, -0.32, 0.32, 1.3, 0.32, [0.2, 0.45, 0.2]);
      box(-0.2, 1.3, -0.2, 0.2, 1.6, 0.2, [0.25, 0.52, 0.22]);
      break;
    case 'trolley':
      box(-0.35, 0.75, -0.55, 0.35, 0.85, 0.55, WHITE);
      box(-0.35, 0.25, -0.55, 0.35, 0.3, 0.55, GREY);
      for (const [x, z] of [[-0.32, -0.52], [0.32, -0.52], [-0.32, 0.52], [0.32, 0.52]]) box(x - 0.02, 0, z - 0.02, x + 0.02, 0.75, z + 0.02, GREY);
      box(-0.12, 0.85, -0.12, 0.12, 0.95, 0.12, [0.75, 0.72, 0.6]);
      break;
    case 'painting':
      box(-0.5, -0.35, 0, 0.5, 0.35, 0.05, BROWN);
      box(-0.42, -0.27, 0.05, 0.42, 0.27, 0.06, [0.35, 0.5, 0.62]);
      box(-0.42, -0.27, 0.06, 0.42, -0.05, 0.065, [0.3, 0.45, 0.25]);
      break;
    case 'cone':
      box(-0.22, 0, -0.22, 0.22, 0.05, 0.22, [0.9, 0.38, 0.08]);
      box(-0.14, 0.05, -0.14, 0.14, 0.3, 0.14, [0.9, 0.38, 0.08]);
      box(-0.11, 0.3, -0.11, 0.11, 0.42, 0.11, WHITE);
      box(-0.08, 0.42, -0.08, 0.08, 0.68, 0.08, [0.9, 0.38, 0.08]);
      break;
    case 'car': {
      const paint = [0.3, 0.38, 0.5];
      box(-0.9, 0.3, -2.0, 0.9, 0.95, 2.0, paint);
      box(-0.8, 0.95, -1.0, 0.8, 1.45, 0.9, paint);
      box(-0.82, 1.0, -0.9, 0.82, 1.4, 0.8, DARK);
      for (const [x, z] of [[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.3], [0.85, 1.3]]) box(x - 0.12, 0, z - 0.33, x + 0.12, 0.62, z + 0.33, DARK);
      box(-0.75, 0.6, 2.0, -0.45, 0.75, 2.03, [1, 0.95, 0.7], true);
      box(0.45, 0.6, 2.0, 0.75, 0.75, 2.03, [1, 0.95, 0.7], true);
      break;
    }
    case 'ball':
      box(-0.25, 0, -0.25, 0.25, 0.5, 0.25, [0.9, 0.2, 0.2]);
      box(-0.252, 0.18, -0.252, 0.252, 0.32, 0.252, [0.95, 0.85, 0.2]);
      break;
    case 'buoy':
      box(-0.4, -0.4, 0, 0.4, -0.25, 0.1, [0.9, 0.15, 0.12]);
      box(-0.4, 0.25, 0, 0.4, 0.4, 0.1, [0.9, 0.15, 0.12]);
      box(-0.4, -0.25, 0, -0.25, 0.25, 0.1, WHITE);
      box(0.25, -0.25, 0, 0.4, 0.25, 0.1, WHITE);
      break;
    case 'door':
      box(-0.6, 0, -0.08, -0.5, 2.25, 0.08, WHITE);
      box(0.5, 0, -0.08, 0.6, 2.25, 0.08, WHITE);
      box(-0.6, 2.15, -0.08, 0.6, 2.25, 0.08, WHITE);
      box(-0.5, 0, -0.04, 0.5, 2.15, 0.04, BROWN);
      box(0.32, 1.0, 0.04, 0.4, 1.06, 0.08, [0.8, 0.68, 0.3]);
      break;
    case 'exit':
      box(-0.32, -0.12, 0, 0.32, 0.12, 0.08, [0.15, 0.95, 0.35], true);
      box(-0.34, -0.14, 0, 0.34, 0.14, 0.05, DARK);
      break;
    case 'phone':
      box(-0.2, -0.32, 0, 0.2, 0.32, 0.18, GREY);
      box(-0.14, -0.05, 0.18, 0.14, 0.2, 0.2, DARK);
      box(-0.22, -0.3, 0.12, -0.16, 0.05, 0.24, DARK);
      break;
    case 'tv':
      box(-0.35, 0, -0.25, 0.35, 0.55, 0.25, BROWN);
      box(-0.32, 0.55, -0.22, 0.32, 1.02, 0.22, DARK);
      box(-0.26, 0.6, 0.22, 0.26, 0.96, 0.24, [0.62, 0.7, 0.78], true);
      break;
    default: break;
  }
}
