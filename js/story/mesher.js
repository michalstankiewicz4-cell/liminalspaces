// Chunk mesher for the Great Path world: turns grid cells into floors, ceilings, walls, risers, headers, skylight
// wells, skirting boards, light fixtures and props, with lighting baked into vertex colours:
//   ambient (per zone) + ceiling lights and skylights with wrap-around Lambert, distance falloff and occlusion
//   (2D ray march through the cells, respecting floor/ceiling heights) + sun squares under skylights + corner AO.
import * as THREE from '../../vendor/three.module.js';
import { CS, CN, CW, F } from './grid.js';
import { MAT_NAMES } from './textures.js';
import { buildProp } from './props.js';
import { rand4 } from '../core/util.js';

const R2 = 3.2 * 3.2;          // light falloff scale squared
const REACH = 12;              // max light distance (m)
const SUN = [2.4, 2.2, 1.85];  // sunlight on the floor under a skylight

/* ---- geometry emitter with baking ---- */
export class Emitter {
  constructor(bake, scale) {
    this.bake = bake; this.scale = scale;
    this.buckets = new Map();
    this.solids = null;          // when set (array), box() also records colliders
    this.T = null;               // current transform { x, y, z, c, s }
  }
  bucket(name) {
    let b = this.buckets.get(name);
    if (!b) { b = { p: [], n: [], uv: [], c: [], i: [] }; this.buckets.set(name, b); }
    return b;
  }
  // Grid of quads: O + U*us[k] + V*vs[j], us/vs are breakpoints in metres along unit axes U, V.
  // uv: 'world' (projected by the normal axis, scaled by material repeat) | 'local' (0..1 over the face) | function.
  grid(mat, O, U, V, us, vs, nrm, uv = 'world', glow = null) {
    if (this.dry) return;
    const b = this.bucket(mat), base = b.p.length / 3, sc = this.scale[mat] || 1;
    const ax = Math.abs(nrm[0]) > 0.5 ? 0 : Math.abs(nrm[1]) > 0.5 ? 1 : 2;
    const ul = us[us.length - 1], vl = vs[vs.length - 1];
    for (let j = 0; j < vs.length; j++) for (let k = 0; k < us.length; k++) {
      const a = us[k], c = vs[j];
      const x = O[0] + U[0] * a + V[0] * c, y = O[1] + U[1] * a + V[1] * c, z = O[2] + U[2] * a + V[2] * c;
      b.p.push(x, y, z); b.n.push(nrm[0], nrm[1], nrm[2]);
      if (uv === 'local') b.uv.push(ul ? a / ul : 0, vl ? 1 - c / vl : 0);
      else if (typeof uv === 'function') { const t = uv(x, y, z, a, c); b.uv.push(t[0], t[1]); }
      else if (ax === 0) b.uv.push(z / sc * -Math.sign(nrm[0]), -y / sc);
      else if (ax === 2) b.uv.push(x / sc * Math.sign(nrm[2]), -y / sc);
      else b.uv.push(x / sc, z / sc);
      const col = glow || this.bake(x, y, z, nrm[0], nrm[1], nrm[2]);
      b.c.push(col[0], col[1], col[2]);
    }
    const cx = U[1] * V[2] - U[2] * V[1], cy = U[2] * V[0] - U[0] * V[2], cz = U[0] * V[1] - U[1] * V[0];
    const flip = cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0;
    const row = us.length;
    for (let j = 0; j < vs.length - 1; j++) for (let k = 0; k < us.length - 1; k++) {
      const q = base + j * row + k, r = q + 1, s = q + row, t = s + 1;
      if (flip) b.i.push(q, s, r, r, s, t); else b.i.push(q, r, s, r, t, s);
    }
  }
  // Axis-aligned box in local coordinates of the current transform (quarter-turn rotations keep it axis aligned).
  // o: { solid, skip: 'py,ny', uv, glow, seg }
  box(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    [x0, y0, z0, x1, y1, z1] = this.tf(x0, y0, z0, x1, y1, z1);
    if (o.solid && this.solids) this.solids.push([x0, y0, z0, x1, y1, z1]);
    if (this.dry || o.hide) return;                 // hide: an invisible collider
    const seg = o.seg || 1;
    const br = (a, b) => { const n = Math.max(1, Math.ceil((b - a) / seg - 1e-6)), out = []; for (let k = 0; k <= n; k++) out.push((b - a) * k / n); return out; };
    const W = x1 - x0, Hh = y1 - y0, D = z1 - z0, skip = o.skip || '', uv = o.uv || 'world', g = o.glow || null;
    if (!skip.includes('px')) this.grid(mat, [x1, y0, z1], [0, 0, -1], [0, 1, 0], br(0, D), br(0, Hh), [1, 0, 0], uv, g);
    if (!skip.includes('nx')) this.grid(mat, [x0, y0, z0], [0, 0, 1], [0, 1, 0], br(0, D), br(0, Hh), [-1, 0, 0], uv, g);
    if (!skip.includes('pz')) this.grid(mat, [x0, y0, z1], [1, 0, 0], [0, 1, 0], br(0, W), br(0, Hh), [0, 0, 1], uv, g);
    if (!skip.includes('nz')) this.grid(mat, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], br(0, W), br(0, Hh), [0, 0, -1], uv, g);
    if (!skip.includes('py')) this.grid(mat, [x0, y1, z1], [1, 0, 0], [0, 0, -1], br(0, W), br(0, D), [0, 1, 0], uv, g);
    if (!skip.includes('ny')) this.grid(mat, [x0, y0, z0], [1, 0, 0], [0, 0, 1], br(0, W), br(0, D), [0, -1, 0], uv, g);
  }
  // Vertical prism (n sides) between radii r0 (bottom) and r1 (top) — pipes, funnels, cups, bowls, cones, wheels.
  prism(mat, cx, cz, r0, r1, y0, y1, n = 8, o = {}) {
    const [X, Y, Z] = this.tp(cx, y0, cz);
    // collider: a square a little inside the round shape (its corners stick out less than a full square would)
    if (o.solid && this.solids) { const r = Math.max(r0, r1) * 0.9; this.solids.push([X - r, Y, Z - r, X + r, Y + (y1 - y0), Z + r]); }
    if (this.dry) return;
    const b = this.bucket(mat), g = o.glow || null, sc = this.scale[mat] || 1;
    const top = Y + (y1 - y0);
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
      const nx = Math.cos(am), nz = Math.sin(am), slope = (r0 - r1) / Math.max(1e-3, y1 - y0);
      const l = Math.hypot(1, slope), N = o.inside ? [-nx / l, -slope / l, -nz / l] : [nx / l, slope / l, nz / l];
      const pts = [[a0, r0, Y], [a1, r0, Y], [a1, r1, top], [a0, r1, top]].map(([a, r, y]) => [X + Math.cos(a) * r, y, Z + Math.sin(a) * r]);
      const base = b.p.length / 3;
      pts.forEach((p, idx) => {
        b.p.push(p[0], p[1], p[2]); b.n.push(N[0], N[1], N[2]);
        b.uv.push((k + (idx === 1 || idx === 2 ? 1 : 0)) / n * (Math.PI * 2 * Math.max(r0, r1)) / sc, -p[1] / sc);
        const c = g || this.bake(p[0], p[1], p[2], N[0], N[1], N[2]); b.c.push(c[0], c[1], c[2]);
      });
      // counter-clockwise seen from the side the normal points to (outside, or inside for `inside`)
      if (o.inside) b.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else b.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    if (o.capTop && r1 > 0) this.disc(mat, X, top, Z, r1, n, 1, g);
    if (o.capBottom && r0 > 0) this.disc(mat, X, Y, Z, r0, n, -1, g);
  }
  disc(mat, X, Y, Z, r, n, up, g) {
    if (this.dry) return;
    const b = this.bucket(mat), base = b.p.length / 3, sc = this.scale[mat] || 1;
    const c0 = g || this.bake(X, Y, Z, 0, up, 0);
    b.p.push(X, Y, Z); b.n.push(0, up, 0); b.uv.push(X / sc, Z / sc); b.c.push(c0[0], c0[1], c0[2]);
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r;
      b.p.push(x, Y, z); b.n.push(0, up, 0); b.uv.push(x / sc, z / sc);
      const c = g || this.bake(x, Y, z, 0, up, 0); b.c.push(c[0], c[1], c[2]);
    }
    for (let k = 0; k < n; k++) { if (up > 0) b.i.push(base, base + k + 2, base + k + 1); else b.i.push(base, base + k + 1, base + k + 2); }
  }
  // transform helpers (rotation in quarter turns around the prop origin)
  tp(x, y, z) {
    const T = this.T; if (!T) return [x, y, z];
    return [T.x + x * T.c + z * T.s, T.y + y, T.z - x * T.s + z * T.c];
  }
  tf(x0, y0, z0, x1, y1, z1) {
    const a = this.tp(x0, y0, z0), b = this.tp(x1, y1, z1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  }
  at(x, y, z, rot) { this.T = { x, y, z, c: Math.round(Math.cos(rot)), s: Math.round(Math.sin(rot)) }; }
  // Raw buffers per material (for the worker -> main thread transfer).
  export() {
    const out = [];
    for (const [name, b] of this.buckets) {
      if (!b.i.length) continue;
      const big = b.p.length / 3 > 65535;
      out.push({ name, p: new Float32Array(b.p), n: new Float32Array(b.n), uv: new Float32Array(b.uv), c: new Float32Array(b.c), i: big ? new Uint32Array(b.i) : new Uint16Array(b.i) });
    }
    return out;
  }
  build(materials) {
    const group = new THREE.Group();
    for (const [name, b] of this.buckets) {
      if (!b.i.length || !materials[name]) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.setIndex(b.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, materials[name]);
      m.matrixAutoUpdate = false;
      const emissive = materials[name].isMeshBasicMaterial;
      m.castShadow = !emissive && name !== 'glass'; m.receiveShadow = !emissive;
      if (name === 'glass') m.renderOrder = 2;
      group.add(m);
    }
    return group;
  }
}

