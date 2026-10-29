// The flashlight held in front of the player (first-person view model, no hand) and its spot light with shadows.
// Modelled on a classic military torch: olive-green painted aluminium with worn edges, a wide head with grip
// lugs, a black bezel and a warm lens, three black rubber rings at the neck, a long knurled body and a tail cap.
import * as THREE from '../../vendor/three.module.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// olive paint with scratches and worn spots (u = around, v = along the torch)
const paint = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3b5236'; g.fillRect(0, 0, w, h);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 1800; k++) { const v = 40 + r() * 40; g.fillStyle = `rgba(${v * 0.75},${v},${v * 0.7},.12)`; g.fillRect(r() * w, r() * h, 2, 2); }
  for (let k = 0; k < 90; k++) {                 // scratches showing bare metal
    g.strokeStyle = `rgba(170,180,165,${0.15 + r() * 0.35})`; g.lineWidth = 0.6 + r();
    const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8); g.stroke();
  }
  for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(150,160,140,${0.1 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * 12, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
});
// diamond knurling (used as a bump map on the body)
const knurl = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#202020'; g.lineWidth = 2;
  for (let k = -w; k < w * 2; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
});

export function createHand() {
  const g = new THREE.Group();
  const paintTex = paint(), knurlTex = knurl();
  knurlTex.repeat.set(6, 10);
  const green = new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.6, metalness: 0.3, color: 0xffffff });
  const greenKnurl = new THREE.MeshStandardMaterial({ map: paintTex, bumpMap: knurlTex, bumpScale: 1.2, roughness: 0.7, metalness: 0.25 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d0c, roughness: 0.85, metalness: 0 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x141614, roughness: 0.4, metalness: 0.6 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xc8b48c, roughness: 0.15, metalness: 0, emissive: 0xfff0cc, emissiveIntensity: 1.6 });

  // smooth body as a lathe (radius, length) from the tail (0) to the head; axis along -z (forward). L shortens it.
  const L = 0.5;
  const prof = [[0.0, 0], [0.015, 0.0], [0.018, 0.003], [0.0185, 0.018], [0.0168, 0.022], [0.0168, 0.17], [0.0185, 0.173], [0.0185, 0.212],
    [0.021, 0.218], [0.029, 0.243], [0.0325, 0.25], [0.0325, 0.292], [0.031, 0.298], [0.027, 0.3]].map(([r, y]) => new THREE.Vector2(r, y * L));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), green);
  // knurled grip over the middle of the body
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0174, 0.0174, 0.13 * L, 28, 1, true), greenKnurl);
  grip.position.y = 0.1 * L;
  knurlTex.repeat.set(6, 10 * L);
  // three rubber rings at the neck
  const rings = [0.18, 0.192, 0.204].map((y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.0045, 24), rubber); m.position.y = y * L; return m; });
  // grip lugs around the head
  const lugs = [];
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.028 * L, 0.005), green);
    m.position.set(Math.cos(a) * 0.0335, 0.27 * L, Math.sin(a) * 0.0335); m.rotation.y = -a; lugs.push(m);
  }
  // black bezel and the lens
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0035, 8, 28), bezel);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.299 * L;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 28), lensMat);
  lens.rotation.x = -Math.PI / 2; lens.position.y = 0.297 * L;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.004, 16), rubber); tail.position.y = -0.001;

  const torch = new THREE.Group();
  torch.add(body, grip, ...rings, ...lugs, ring, lens, tail);
  torch.rotation.x = -Math.PI / 2;                       // lathe axis (y) -> forward (-z)
  torch.position.z = 0.15 * L;                           // pivot near the middle
  g.add(torch);
  g.position.set(0.23, -0.235, -0.42);
  g.rotation.set(0.08, 0.02, -0.12);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });

  // the beam: a spot light at the lens with soft shadows
  const spot = new THREE.SpotLight(0xfff1d6, 40, 32, 0.46, 0.55, 2);
  spot.position.set(0.19, -0.18, -0.5);
  spot.target.position.set(0.05, -0.3, -6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.025;
  spot.shadow.camera.near = 0.15;
  spot.shadow.camera.far = 32;
  spot.shadow.radius = 3;

  green.color.setScalar(0.62); greenKnurl.color.setScalar(0.62);
  const mats = [green, greenKnurl, rubber, bezel];
  const base = mats.map((m) => m.color.clone());
  let k = 1;                 // view-model scale: same size and place on screen at any field of view
  return {
    group: g, spot, lens: lensMat,
    // brightness of the place the torch is in, so the view model is not lit in the dark
    setLight(k) { mats.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(Math.max(0.1, Math.min(1.3, k)))); },
    setOn(on) { spot.visible = on; lensMat.emissiveIntensity = on ? 1.6 : 0; },
    // gentle sway with the walk
    sway(t, bob, amp) {
      g.position.set((0.23 + Math.sin(bob) * 0.008 * amp) * k, (-0.235 - Math.abs(Math.cos(bob)) * 0.01 * amp + Math.sin(t * 1.3) * 0.002) * k, -0.42);
    },
    // keeps the torch the size it was designed at (75°) when the field of view changes
    fit(fov) { k = Math.tan(fov * Math.PI / 360) / Math.tan(75 * Math.PI / 360); g.scale.setScalar(k); },
  };
}
