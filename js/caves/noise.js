// Deterministic 3D value noise for the cave world (no three.js): smooth noise, fractal sums. Pure and fast enough to
// run tens of thousands of times per chunk in the mesh worker.
const P = new Uint8Array(512);
{
  let s = 1932;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const V = new Float32Array(256);
for (let i = 0; i < 256; i++) V[i] = (P[i * 7 & 255] / 255) * 2 - 1;

const fade = (t) => t * t * (3 - 2 * t);
// value noise in [-1, 1]
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const a = P[X] + Y, aa = P[a] + Z, ab = P[a + 1] + Z, b = P[X + 1] + Y, ba = P[b] + Z, bb = P[b + 1] + Z;
  const l = (q, r, t) => q + (r - q) * t;
  return l(
    l(l(V[P[aa]], V[P[ba]], u), l(V[P[ab]], V[P[bb]], u), v),
    l(l(V[P[aa + 1]], V[P[ba + 1]], u), l(V[P[ab + 1]], V[P[bb + 1]], u), v), w);
}
// fractal sum, roughly in [-1, 1]
export function fbm3(x, y, z, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
