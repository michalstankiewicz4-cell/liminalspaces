// Procedural PBR materials for the Great Path world: every surface gets an albedo map, a normal map (from a generated
// height field) and a packed roughness/metalness map (G = roughness, B = metalness, as three.js reads them).
// Everything is computed on the CPU at start-up; no image files, nothing from the network.
import * as THREE from '../../vendor/three.module.js';
import { mulberry32, hash4 } from '../core/util.js';

/* ---- tiling value noise ---- */
function lattice(seed, px, py) {
  // returns f(x, y) in [0,1), periodic with period (px, py) on the integer lattice
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash4(seed, ((a % px) + px) % px, ((b % py) + py) % py, 7) / 4294967296;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
// Fractal noise on the unit square, tiling: base frequency f (integer), octaves n.
function fbm(seed, f, n = 4, gain = 0.5) {
  const ls = []; for (let o = 0; o < n; o++) ls.push(lattice(seed + o * 101, f << o, f << o));
  return (u, v) => {
    let s = 0, a = 1, t = 0;
    for (let o = 0; o < n; o++) { const k = f << o; s += ls[o](u * k, v * k) * a; t += a; a *= gain; }
    return s / t;
  };
}
// Anisotropic variant: frequency fx along u, fy along v (for brushed metal, wood grain, fibres).
function fbm2(seed, fx, fy, n = 3) {
  const ls = []; for (let o = 0; o < n; o++) ls.push(lattice(seed + o * 77, fx << o, fy << o));
  return (u, v) => { let s = 0, a = 1, t = 0; for (let o = 0; o < n; o++) { s += ls[o](u * (fx << o), v * (fy << o)) * a; t += a; a *= 0.5; } return s / t; };
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// distance to the nearest grid line of `cells` cells per unit (0 on the line, 0.5 in the middle)
const lineDist = (u, cells) => { const f = (u * cells) % 1; return Math.min(f, 1 - f); };

/* ---- material generators: g(u, v, out) sets out.r,g,b (albedo 0..1), out.h (height 0..1), out.rough, out.metal ---- */
const GEN = {
  wallpaper(seed) {
    const fib = fbm2(seed, 64, 8, 2), mott = fbm(seed + 5, 3, 3), dots = lattice(seed + 9, 16, 16);
    return (u, v, o) => {
      const stripe = Math.sin(u * Math.PI * 2 * 12) * 0.5 + 0.5;
      const m = mott(u, v), f = fib(u, v);
      const d = lineDist(u + (Math.floor(v * 16) % 2) * 0.03125, 16) < 0.08 && lineDist(v, 16) < 0.1 ? 1 : 0;
      const k = 0.9 + m * 0.14 + stripe * 0.035 + (f - 0.5) * 0.06 - d * 0.04 + (dots(u * 16, v * 16) - 0.5) * 0.015;
      o.r = 0.80 * k; o.g = 0.715 * k; o.b = 0.47 * k;
      o.h = 0.5 + stripe * 0.12 + f * 0.25 - d * 0.1; o.rough = 0.82 + f * 0.1; o.metal = 0;
    };
  },
  wallpaperOld(seed) {
    const base = GEN.wallpaper(seed), patch = fbm(seed + 3, 2, 3), patch2 = fbm(seed + 31, 4, 2), sc = fbm2(seed + 8, 3, 40, 3), dirt = fbm(seed + 13, 6, 4);
    return (u, v, o) => {
      base(u, v, o);
      // rectangular-ish colour patches (repairs, repaints, sun fading)
      const p = patch(Math.floor(u * 6) / 6 + u * 0.05, Math.floor(v * 4) / 4 + v * 0.05);
      const q = patch2(u, v);
      let k = 1;
      if (p > 0.62) k *= 1.08; else if (p < 0.36) k *= 0.88;
      if (q > 0.66) { o.r *= 0.97; o.g *= 1.0; o.b *= 1.08; }
      // seams of the wallpaper strips (every 0.5 m at a 4 m repeat => 8 strips)
      const seam = lineDist(u, 8);
      if (seam < 0.004) { k *= 0.82; o.h -= 0.15; } else if (seam < 0.01) { k *= 1.06; o.h += 0.08; }
      // scuff marks, mostly low on the wall (v near 1 = bottom of the texture)
      const s = sc(u, v);
      const low = smooth(0.55, 0.95, v);
      if (s > 0.72 - low * 0.12) k *= 0.72 + s * 0.2;
      k *= 0.9 + dirt(u, v) * 0.15 - low * 0.06;
      o.r *= k; o.g *= k; o.b *= k;
    };
  },
  carpet(seed, c = [0.55, 0.465, 0.32]) {
    const fib = lattice(seed, 256, 256), mott = fbm(seed + 1, 4, 4), stain = fbm(seed + 2, 3, 3);
    return (u, v, o) => {
      const f = fib(u * 256, v * 256), m = mott(u, v), s = stain(u, v);
      let k = 0.78 + f * 0.3 + (m - 0.5) * 0.25;
      if (s > 0.7) k *= 0.93;
      o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k * (s > 0.68 ? 0.9 : 1);
      o.h = f * 0.7 + m * 0.3; o.rough = 0.97; o.metal = 0;
    };
  },
  carpetGrey(seed) { return GEN.carpet(seed, [0.36, 0.37, 0.4]); },
  carpetTaupe(seed) { return GEN.carpet(seed, [0.42, 0.37, 0.31]); },
  // black square tiles, polished (they reflect the sunlight — story 105:22)
  blackTile(seed) {
    const n = fbm(seed, 8, 3);
    return (u, v, o) => {
      const g = Math.min(lineDist(u, 2), lineDist(v, 2)), grout = g < 0.012;
      const k = grout ? 0.5 : 1 + (n(u, v) - 0.5) * 0.08;
      o.r = (grout ? 0.12 : 0.03) * k; o.g = (grout ? 0.12 : 0.032) * k; o.b = (grout ? 0.12 : 0.036) * k;
      o.h = grout ? 0.1 : 0.85; o.rough = grout ? 0.9 : 0.06 + n(u, v) * 0.05; o.metal = grout ? 0 : 0.35;
    };
  },
  // old floorboards: long planks, worn (story 73:44)
  boards(seed) {
    const w = GEN.wood(seed, [0.5, 0.36, 0.22]), wear = fbm(seed + 9, 3, 3);
    return (u, v, o) => { w(u, v, o); const k = 0.9 + wear(u, v) * 0.2; o.r *= k; o.g *= k; o.b *= k; o.rough = Math.min(1, o.rough + 0.15); };
  },
  ceiling(seed) {
    const pits = lattice(seed, 128, 128), mott = fbm(seed + 4, 4, 3), stain = fbm(seed + 6, 2, 3);
    return (u, v, o) => {
      const g = Math.min(lineDist(u, 2), lineDist(v, 2));
      const p = pits(u * 128, v * 128), m = mott(u, v);
      const pit = p > 0.8 ? (p - 0.8) * 5 : 0;
      let k = 0.94 + (m - 0.5) * 0.08 - pit * 0.12;
      const st = stain(u, v); if (st > 0.74) k *= 1 - smooth(0.74, 0.86, st) * 0.07;
      const groove = g < 0.012;
      if (groove) k *= 0.55; else if (g < 0.02) k *= 0.85;
      o.r = 0.86 * k; o.g = 0.845 * k; o.b = 0.80 * k;
      o.h = groove ? 0.1 : 0.7 - pit * 0.25 + m * 0.1; o.rough = 0.92; o.metal = groove ? 0.3 : 0;
    };
  },
  tile(seed) {
    const n = fbm(seed, 8, 3), cell = lattice(seed + 3, 4, 4);
    return (u, v, o) => {
      const g = Math.min(lineDist(u, 4), lineDist(v, 4));
      const grout = g < 0.03;
      const t = cell(Math.floor(u * 4), Math.floor(v * 4)), alt = (Math.floor(u * 4) + Math.floor(v * 4)) % 2;
      const k = grout ? 0.55 : (alt ? 0.93 : 0.86) + (t - 0.5) * 0.05 + (n(u, v) - 0.5) * 0.05;
      o.r = (grout ? 0.6 : 0.88) * k; o.g = (grout ? 0.58 : 0.84) * k; o.b = (grout ? 0.55 : 0.74) * k;
      o.h = grout ? 0.15 : 0.8 + (n(u, v) - 0.5) * 0.05 - smooth(0.06, 0.03, g) * 0.3; o.rough = grout ? 0.95 : 0.28 + n(u, v) * 0.15; o.metal = 0;
    };
  },
  concrete(seed, c = [0.53, 0.53, 0.51]) {
    const m = fbm(seed, 4, 5), p = lattice(seed + 2, 128, 128), st = fbm(seed + 3, 3, 3);
    return (u, v, o) => {
      const a = m(u, v), pp = p(u * 128, v * 128), s = st(u, v);
      const pit = pp > 0.86 ? 1 : 0;
      const k = 0.8 + a * 0.35 - pit * 0.2 - (s > 0.7 ? 0.12 : 0);
      o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k;
      o.h = a * 0.6 + 0.3 - pit * 0.3; o.rough = 0.88 - (s > 0.7 ? 0.15 : 0); o.metal = 0;
    };
  },
  subfloor(seed) {
    const base = GEN.concrete(seed, [0.5, 0.48, 0.44]), glue = fbm(seed + 7, 5, 4), tuft = lattice(seed + 9, 256, 256), rem = fbm(seed + 11, 3, 3);
    return (u, v, o) => {
      base(u, v, o);
      const gl = glue(u, v);
      if (gl > 0.58) { const t = smooth(0.58, 0.68, gl); o.r = mix(o.r, 0.62, t * 0.6); o.g = mix(o.g, 0.54, t * 0.6); o.b = mix(o.b, 0.3, t * 0.6); o.rough = mix(o.rough, 0.4, t); o.h += t * 0.1; }
      if (rem(u, v) > 0.7) { const f = tuft(u * 256, v * 256); o.r = 0.5 * (0.7 + f * 0.4); o.g = 0.42 * (0.7 + f * 0.4); o.b = 0.28 * (0.7 + f * 0.4); o.h = 0.7 + f * 0.3; o.rough = 0.97; }
    };
  },
  drywall(seed) {
    const m = fbm(seed, 6, 4), cr = fbm(seed + 5, 8, 3);
    return (u, v, o) => {
      const a = m(u, v), c = cr(u, v);
      const crack = Math.abs(c - 0.5) < 0.012;
      const k = 0.93 + (a - 0.5) * 0.1 - (crack ? 0.25 : 0);
      o.r = 0.9 * k; o.g = 0.885 * k; o.b = 0.85 * k; o.h = 0.5 + a * 0.3 - (crack ? 0.3 : 0); o.rough = 0.95; o.metal = 0;
    };
  },
  agarite(seed) {
    const br = fbm2(seed, 2, 96, 3), m = fbm(seed + 3, 3, 3), hex = lattice(seed + 4, 32, 32);
    return (u, v, o) => {
      const b = br(u, v), a = m(u, v);
      const seam = Math.min(lineDist(u, 2), lineDist(v, 1)) < 0.006;
      const sp = hex(u * 32, v * 32) > 0.93 ? 1 : 0;
      const k = 0.85 + b * 0.25 + (a - 0.5) * 0.15 - (seam ? 0.4 : 0);
      o.r = 0.32 * k; o.g = 0.355 * k; o.b = 0.41 * k;
      o.h = 0.5 + b * 0.15 - (seam ? 0.4 : 0) + sp * 0.1; o.rough = 0.28 + b * 0.18 + a * 0.08; o.metal = 0.92;
    };
  },
  steel(seed) {
    const br = fbm2(seed, 2, 128, 3), rust = fbm(seed + 2, 4, 4), m = fbm(seed + 9, 2, 2);
    return (u, v, o) => {
      const b = br(u, v), r = rust(u, v);
      const seam = Math.min(lineDist(u, 2), lineDist(v, 2)) < 0.005;
      // rivets in rows near the plate seams
      const fu = (u * 2) % 1, fv = (v * 2) % 1;
      const ru = Math.min(fu, 1 - fu), rv = Math.min(fv, 1 - fv);
      const nearSeam = (ru < 0.05 || rv < 0.05);
      const along = ru < 0.05 ? fv : fu;
      const rivet = nearSeam && Math.abs(((along * 10) % 1) - 0.5) < 0.12 && Math.abs((ru < 0.05 ? ru : rv) - 0.028) < 0.014;
      let k = 0.82 + b * 0.2 + (m(u, v) - 0.5) * 0.1 - (seam ? 0.45 : 0);
      o.r = 0.56 * k; o.g = 0.575 * k; o.b = 0.6 * k; o.metal = 0.88; o.rough = 0.38 + b * 0.15;
      if (r > 0.74) { const t = smooth(0.74, 0.86, r); o.r = mix(o.r, 0.42, t); o.g = mix(o.g, 0.24, t); o.b = mix(o.b, 0.12, t); o.metal = mix(o.metal, 0.2, t); o.rough = mix(o.rough, 0.9, t); }
      o.h = 0.5 + b * 0.05 - (seam ? 0.4 : 0) + (rivet ? 0.45 : 0);
    };
  },
  rock(seed) {
    const m = fbm(seed, 3, 6, 0.55), c = fbm(seed + 3, 6, 3), st = fbm(seed + 6, 2, 3);
    return (u, v, o) => {
      const a = m(u, v), cr = c(u, v), s = st(u, v);
      const crack = Math.abs(cr - 0.5) < 0.015;
      const k = 0.55 + a * 0.75 - (crack ? 0.3 : 0);
      o.r = (0.43 + (s - 0.5) * 0.1) * k; o.g = 0.385 * k; o.b = (0.33 - (s - 0.5) * 0.06) * k;
      o.h = a - (crack ? 0.35 : 0); o.rough = 0.93; o.metal = 0;
    };
  },
  soil(seed, c = [0.37, 0.27, 0.18]) {
    const m = fbm(seed, 6, 5), peb = lattice(seed + 1, 64, 64);
    return (u, v, o) => {
      const a = m(u, v), p = peb(u * 64, v * 64);
      const pebble = p > 0.82;
      const k = 0.7 + a * 0.45 + (pebble ? 0.35 : 0);
      o.r = (pebble ? 0.5 : c[0]) * k; o.g = (pebble ? 0.47 : c[1]) * k; o.b = (pebble ? 0.42 : c[2]) * k;
      o.h = a * 0.7 + (pebble ? (p - 0.82) * 4 : 0); o.rough = pebble ? 0.75 : 1; o.metal = 0;
    };
  },
  earth(seed) { return GEN.soil(seed, [0.24, 0.17, 0.11]); },
  wood(seed, c = [0.56, 0.38, 0.21]) {
    const gr = fbm2(seed, 3, 40, 4), m = fbm(seed + 4, 4, 2), knot = lattice(seed + 7, 8, 8);
    return (u, v, o) => {
      const plank = Math.floor(v * 5), seam = lineDist(v, 5) < 0.012;
      const shift = (hash4(seed, plank, 0, 0) % 1000) / 1000;
      const g = gr(u + shift, v), rings = Math.sin((g * 18 + u * 2) * Math.PI) * 0.5 + 0.5;
      const kn = knot(u * 8 + shift * 8, v * 8);
      const k = 0.72 + rings * 0.22 + (m(u, v) - 0.5) * 0.2 + (hash4(seed, plank, 1, 0) % 100) / 600 - (seam ? 0.45 : 0) - (kn > 0.95 ? 0.3 : 0);
      o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k;
      o.h = 0.5 + rings * 0.12 - (seam ? 0.4 : 0); o.rough = 0.62 + rings * 0.12; o.metal = 0;
    };
  },
  parquet(seed) {
    const w = GEN.wood(seed, [0.48, 0.3, 0.17]);
    return (u, v, o) => {
      const bu = Math.floor(u * 4), bv = Math.floor(v * 4), flip = (bu + bv) % 2;
      const lu = (u * 4) % 1, lv = (v * 4) % 1;
      w(flip ? lv * 0.25 + bu * 0.25 : lu * 0.25 + bv * 0.25, flip ? lu : lv, o);
      if (Math.min(lineDist(u, 4), lineDist(v, 4)) < 0.008) { o.r *= 0.5; o.g *= 0.5; o.b *= 0.5; o.h = 0.1; }
    };
  },
  plaster(seed) {
    const m = fbm(seed, 3, 4), tr = fbm2(seed + 2, 6, 2, 3);
    return (u, v, o) => {
      const a = m(u, v), t = tr(u, v);
      const k = 0.88 + (a - 0.5) * 0.12 + (t - 0.5) * 0.08;
      o.r = 0.6 * k; o.g = 0.665 * k; o.b = 0.75 * k; o.h = 0.5 + t * 0.2 + a * 0.1; o.rough = 0.78; o.metal = 0;
    };
  },
  stone(seed) {
    const m = fbm(seed, 4, 5), f = lattice(seed + 5, 96, 96), v2 = fbm(seed + 8, 2, 3);
    return (u, v, o) => {
      const a = m(u, v), d = f(u * 96, v * 96), vein = Math.abs(v2(u, v) - 0.5) < 0.01;
      const k = 0.86 + (a - 0.5) * 0.18 - (d > 0.9 ? 0.15 : 0) - (vein ? 0.12 : 0);
      o.r = 0.79 * k; o.g = 0.765 * k; o.b = 0.7 * k; o.h = 0.5 + a * 0.3 - (d > 0.9 ? 0.2 : 0); o.rough = 0.72; o.metal = 0;
    };
  },
  whitepanel(seed) {
    const m = fbm(seed, 4, 3);
    return (u, v, o) => {
      const seam = Math.min(lineDist(u, 2), lineDist(v, 1)) < 0.006;
      const k = 0.95 + (m(u, v) - 0.5) * 0.05 - (seam ? 0.35 : 0);
      o.r = 0.86 * k; o.g = 0.875 * k; o.b = 0.885 * k; o.h = seam ? 0.1 : 0.6; o.rough = 0.45; o.metal = 0;
    };
  },
  fabric(seed) {
    const n = fbm(seed, 4, 2);
    return (u, v, o) => {
      const w = (Math.sin(u * Math.PI * 128) * Math.sin(v * Math.PI * 128)) * 0.5 + 0.5;
      const k = 0.8 + w * 0.2 + (n(u, v) - 0.5) * 0.15;
      o.r = 0.36 * k; o.g = 0.24 * k; o.b = 0.21 * k; o.h = w; o.rough = 0.95; o.metal = 0;
    };
  },
  leaf(seed) {
    const n = fbm(seed, 8, 4), v2 = fbm2(seed + 1, 16, 4, 2);
    return (u, v, o) => {
      const a = n(u, v), vein = Math.abs(v2(u, v) - 0.5) < 0.02;
      const k = 0.65 + a * 0.6;
      o.r = 0.2 * k; o.g = (0.42 + (vein ? 0.1 : 0)) * k; o.b = 0.16 * k; o.h = a; o.rough = 0.6; o.metal = 0;
    };
  },
  paper(seed) {
    const n = fbm(seed, 8, 3);
    return (u, v, o) => { const a = n(u, v); const k = 0.95 + (a - 0.5) * 0.06; o.r = 0.93 * k; o.g = 0.9 * k; o.b = 0.82 * k; o.h = a * 0.3 + 0.5; o.rough = 0.9; o.metal = 0; };
  },
  plastic(seed) {
    const n = fbm(seed, 4, 2);
    return (u, v, o) => { const k = 0.95 + (n(u, v) - 0.5) * 0.05; o.r = 0.8 * k; o.g = 0.79 * k; o.b = 0.76 * k; o.h = 0.5; o.rough = 0.42; o.metal = 0; };
  },
  dark(seed) {
    const n = fbm(seed, 6, 3);
    return (u, v, o) => { const k = 0.9 + n(u, v) * 0.2; o.r = o.g = o.b = 0.07 * k; o.h = n(u, v) * 0.3; o.rough = 0.7; o.metal = 0.1; };
  },
  brass(seed) {
    const br = fbm2(seed, 2, 64, 3), t = fbm(seed + 2, 4, 3);
    return (u, v, o) => { const b = br(u, v), ta = t(u, v); const k = 0.8 + b * 0.25; o.r = 0.78 * k; o.g = 0.6 * k; o.b = 0.32 * k; if (ta > 0.7) { o.r *= 0.6; o.g *= 0.75; o.b *= 0.7; } o.h = 0.5 + b * 0.05; o.rough = 0.3 + b * 0.15 + (ta > 0.7 ? 0.3 : 0); o.metal = 0.95; };
  },
};

// name: [generator, metres per texture repeat, texture size, normal strength, extra material params]
export const MAT_DEFS = {
  wallpaper: ['wallpaper', 2, 256, 0.6],
  wallpaperOld: ['wallpaperOld', 4, 512, 0.7],
  carpet: ['carpet', 1.5, 256, 1.2],
  carpetGrey: ['carpetGrey', 1.5, 256, 1.2],
  ceiling: ['ceiling', 1.2, 256, 1.0],
  tile: ['tile', 1.2, 256, 1.0],
  concrete: ['concrete', 3, 256, 1.2],
  subfloor: ['subfloor', 3, 256, 1.0],
  drywall: ['drywall', 2, 256, 0.8],
  agarite: ['agarite', 2.4, 256, 0.8],
  steel: ['steel', 2, 256, 1.2],
  rock: ['rock', 3, 256, 2.4],
  soil: ['soil', 2, 256, 1.6],
  earth: ['earth', 1.5, 256, 1.4],
  wood: ['wood', 1.6, 256, 0.9],
  parquet: ['parquet', 1.6, 256, 0.9],
  plaster: ['plaster', 3, 256, 0.8],
  stone: ['stone', 2, 256, 1.0],
  whitepanel: ['whitepanel', 2.4, 256, 0.6],
  fabric: ['fabric', 0.6, 128, 0.8],
  leaf: ['leaf', 0.5, 128, 1.0],
  paper: ['paper', 0.6, 128, 0.4],
  plastic: ['plastic', 1, 64, 0.2],
  dark: ['dark', 1, 64, 0.6],
  brass: ['brass', 0.5, 128, 0.5],
  carpetTaupe: ['carpetTaupe', 1.5, 256, 1.2],
  blackTile: ['blackTile', 1.0, 256, 0.6],
  boards: ['boards', 3.2, 256, 1.0],
};
// Metres per texture repeat for every material name (usable without creating materials, e.g. in the worker).
export const MAT_SCALE = Object.fromEntries([...Object.entries(MAT_DEFS).map(([k, d]) => [k, d[1]]),
  ...['lamp', 'lampFlicker', 'lampDead', 'sky', 'skyNight', 'bulb', 'glow', 'glass', 'screen', 'symbol', 'mapsheet', 'water', 'decal', 'chalkboard'].map((k) => [k, 1])]);
// Index order used in the cell grid (fm / wm / cm / sm). 0 = unset.
export const MAT_NAMES = ['none', ...Object.keys(MAT_DEFS)];
export const M = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));

