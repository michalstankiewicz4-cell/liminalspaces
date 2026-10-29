// What the player has seen of the Great Path world (for the map): cells within 15 m in line of sight are marked,
// kept for good, exported as one base64 bitset per chunk and restored on the next visit.
import { CS, CN, CW } from './grid.js';

export function createExplored(grid) {
  let seenDirty = false;
  // Explored cells are kept for good: exported as one bitset (base64) per chunk, restored on the next visit.
  function exportSeen() {
    const out = {};
    for (const c of grid.chunks.values()) {
      if (!c.seenV) continue;
      const bits = new Uint8Array(CN * CN / 8);
      for (let k = 0; k < CN * CN; k++) if (c.seen[k]) bits[k >> 3] |= 1 << (k & 7);
      let s = ''; for (const b of bits) s += String.fromCharCode(b);
      out[c.ci + ',' + c.cj] = btoa(s);
    }
    seenDirty = false;
    return out;
  }
  function importSeen(obj) {
    if (!obj || typeof obj !== 'object') return;
    let n = 0;
    for (const [k, v] of Object.entries(obj)) {
      if (n++ > 4000) break;
      const m = /^(-?\d{1,6}),(-?\d{1,6})$/.exec(k);
      if (!m || typeof v !== 'string' || v.length > 1000) continue;
      let s; try { s = atob(v); } catch (e) { continue; }
      if (s.length !== CN * CN / 8) continue;
      const ci = +m[1], cj = +m[2];
      grid.ensure(ci);
      const c = grid.chunk(ci, cj, false);
      if (!c) continue;
      for (let i = 0; i < CN * CN; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) c.seen[i] = 1;
      c.seenV = (c.seenV || 0) + 1;
    }
  }
  // World-space box around everything explored (null when nothing is).
  function seenBounds() {
    let b = null;
    for (const c of grid.chunks.values()) {
      if (!c.seenV) continue;
      const x0 = c.ci * CW, z0 = c.cj * CW;
      if (!b) b = { x0, z0, x1: x0 + CW, z1: z0 + CW };
      else { b.x0 = Math.min(b.x0, x0); b.z0 = Math.min(b.z0, z0); b.x1 = Math.max(b.x1, x0 + CW); b.z1 = Math.max(b.z1, z0 + CW); }
    }
    return b;
  }
  function markSeen(px, pz, py) {
    const R = 15, gx0 = Math.floor(px / CS), gz0 = Math.floor(pz / CS), n = R / CS;
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      if (dx * dx + dz * dz > n * n) continue;
      const gx = gx0 + dx, gz = gz0 + dz;
      const [c, k] = grid.at(gx, gz);
      if (!c || c.seen[k]) continue;
      // line of sight through open cells at eye height
      const steps = Math.max(Math.abs(dx), Math.abs(dz));
      let ok = true;
      for (let s = 1; s < steps; s++) {
        const [cc, kk] = grid.at(Math.floor(gx0 + 0.5 + dx * s / steps), Math.floor(gz0 + 0.5 + dz * s / steps));
        if (!cc || !cc.open[kk] || cc.floor[kk] > py + 1.4 || cc.ceil[kk] < py + 1.2) { ok = false; break; }
      }
      if (ok) { c.seen[k] = 1; c.seenV = (c.seenV || 0) + 1; seenDirty = true; }
    }
  }
  return { exportSeen, importSeen, seenBounds, markSeen, get dirty() { return seenDirty; } };
}