/* ---- baking ---- */
// Creates bake(x, y, z, nx, ny, nz) for one chunk: lights from the 3x3 chunks around it.
export function makeBaker(grid, zones, ci, cj) {
  const lights = [], skies = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const c = grid.chunk(ci + di, cj + dj, false);
    if (!c) continue;
    for (const l of c.lights) (l.sky ? skies : lights).push(l);
  }
  // 2D ray march from point to light through cells; blocked by closed cells or by floor/ceiling heights.
  function visible(x, y, z, lx, ly, lz) {
    const dx = lx - x, dz = lz - z, len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / CS);
    for (let k = 1; k < steps; k++) {
      const t = k / steps, px = x + dx * t, pz = z + dz * t, py = y + (ly - y) * t;
      const [c, i] = grid.at(Math.floor(px / CS), Math.floor(pz / CS));
      if (!c || !c.open[i]) return false;
      if (py < c.floor[i] - 0.02 || py > c.ceil[i] + 0.02) return false;
    }
    return true;
  }
  function blocked(x, y, z) {
    const [c, i] = grid.at(Math.floor(x / CS), Math.floor(z / CS));
    return !c || !c.open[i] || y < c.floor[i] || y > c.ceil[i];
  }
  return (x, y, z, nx, ny, nz) => {
    // sample slightly in front of the surface (into the open space)
    const sx = x + nx * 0.06, sy = y + ny * 0.06, sz = z + nz * 0.06;
    const [c0, i0] = grid.at(Math.floor((x + nx * 0.2) / CS), Math.floor((z + nz * 0.2) / CS));
    const zd = zones[c0 ? c0.zone[i0] : 0] || zones[0];
    let r = zd.amb * zd.tint[0], g = zd.amb * zd.tint[1], b = zd.amb * zd.tint[2];
    for (const l of lights) {
      const dx = l.x - sx, dy = l.y - sy, dz = l.z - sz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > REACH * REACH) continue;
      const d = Math.sqrt(d2), dot = (dx * nx + dy * ny + dz * nz) / d;
      const lam = Math.max(0, (dot + 0.35) / 1.35);
      if (lam <= 0) continue;
      if (!visible(sx, sy, sz, l.x, l.y - 0.05, l.z)) continue;
      const k = l.p * lam / (1 + d2 / R2);
      r += l.r * k; g += l.g * k; b += l.b * k;
    }
    for (const s of skies) {
      // bounce light from the skylight opening + direct sun on surfaces under the opening
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, cy = s.y - 0.2;
      const dx = cx - sx, dy = cy - sy, dz = cz - sz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 30 * 30) {
        const d = Math.sqrt(d2), dot = (dx * nx + dy * ny + dz * nz) / d, lam = Math.max(0, (dot + 0.3) / 1.3);
        if (lam > 0 && visible(sx, sy, sz, cx, cy, cz)) { const k = s.p * lam / (1 + d2 / (R2 * 2.2)); r += s.r * k; g += s.g * k; b += s.b * k; }
      }
      const inside = x > s.x0 - 0.01 && x < s.x1 + 0.01 && z > s.z0 - 0.01 && z < s.z1 + 0.01;
      if (inside && ny > 0.5 && visible(sx, sy, sz, sx, s.y - 0.1, sz)) { r += SUN[0] * s.sun; g += SUN[1] * s.sun; b += SUN[2] * s.sun; }
      // walls directly beside the sun column get a bright stripe
      else if (ny < 0.5 && Math.abs(ny) < 0.5) {
        const px = x + nx * 0.3, pz = z + nz * 0.3;
        if (px > s.x0 && px < s.x1 && pz > s.z0 && pz < s.z1 && visible(sx, sy, sz, px, s.y - 0.1, pz)) { r += SUN[0] * s.sun * 0.6; g += SUN[1] * s.sun * 0.6; b += SUN[2] * s.sun * 0.6; }
      }
    }
    // ambient occlusion: blocked samples around the point, and closeness to floor / ceiling
    let occ = 0;
    const ox = x + nx * 0.25, oy = y + ny * 0.25, oz = z + nz * 0.25;
    for (let a = 0; a < 8; a++) {
      const t = a * Math.PI / 4, px = ox + Math.cos(t) * 0.45, pz = oz + Math.sin(t) * 0.45;
      if (blocked(px, oy + 0.02, pz)) occ++;
    }
    let ao = 1 - occ / 8 * 0.45;
    if (c0 && c0.open[i0] && Math.abs(ny) < 0.5) {
      const hf = y - c0.floor[i0], hc = c0.ceil[i0] - y;
      ao *= 0.72 + 0.28 * Math.min(1, hf / 0.5);
      ao *= 0.85 + 0.15 * Math.min(1, hc / 0.35);
    }
    return [r * ao, g * ao, b * ao];
  };
}

