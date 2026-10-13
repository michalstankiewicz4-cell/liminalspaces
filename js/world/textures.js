// Procedural textures drawn on small canvases (no image files, nothing loaded from the network).
// Low resolution on purpose: the pixel-art filter hides detail anyway and small textures keep the look coherent.
import * as THREE from '../../vendor/three.module.js';
import { mulberry32 } from '../core/util.js';

const S = 64;

function canvas(draw, size = S) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, mulberry32(size * 7 + draw.length));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
// Fills the canvas with a base colour plus per-pixel noise of amplitude `amp`.
function noise(g, n, rnd, [r, gg, b], amp) {
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (rnd() - 0.5) * amp;
    g.fillStyle = rgb(r + k, gg + k, b + k);
    g.fillRect(x, y, 1, 1);
  }
}
function stains(g, n, rnd, count, color, alpha) {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rnd() * n, y = rnd() * n, r = 2 + rnd() * 6;
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd()), 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
function grid(g, n, cells, color, w = 1) {
  g.fillStyle = color;
  const step = n / cells;
  for (let k = 0; k < cells; k++) { g.fillRect(Math.round(k * step), 0, w, n); g.fillRect(0, Math.round(k * step), n, w); }
}

export function makeTextures() {
  return {
    // yellow office wallpaper: soft vertical stripes
    wallpaper: canvas((g, n, rnd) => {
      noise(g, n, rnd, [201, 186, 118], 10);
      g.globalAlpha = 0.18; g.fillStyle = '#7d6a2c';
      for (let x = 0; x < n; x += 8) g.fillRect(x, 0, 2, n);
      g.globalAlpha = 0.12; g.fillStyle = '#fff3c0';
      for (let x = 4; x < n; x += 8) for (let y = 2; y < n; y += 8) g.fillRect(x, y, 2, 3);
      g.globalAlpha = 1;
      stains(g, n, rnd, 3, '#8a7434', 0.12);
    }),
    // damp brownish-yellow carpet
    carpet: canvas((g, n, rnd) => {
      noise(g, n, rnd, [150, 128, 74], 26);
      stains(g, n, rnd, 5, '#5e4b22', 0.18);
    }),
    // suspended ceiling tiles
    ceiling: canvas((g, n, rnd) => {
      noise(g, n, rnd, [214, 208, 186], 8);
      g.globalAlpha = 0.25; g.fillStyle = '#8f8a74';
      for (let i = 0; i < 90; i++) g.fillRect(Math.floor(rnd() * n), Math.floor(rnd() * n), 1, 1);
      g.globalAlpha = 1;
      grid(g, n, 2, '#9c9580', 2);
    }),
    // hotel corridor wallpaper: dark red with gold stripes
    hotelWall: canvas((g, n, rnd) => {
      noise(g, n, rnd, [112, 46, 42], 10);
      g.fillStyle = 'rgba(214,170,96,.35)';
      for (let x = 0; x < n; x += 16) g.fillRect(x, 0, 2, n);
      g.fillStyle = 'rgba(214,170,96,.18)';
      for (let x = 8; x < n; x += 16) for (let y = 4; y < n; y += 16) { g.fillRect(x - 2, y, 4, 4); g.fillRect(x - 1, y - 2, 2, 8); }
      g.fillStyle = '#4a1e1a'; g.fillRect(0, n - 6, n, 6);     // dado rail feel at texture bottom
    }),
    hotelCarpet: canvas((g, n, rnd) => {
      noise(g, n, rnd, [104, 24, 30], 18);
      g.strokeStyle = 'rgba(206,150,70,.45)'; g.lineWidth = 2;
      for (let k = -n; k < n * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + n, n); g.stroke(); g.beginPath(); g.moveTo(k + n, 0); g.lineTo(k, n); g.stroke(); }
    }),
    plaster: canvas((g, n, rnd) => { noise(g, n, rnd, [206, 192, 168], 10); stains(g, n, rnd, 2, '#8b7b60', 0.1); }),
    // parking garage
    concrete: canvas((g, n, rnd) => {
      noise(g, n, rnd, [128, 130, 126], 22);
      stains(g, n, rnd, 6, '#4a4c48', 0.22);
      g.fillStyle = 'rgba(60,62,58,.35)'; g.fillRect(0, n - 4, n, 4);
    }),
    garageFloor: canvas((g, n, rnd) => {
      noise(g, n, rnd, [92, 94, 92], 18);
      stains(g, n, rnd, 5, '#2c2e2c', 0.3);
      g.fillStyle = '#c9b23a'; g.fillRect(0, 0, 2, n);          // parking bay line every texture repeat
    }),
    // swimming pools: small white/blue tiles
    poolTile: canvas((g, n, rnd) => {
      noise(g, n, rnd, [226, 236, 238], 8);
      grid(g, n, 8, '#9db8c0', 1);
    }),
    poolFloor: canvas((g, n, rnd) => {
      noise(g, n, rnd, [176, 214, 226], 10);
      grid(g, n, 8, '#7fa4b2', 1);
    }),
    water: canvas((g, n, rnd) => {
      noise(g, n, rnd, [70, 170, 200], 20);
      g.strokeStyle = 'rgba(220,250,255,.55)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = rnd() * n, y = rnd() * n; g.beginPath(); g.arc(x, y, 3 + rnd() * 6, 0, Math.PI * (0.6 + rnd())); g.stroke(); }
    }),
    // doors (local UVs over the whole door face)
    door: canvas((g, n, rnd) => {
      noise(g, n, rnd, [92, 58, 36], 14);
      g.strokeStyle = '#3a2416'; g.lineWidth = 2;
      g.strokeRect(10, 6, n - 20, n / 2 - 10); g.strokeRect(10, n / 2 + 4, n - 20, n / 2 - 10);
      g.fillStyle = '#c9a85a'; g.fillRect(n - 14, n / 2 - 2, 4, 4);
    }),
  };
}

// Per-theme surfaces: texture keys and how many metres one texture repeat covers.
export const THEME_SURFACES = {
  office: { wall: ['wallpaper', 2], floor: ['carpet', 2], ceil: ['ceiling', 1.2] },
  corridors: { wall: ['hotelWall', 2], floor: ['hotelCarpet', 2], ceil: ['plaster', 2] },
  garage: { wall: ['concrete', 4], floor: ['garageFloor', 4], ceil: ['concrete', 4] },
  pools: { wall: ['poolTile', 1], floor: ['poolFloor', 1], ceil: ['poolTile', 1] },
};
