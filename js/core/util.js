// Small shared helpers (no dependencies).

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Deterministic PRNG (used for map generation and per-object looks).
export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Integer hash of up to four integers -> uint32 (stateless; used for infinite deterministic generation).
export function hash4(a, b = 0, c = 0, d = 0) {
  let h = 0x811c9dc5 ^ Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
// Same as hash4, as a float in [0, 1).
export const rand4 = (a, b, c, d) => hash4(a, b, c, d) / 4294967296;

// Text seed -> 31-bit integer (numbers are used as they are).
export function seedFrom(text) {
  const s = String(text).trim();
  if (/^\d{1,9}$/.test(s)) return +s;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000000000;
}
export const randomSeed = () => Math.floor(Math.random() * 1000000000);
