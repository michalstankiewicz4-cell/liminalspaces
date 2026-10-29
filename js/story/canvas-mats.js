// Canvas-drawn materials of the Great Path world: the map machine's screen, the builders' symbol relief, the map on
// the library table, the classroom chalkboard, water in the bowls, and the wear-decal atlas.
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture, drawSymbol } from './textures.js';

export function addCanvasMaterials(mats) {
  // special canvas materials
  const machineTex = canvasTexture(1024, 640, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#13304a'); grd.addColorStop(1, '#050d16'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,200,255,.12)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    drawSymbol(g, w, h, { ink: '#8fd8ff', corners: '2 MONTHS' });
  });
  mats.byName.screen = new THREE.MeshBasicMaterial({ map: machineTex, vertexColors: true });
  const symTex = canvasTexture(768, 512, (g, w, h) => { g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, w, h); drawSymbol(g, w, h, { ink: '#3a4252' }); });
  mats.byName.symbol = new THREE.MeshStandardMaterial({ map: symTex, roughness: 0.8, vertexColors: true });
  const sheetTex = canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a5a40'; g.lineWidth = 3;
    for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(40 + k * 50, 20); g.lineTo(40 + k * 50, h - 20); g.stroke(); }
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(20, 30 + k * 52); g.lineTo(w - 20, 30 + k * 52); g.stroke(); }
    g.fillStyle = '#a03020'; g.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    g.font = '20px serif'; g.fillStyle = '#3a2a18'; g.fillText('LUCERON', 24, h - 26);
  });
  const boardTex = canvasTexture(1024, 336, (g, w, h) => {
    g.fillStyle = '#1f2d24'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let k = 0; k < 60; k++) g.fillRect((k * 173) % w, (k * 61) % h, 80, 3);
    g.strokeStyle = 'rgba(240,240,225,.85)'; g.fillStyle = 'rgba(240,240,225,.85)'; g.lineWidth = 3;
    // the district: rings around the Hub, the Great Path going east, the West Path going west
    for (const r of [26, 52, 80]) g.strokeRect(330 - r, 168 - r * 0.8, r * 2, r * 1.6);
    g.beginPath(); g.moveTo(410, 168); g.lineTo(960, 168); g.stroke();
    g.beginPath(); g.moveTo(940, 156); g.lineTo(965, 168); g.lineTo(940, 180); g.stroke();
    g.setLineDash([10, 8]); g.beginPath(); g.moveTo(250, 168); g.lineTo(40, 168); g.stroke(); g.setLineDash([]);
    g.font = '30px "Segoe Print","Comic Sans MS",cursive';
    g.fillText('THE GREAT PATH', 560, 150); g.fillText('6 months?', 620, 215); g.fillText('?', 30, 150);
    g.font = '22px "Segoe Print","Comic Sans MS",cursive'; g.fillText('HUB', 312, 176); g.fillText('scouts turned back', 560, 255);
  });
  mats.byName.chalkboard = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95, vertexColors: true });
  mats.byName.mapsheet = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9, vertexColors: true });
  mats.byName.water = new THREE.MeshStandardMaterial({ color: 0x4a7a90, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, vertexColors: true });
  // wear decals atlas: water stain, scuff, mould, crack (with alpha)
  const decalTex = canvasTexture(512, 512, (g) => {
    const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    // 0: water stain rings (top-left)
    for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(110,80,35,${0.25 - k * 0.04})`; g.lineWidth = 6 - k; g.beginPath(); g.ellipse(128, 120 + k * 6, 100 - k * 14, 80 - k * 12, 0, 0, Math.PI * 2); g.stroke(); }
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 110); gr.addColorStop(0, 'rgba(140,110,50,.18)'); gr.addColorStop(1, 'rgba(140,110,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    // 1: scuffs (top-right)
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,35,30,${0.08 + rnd() * 0.25})`; g.lineWidth = 1 + rnd() * 4; const x = 266 + rnd() * 220, y = 40 + rnd() * 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 60, y + (rnd() - 0.5) * 8); g.stroke(); }
    // 2: mould / dark spots (bottom-left)
    for (let k = 0; k < 160; k++) { const a = rnd() * 6.28, d = Math.pow(rnd(), 0.7) * 110, r = 1 + rnd() * 9; g.fillStyle = `rgba(${30 + rnd() * 20},${35 + rnd() * 25},${25},${0.15 + rnd() * 0.35})`; g.beginPath(); g.arc(128 + Math.cos(a) * d, 384 + Math.sin(a) * d * 0.8, r, 0, 6.28); g.fill(); }
    // 3: cracks (bottom-right)
    g.strokeStyle = 'rgba(30,26,20,.55)';
    for (let k = 0; k < 5; k++) { let x = 300 + rnd() * 160, y = 270; g.lineWidth = 2.5 - k * 0.3; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (rnd() - 0.5) * 30; y += 8 + rnd() * 10; g.lineTo(Math.max(260, Math.min(508, x)), Math.min(508, y)); } g.stroke(); }
  });
  mats.byName.decal = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, roughness: 0.9, vertexColors: true });
  for (const k of ['screen', 'symbol', 'mapsheet', 'water', 'decal', 'chalkboard']) mats.scale[k] = 1;
}