/* ---- chunk meshing ---- */
// breakpoints between a and b on a global 1 m grid (so lighting lines up across faces and chunks)
function breaks(a, b, step = 1) {
  const out = [0];
  for (let v = Math.floor(a / step + 1e-6) * step + step; v < b - 1e-6; v += step) out.push(v - a);
  out.push(b - a);
  return out;
}

// Meshes one chunk; returns the Emitter (call .build(materials) or .export()).
export function meshChunk(grid, c, ctx) {
  const { zones, scale } = ctx;
  const bake = makeBaker(grid, zones, c.ci, c.cj);
  const E = new Emitter(bake, scale);
  const x0 = c.ci * CW, z0 = c.cj * CW;
  const name = (i) => MAT_NAMES[i] || 'concrete';

  /* floors and ceilings: greedy rectangles */
  function rects(keyOf) {
    const used = new Uint8Array(CN * CN), out = [];
    for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
      const k = i + j * CN;
      if (used[k]) continue;
      const key = keyOf(k);
      if (key === null) { used[k] = 1; continue; }
      let w = 1;
      while (i + w < CN && !used[k + w] && keyOf(k + w) === key) w++;
      let h = 1;
      outer: while (j + h < CN) {
        for (let a = 0; a < w; a++) { const kk = i + a + (j + h) * CN; if (used[kk] || keyOf(kk) !== key) break outer; }
        h++;
      }
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) used[i + a + (j + b) * CN] = 1;
      out.push({ i, j, w, h, k });
    }
    return out;
  }
  /* procedural wear: decals from a 2x2 atlas (0 water stain, 1 scuff, 2 mould, 3 crack) */
  const WEAR = { wallpaperOld: 0.4, wallpaper: 0.16, drywall: 0.35, concrete: 0.3, whitepanel: 0.06, plaster: 0.12, rock: 0, carpet: 0.07, carpetGrey: 0.05, subfloor: 0.1, tile: 0.04, steel: 0.05, parquet: 0.03, stone: 0.05 };
  function decal(O, U, V, w, hgt, nrm, type) {
    const u0 = (type % 2) * 0.5, v0 = type < 2 ? 0.5 : 0;
    E.grid('decal', O, U, V, breaks(0, w, 1), breaks(0, hgt, 1), nrm, (x, y, z, a, b) => [u0 + a / w * 0.5, v0 + b / hgt * 0.5]);
  }
  for (const r of rects((k) => (c.open[k] && !(c.flags[k] & F.NOFLOOR) ? c.floor[k] + '|' + c.fm[k] : null))) {
    const X0 = x0 + r.i * CS, Z0 = z0 + r.j * CS, X1 = X0 + r.w * CS, Z1 = Z0 + r.h * CS, fm = name(c.fm[r.k]), y = c.floor[r.k];
    E.grid(fm, [X0, y, Z0], [1, 0, 0], [0, 0, 1], breaks(X0, X1), breaks(Z0, Z1), [0, 1, 0]);
    const wear = (WEAR[fm] || 0) * 0.5;
    for (let gz = Math.ceil(Z0 / 2) * 2; gz + 2 <= Z1; gz += 2) for (let gx = Math.ceil(X0 / 2) * 2; gx + 2 <= X1; gx += 2) {
      if (rand4(777, gx, gz, 1) > wear) continue;
      const s = 0.6 + rand4(777, gx, gz, 2) * 1.2, ox = rand4(777, gx, gz, 3) * (2 - s), oz = rand4(777, gx, gz, 4) * (2 - s);
      decal([gx + ox, y + 0.004, gz + oz], [1, 0, 0], [0, 0, 1], s, s, [0, 1, 0], rand4(777, gx, gz, 5) < 0.6 ? 0 : 2);
    }
  }
  for (const r of rects((k) => (c.open[k] && !(c.flags[k] & (F.SKY | F.OUT)) ? c.ceil[k] + '|' + c.cm[k] : null))) {
    const X0 = x0 + r.i * CS, Z0 = z0 + r.j * CS, X1 = X0 + r.w * CS, Z1 = Z0 + r.h * CS;
    E.grid(name(c.cm[r.k]), [X0, c.ceil[r.k], Z1], [1, 0, 0], [0, 0, -1], breaks(X0, X1), breaks(Z0, Z1, 1).map((v) => v), [0, -1, 0]);
  }
  // skylight glass panes (emissive), 0.55 m above the ceiling line
  // (zones can tint the glass — dusk — or show the night sky with stars: zone.skyGlow, zone.night)
  const skyGlow = [4.2, 4.2, 4.4];
  for (const r of rects((k) => (c.open[k] && (c.flags[k] & F.SKY) ? c.ceil[k] + '|' + c.zone[k] : null))) {
    const X0 = x0 + r.i * CS, Z0 = z0 + r.j * CS, X1 = X0 + r.w * CS, Z1 = Z0 + r.h * CS, zd = zones[c.zone[r.k]] || {};
    E.grid(zd.night ? 'skyNight' : 'sky', [X0, c.ceil[r.k] + 0.55, Z1], [1, 0, 0], [0, 0, -1], [0, X1 - X0], [0, Z1 - Z0], [0, -1, 0], 'local', zd.skyGlow || skyGlow);
  }

  /* vertical faces between neighbouring cells, merged into runs along each edge line */
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let d = 0; d < 4; d++) {
    const [dx, dz] = DIRS[d];
    // iterate edge lines perpendicular to the direction; run along the other axis
    for (let line = 0; line < CN; line++) {
      let runs = new Map();
      const flush = (keep) => {
        for (const [key, run] of runs) if (!keep || !keep.has(key)) { emitRun(d, line, run); runs.delete(key); }
      };
      for (let t = 0; t <= CN; t++) {
        const live = new Set();
        if (t < CN) {
          const i = dx ? line : t, j = dx ? t : line, k = i + j * CN;
          if (c.open[k]) {
            const gx = c.ci * CN + i + dx, gz = c.cj * CN + j + dz;
            const [nc, nk] = grid.at(gx, gz);
            const A = { f: c.floor[k], ce: c.ceil[k], wm: c.wm[k], sky: c.flags[k] & F.SKY, skirt: c.flags[k] & F.SKIRT };
            const parts = [];
            if (c.flags[k] & F.OUT) {
              // open to the sky: only the roof edge above a lower neighbour (0.6 m of building above its ceiling)
              if (nc && nc.open[nk] && nc.ceil[nk] < A.ce) parts.push([Math.max(nc.ceil[nk], A.f), Math.min(A.ce, nc.ceil[nk] + 0.6), nc.sm[nk] || A.wm, 0]);
            } else if (!nc || !nc.open[nk]) parts.push([A.f, A.ce, A.wm, A.skirt ? 1 : 0]);
            else {
              const bf = nc.floor[nk], bc = nc.ceil[nk], sm = nc.sm[nk] || A.wm;
              if (bf > A.f + 0.001) parts.push([A.f, Math.min(bf, A.ce), sm, 0]);
              if (bc < A.ce - 0.001) parts.push([Math.max(bc, A.f), A.ce, nc.sm[nk] || A.wm, 0]);
            }
            // skylight well sides
            const nsky = nc && nc.open[nk] && (nc.flags[nk] & F.SKY);
            if (A.sky && !nsky) parts.push([A.ce, A.ce + 0.55, M_WELL, 0]);
            for (const p of parts) {
              if (p[1] - p[0] < 0.001) continue;
              const key = p.join('|');
              live.add(key);
              const run = runs.get(key);
              if (run && run.t1 === t) run.t1 = t + 1;
              else { if (run) emitRun(d, line, run); runs.set(key, { t0: t, t1: t + 1, y0: p[0], y1: p[1], m: p[2], skirt: p[3] }); }
            }
          }
        }
        flush(live);
      }
    }
  }
  function emitRun(d, line, run) {
    const [dx, dz] = DIRS[d];
    const mat = run.m === M_WELL ? 'plaster' : name(run.m);
    const ys = breaks(run.y0, run.y1);
    if (dx) {
      const X = x0 + (line + (dx > 0 ? 1 : 0)) * CS, Za = z0 + run.t0 * CS, Zb = z0 + run.t1 * CS;
      const nrm = [-dx, 0, 0];
      E.grid(mat, [X, run.y0, Za], [0, 0, 1], [0, 1, 0], breaks(Za, Zb), ys, nrm);
      if (run.skirt) skirt(nrm, X - dx * 0.018, Za, Zb, run.y0, true);
      wallWear(mat, run, Za, Zb, (t, y) => [X - dx * 0.006, y, t], [0, 0, 1], nrm, X);
    } else {
      const Z = z0 + (line + (dz > 0 ? 1 : 0)) * CS, Xa = x0 + run.t0 * CS, Xb = x0 + run.t1 * CS;
      const nrm = [0, 0, -dz];
      E.grid(mat, [Xa, run.y0, Z], [1, 0, 0], [0, 1, 0], breaks(Xa, Xb), ys, nrm);
      if (run.skirt) skirt(nrm, Z - dz * 0.018, Xa, Xb, run.y0, false);
      wallWear(mat, run, Xa, Xb, (t, y) => [t, y, Z - dz * 0.006], [1, 0, 0], nrm, Z);
    }
  }
  // stains, scuffs, mould and cracks on full-height walls, every ~2.5 m with a per-material chance
  function wallWear(mat, run, a, b, P, U, nrm, line) {
    const wear = WEAR[mat] || 0, H0 = run.y1 - run.y0;
    if (!wear || H0 < 2) return;
    for (let t = Math.ceil(a / 2.5) * 2.5; t + 1.6 <= b; t += 2.5) {
      const h1 = rand4(778, Math.round(t * 2), Math.round(line * 2), nrm[0] * 3 + nrm[2] + 5);
      if (h1 > wear) continue;
      const r2 = rand4(778, Math.round(t * 2), Math.round(line * 2), 11), r3 = rand4(778, Math.round(t * 2), Math.round(line * 2), 12);
      const type = r2 < 0.35 ? 0 : r2 < 0.7 ? 1 : r2 < 0.85 ? 2 : 3;
      const w = 0.5 + r3 * 1.0, hh = type === 1 ? 0.25 + r3 * 0.4 : 0.4 + r3 * 0.9;
      const y = type === 0 ? run.y1 - hh - 0.02 : type === 1 ? run.y0 + 0.08 + r2 * 0.3 : run.y0 + 0.3 + r3 * (H0 - hh - 0.5);
      // U must run so the decal faces outward: use the same winding helper as walls (grid() fixes it by the normal)
      decal(P(t + (1.6 - w) * r2, y), U, [0, 1, 0], w, hh, nrm, type);
    }
  }
  function skirt(nrm, at, a, b, y, alongZ) {
    const hgt = 0.1;
    if (alongZ) {
      E.grid('wood', [at, y, a], [0, 0, 1], [0, 1, 0], breaks(a, b, 2), [0, hgt], nrm);
      E.grid('wood', [at - nrm[0] * 0.018, y + hgt, a], [0, 0, 1], [nrm[0], 0, 0], breaks(a, b, 2), [0, 0.018], [0, 1, 0]);
    } else {
      E.grid('wood', [a, y, at], [1, 0, 0], [0, 1, 0], breaks(a, b, 2), [0, hgt], nrm);
      E.grid('wood', [a, y + hgt, at - nrm[2] * 0.018], [1, 0, 0], [0, 0, nrm[2]], breaks(a, b, 2), [0, 0.018], [0, 1, 0]);
    }
  }

  /* light fixtures for ceiling lamps in this chunk */
  for (const l of c.lights) {
    if (!l.fixture) continue;
    E.T = null;
    const [w, d] = l.fixture === 'bulb' ? [0.12, 0.12] : l.fixture === 'tube' ? [1.25, 0.16] : [1.2, 0.6];
    const y = l.ceil;
    const glow = l.dead ? null : [l.r * 3.2, l.g * 3.2, l.b * 3.2];
    const mat = l.dead ? 'lampDead' : l.flicker ? 'lampFlicker' : l.fixture === 'bulb' ? 'bulb' : 'lamp';
    if (l.fixture === 'bulb') {
      E.box('dark', l.x - 0.01, y - 0.5, l.z - 0.01, l.x + 0.01, y, l.z + 0.01);
      E.box(mat, l.x - w / 2, y - 0.66, l.z - d / 2, l.x + w / 2, y - 0.5, l.z + d / 2, { glow, uv: 'local' });
    } else {
      E.box('steel', l.x - w / 2 - 0.04, y - 0.05, l.z - d / 2 - 0.04, l.x + w / 2 + 0.04, y - 0.005, l.z + d / 2 + 0.04, { skip: 'py' });
      E.box(mat, l.x - w / 2, y - 0.06, l.z - d / 2, l.x + w / 2, y - 0.05, l.z + d / 2, { glow, uv: 'local', skip: 'py' });
    }
  }

  /* props */
  E.solids = null;
  for (const p of c.props) { E.T = null; buildProp(E, p, ctx); }

  return E;
}

// Builds a THREE.Group from exported buffers (see Emitter.export).
export function groupFromBuffers(list, materials) {
  const group = new THREE.Group();
  for (const b of list) {
    const mat = materials[b.name];
    if (!mat) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(b.c, 3));
    g.setIndex(new THREE.BufferAttribute(b.i, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    const emissive = mat.isMeshBasicMaterial;
    m.castShadow = !emissive && !mat.transparent; m.receiveShadow = !emissive;
    if (mat.transparent) m.renderOrder = 2;
    group.add(m);
  }
  return group;
}
const M_WELL = 255;