function buildMaps(name) {
  const [gen, , size, strength] = MAT_DEFS[name];
  const g = GEN[gen](hash4(name.length, name.charCodeAt(0), name.charCodeAt(1), 3) % 100000);
  const n = size, A = new Uint8ClampedArray(n * n * 4), RM = new Uint8ClampedArray(n * n * 4), N = new Uint8ClampedArray(n * n * 4);
  const Hh = new Float32Array(n * n);
  const o = { r: 0, g: 0, b: 0, h: 0, rough: 0.8, metal: 0 };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    o.metal = 0; o.rough = 0.8;
    g((x + 0.5) / n, (y + 0.5) / n, o);
    const i = (x + y * n) * 4;
    A[i] = Math.pow(clamp01(o.r), 1 / 2.2) * 255; A[i + 1] = Math.pow(clamp01(o.g), 1 / 2.2) * 255; A[i + 2] = Math.pow(clamp01(o.b), 1 / 2.2) * 255; A[i + 3] = 255;
    RM[i] = 255; RM[i + 1] = clamp01(o.rough) * 255; RM[i + 2] = clamp01(o.metal) * 255; RM[i + 3] = 255;
    Hh[x + y * n] = o.h;
  }
  // normal map from the height field (central differences, wrapping)
  const s = strength * n / 64;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const hx = Hh[((x + 1) % n) + y * n] - Hh[((x - 1 + n) % n) + y * n];
    const hy = Hh[x + ((y + 1) % n) * n] - Hh[x + ((y - 1 + n) % n) * n];
    let nx = -hx * s, ny = hy * s, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (x + y * n) * 4;
    N[i] = (nx * 0.5 + 0.5) * 255; N[i + 1] = (ny * 0.5 + 0.5) * 255; N[i + 2] = (nz * 0.5 + 0.5) * 255; N[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(new Uint8Array(A.buffer), true), normalMap: tex(new Uint8Array(N.buffer), false), rmMap: tex(new Uint8Array(RM.buffer), false) };
}

