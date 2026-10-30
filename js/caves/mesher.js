// Cave chunk mesher (no three.js; runs in the worker): samples the distance field on a 0.5 m grid and builds a smooth
// surface with naive surface nets (one vertex per cell that the surface crosses, placed at the mean of the edge
// crossings; one quad per crossed grid edge). Each edge belongs to exactly one chunk, so chunks meet without seams.
// Per vertex: normal (field gradient), albedo tint and roughness of the zone, and baked light — the zone's ambient
// light (colour `c`) and the lamp plates (`l`: wrap Lambert, distance falloff, occlusion by rock tested along the ray),
// both times ambient occlusion from the field.
import { CH, VOX } from './field.js';
import { noise3 } from './noise.js';

const N = Math.round(CH / VOX);      // cells per chunk side (32)
const S = N + 3;                     // samples per side: grid points -1 .. N+1
const R2 = 3.6 * 3.6, REACH = 16;

export function meshCaveChunk(W, ci, cj, ck) {
  if (!W.hasChunk(ci, cj, ck)) return null;
  const ox = ci * CH, oy = cj * CH, oz = ck * CH;
  const F = new Float32Array(S * S * S), Zn = new Uint8Array(S * S * S);
  let pos = 0, neg = 0;
  for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = x + y * S + z * S * S;
    const v = W.field(ox + (x - 1) * VOX, oy + (y - 1) * VOX, oz + (z - 1) * VOX);
    F[i] = v; Zn[i] = W.lastZone();
    if (v > 0) pos++; else neg++;
  }
  if (!pos || !neg) return null;
  const idx = (x, y, z) => (x + 1) + (y + 1) * S + (z + 1) * S * S;

  /* vertices: cells -1 .. N-1 (cell (x,y,z) spans grid points x..x+1) */
  const C = N + 1, vid = new Int32Array(C * C * C).fill(-1);
  const P = [], Nn = [], Zv = [];
  const cid = (x, y, z) => (x + 1) + (y + 1) * C + (z + 1) * C * C;
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let z = -1; z < N; z++) for (let y = -1; y < N; y++) for (let x = -1; x < N; x++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = F[idx(x + corner[c][0], y + corner[c][1], z + corner[c][2])]; val[c] = v; if (v > 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((val[a] > 0) === (val[b] > 0)) continue;
      const t = val[a] / (val[a] - val[b]);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t; sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t; sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t; n++;
    }
    const lx = sx / n, ly = sy / n, lz = sz / n;
    // gradient from the cell's corners (points from air into rock); the normal points out of the rock
    const gx = (val[1] - val[0]) + (val[3] - val[2]) + (val[5] - val[4]) + (val[7] - val[6]);
    const gy = (val[2] - val[0]) + (val[3] - val[1]) + (val[6] - val[4]) + (val[7] - val[5]);
    const gz = (val[4] - val[0]) + (val[5] - val[1]) + (val[6] - val[2]) + (val[7] - val[3]);
    const gl = Math.hypot(gx, gy, gz) || 1;
    vid[cid(x, y, z)] = P.length / 3;
    P.push(ox + (x + lx) * VOX, oy + (y + ly) * VOX, oz + (z + lz) * VOX);
    Nn.push(-gx / gl, -gy / gl, -gz / gl);
    // zone of the corner nearest the surface
    let bz = 0, bv = 1e9;
    for (let c = 0; c < 8; c++) if (Math.abs(val[c]) < bv) { bv = Math.abs(val[c]); bz = Zn[idx(x + corner[c][0], y + corner[c][1], z + corner[c][2])]; }
    Zv.push(bz);
  }
  if (!P.length) return null;

  /* quads: edges whose base point lies in 0 .. N-1 on every axis */
  const I = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d);
  };
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v0 = F[idx(x, y, z)] > 0;
    if (v0 !== (F[idx(x + 1, y, z)] > 0))        // x edge: cells around it in y, z
      quad(vid[cid(x, y - 1, z - 1)], vid[cid(x, y, z - 1)], vid[cid(x, y, z)], vid[cid(x, y - 1, z)], !v0);
    if (v0 !== (F[idx(x, y + 1, z)] > 0))        // y edge: cells around it in z, x
      quad(vid[cid(x - 1, y, z - 1)], vid[cid(x - 1, y, z)], vid[cid(x, y, z)], vid[cid(x, y, z - 1)], !v0);
    if (v0 !== (F[idx(x, y, z + 1)] > 0))        // z edge: cells around it in x, y
      quad(vid[cid(x - 1, y - 1, z)], vid[cid(x, y - 1, z)], vid[cid(x, y, z)], vid[cid(x - 1, y, z)], !v0);
  }
  if (!I.length) return null;
  // winding: every triangle faces out of the rock (its normal along the vertex normals)
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    const sx = Nn[a] + Nn[b] + Nn[c], sy = Nn[a + 1] + Nn[b + 1] + Nn[c + 1], sz = Nn[a + 2] + Nn[b + 2] + Nn[c + 2];
    if (cx * sx + cy * sy + cz * sz < 0) { const k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
  }

  /* baked light and colours */
  const nv = P.length / 3;
  const col = new Float32Array(nv * 3), bake = new Float32Array(nv * 3), tint = new Float32Array(nv * 4);
  const lamps = W.lamps.filter((l) => !l.dead && l.x > ox - REACH && l.x < ox + CH + REACH && l.y > oy - REACH && l.y < oy + CH + REACH && l.z > oz - REACH && l.z < oz + CH + REACH);
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = Nn[v * 3], ny = Nn[v * 3 + 1], nz = Nn[v * 3 + 2];
    const zd = W.zones[Zv[v]] || W.zones[0];
    // ambient occlusion: how open the space in front of the surface is
    const a1 = -W.field(x + nx * 0.6, y + ny * 0.6, z + nz * 0.6), a2 = -W.field(x + nx * 1.6, y + ny * 1.6, z + nz * 1.6);
    const ao = Math.max(0.25, Math.min(1, 0.35 + Math.max(0, a1) * 0.45 + Math.max(0, a2) * 0.2));
    let r = zd.amb, g = zd.amb, b = zd.amb;
    if (zd.ambC) { r = zd.ambC[0]; g = zd.ambC[1]; b = zd.ambC[2]; }
    if (zd.sun) { const s = zd.sun, l = Math.max(0, nx * s[0] + ny * s[1] + nz * s[2]); r += s[3] * l; g += s[4] * l; b += s[5] * l; }   // the low sun on what faces it
    let lr = 0, lg = 0, lb = 0;                 // the lamps, kept apart: near you the real lights take over (materials.js)
    const sx = x + nx * 0.25, sy = y + ny * 0.25, sz = z + nz * 0.25;
    for (const l of lamps) {
      const dx = l.x - sx, dy = l.y - sy, dz = l.z - sz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > REACH * REACH) continue;
      const d = Math.sqrt(d2), lam = Math.max(0, ((dx * nx + dy * ny + dz * nz) / d + 0.3) / 1.3);
      if (lam <= 0) continue;
      // rock between: the field at a few points along the ray
      let occ = 0;
      for (const t of [0.25, 0.5, 0.75]) if (W.field(sx + dx * t, sy + dy * t, sz + dz * t) > 0.1) { occ = 1; break; }
      if (occ) continue;
      const k = l.p * lam / (1 + d2 / R2);
      lr += l.r * k; lg += l.g * k; lb += l.b * k;
    }
    col[v * 3] = r * ao; col[v * 3 + 1] = g * ao; col[v * 3 + 2] = b * ao;
    bake[v * 3] = lr * ao; bake[v * 3 + 1] = lg * ao; bake[v * 3 + 2] = lb * ao;
    let t0 = zd.tint[0], t1 = zd.tint[1], t2 = zd.tint[2];
    if (zd.grass) {           // dust by the pit, then a carpet of grass (in patches at its edge)
      const d = Math.hypot(x - W.exit.x, z - W.exit.z) + noise3(x * 0.3, 0.7, z * 0.3) * 3;
      const k = Math.min(1, Math.max(0, (d - 8) / 4)) * (ny > 0.6 ? 1 : 0.3);
      t0 += (zd.grass[0] - t0) * k; t1 += (zd.grass[1] - t1) * k; t2 += (zd.grass[2] - t2) * k;
    }
    tint[v * 4] = t0; tint[v * 4 + 1] = t1; tint[v * 4 + 2] = t2; tint[v * 4 + 3] = zd.rough;
  }
  const big = nv > 65535;
  return { p: new Float32Array(P), n: new Float32Array(Nn), c: col, l: bake, t: tint, i: big ? new Uint32Array(I) : new Uint16Array(I) };
}