// Draws text / symbols onto a canvas texture (signs, the builders' symbol, the map machine screen).
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The builders' symbol: lines from the centre at 90 and 45 degrees, concentric squares.
export function drawSymbol(g, w, h, { ink = '#2a3550', bg = null, corners = null } = {}) {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.46;
  g.strokeStyle = ink; g.lineCap = 'square';
  g.lineWidth = Math.max(2, w / 90);
  for (let k = 1; k <= 4; k++) { const s = r * k / 4; g.strokeRect(cx - s, cy - s, s * 2, s * 2); }
  g.lineWidth = Math.max(3, w / 60);
  for (let a = 0; a < 8; a++) {
    const t = a * Math.PI / 4, d = a % 2 ? r * Math.SQRT2 : r;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t) * d, cy + Math.sin(t) * d); g.stroke();
  }
  g.fillStyle = ink;
  g.fillRect(cx - r * 0.06, cy - r * 0.06, r * 0.12, r * 0.12);
  if (corners) {
    g.font = `bold ${Math.round(w / 26)}px monospace`; g.textAlign = 'center';
    for (const [x, y] of [[cx - r, cy - r - w * 0.02], [cx + r, cy - r - w * 0.02], [cx - r, cy + r + w * 0.045], [cx + r, cy + r + w * 0.045]]) g.fillText(corners, x, y);
  }
}

// Creates all materials. Returns { byIndex: [], byName: {}, scale: {name: metres per repeat} }.
export function makeMaterials() {
  const byName = {}, scale = {};
  for (const name of Object.keys(MAT_DEFS)) {
    const m = buildMaps(name);
    byName[name] = new THREE.MeshStandardMaterial({
      map: m.map, normalMap: m.normalMap, roughnessMap: m.rmMap, metalnessMap: m.rmMap,
      roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 0.6,
    });
    scale[name] = MAT_DEFS[name][1];
  }
  // emissive / special materials (no baked light)
  const lampTex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#fffdf2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9d6c8'; for (let i = 0; i <= 8; i++) { g.fillRect(i * 8 - 1, 0, 2, h); g.fillRect(0, i * 8 - 1, w, 2); }
    g.strokeStyle = '#8f8c80'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  });
  byName.lamp = new THREE.MeshBasicMaterial({ map: lampTex, vertexColors: true });
  byName.lampDead = new THREE.MeshStandardMaterial({ map: lampTex, color: 0x6f6d66, roughness: 0.5, metalness: 0, vertexColors: true });
  byName.lampFlicker = new THREE.MeshBasicMaterial({ map: lampTex, vertexColors: true });
  byName.sky = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  byName.bulb = new THREE.MeshBasicMaterial({ color: 0xffe2a0, vertexColors: true });
  byName.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  for (const k of ['lamp', 'lampFlicker', 'sky', 'bulb', 'glow', 'lampDead']) scale[k] = 1;
  // physical colour-only helpers for small parts
  byName.glass = new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, vertexColors: true });
  scale.glass = 1;
  const byIndex = MAT_NAMES.map((n) => byName[n] || null);
  return { byName, byIndex, scale };
}

// A small environment map so metals and glossy tiles have something to reflect (warm ceiling panels in a beige room).
export function makeEnvironment(renderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x6e6450);
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 20), new THREE.MeshBasicMaterial({ color: 0x8a7a55, side: THREE.BackSide }));
  sc.add(room);
  const panel = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
  for (let x = -6; x <= 6; x += 4) for (let z = -6; z <= 6; z += 4) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), panel);
    p.rotation.x = Math.PI / 2; p.position.set(x, 2.95, z); sc.add(p);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x4a3c28 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.9; sc.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(sc, 0.02).texture;
  pm.dispose();
  return env;
}

export { mulberry32 };
