// Skylights of the Great Path world: sunbeams with floating dust, sun exposure under the glass, and the scratching
// episodes' visuals (a dark shape on the glass, the beam dims). Sounds are in audio.js.
import * as THREE from '../../vendor/three.module.js';
import { CS, F } from './grid.js';
import { canvasTexture } from './textures.js';

export function createSkylights(scene, grid, beams) {
  const beamAlpha = canvasTexture(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.08, '#fff'); gr.addColorStop(0.75, '#aaa'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  beamAlpha.colorSpace = THREE.NoColorSpace;
  const dustMat = new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.025, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const dusts = [];
  function makeBeam(b) {
    let floor = Infinity;
    for (let z = b.z0 + CS / 2; z < b.z1; z += CS) for (let x = b.x0 + CS / 2; x < b.x1; x += CS) floor = Math.min(floor, grid.floorAt(x, z));
    const g = new THREE.Group();
    if (!Number.isFinite(floor) || !Number.isFinite(b.top)) return g;
    const h = b.top - floor, w = b.x1 - b.x0, d = b.z1 - b.z0;
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 1.06, 1, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.78).multiplyScalar(0.11 * b.sun), alphaMap: beamAlpha, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, m);
    b.mesh = mesh; b.base = 0.11 * b.sun; b.floor = floor;
    g.userData.beam = b;
    mesh.scale.set(w, h, d);
    mesh.position.set((b.x0 + b.x1) / 2, floor + h / 2, (b.z0 + b.z1) / 2);
    mesh.renderOrder = 3;
    g.add(mesh);
    // floating dust inside the beam
    const n = Math.round(Math.min(400, w * d * h * 2));
    const pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { pos[k * 3] = b.x0 + Math.random() * w; pos[k * 3 + 1] = floor + Math.random() * h; pos[k * 3 + 2] = b.z0 + Math.random() * d; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, dustMat);
    pts.userData.dust = { b, floor, h, w, d };
    g.add(pts);
    dusts.push(pts);
    return g;
  }

  // Sun strength at a point: > 0 when standing in a sun square under a skylight.
  function sunAt(x, z) {
    if (!(grid.flagsAt(x, z) & F.SKY)) return 0;
    for (const b of beams) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.sun;
    return 0.8;
  }
  // A loaded skylight near the player (within 18 m), chosen at random with nearer ones more likely.
  function pickSkylight(pos) {
    const c = [];
    for (const b of beams) {
      if (!b.mesh) continue;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - pos.x, cz - pos.z);
      if (d < 18 && d > 2) c.push([b, 1 / (d + 3)]);
    }
    if (!c.length) return null;
    let r = Math.random() * c.reduce((s, e) => s + e[1], 0);
    let pick = c[0][0];
    for (const [b, w] of c) { r -= w; if (r <= 0) { pick = b; break; } }
    return { x: (pick.x0 + pick.x1) / 2, y: pick.top, z: (pick.z0 + pick.z1) / 2, beam: pick };
  }
  // A dark shape pressed against the glass while something scratches at it; the sunbeam dims.
  const shapeTex = canvasTexture(256, 256, (g) => {
    g.filter = 'blur(6px)';
    g.fillStyle = 'rgba(0,0,0,.95)';
    g.beginPath(); g.ellipse(128, 150, 46, 56, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const a = -0.75 + k * 0.5;
      g.save(); g.translate(128 + Math.sin(a) * 40, 120 - Math.cos(a) * 30); g.rotate(a);
      g.beginPath(); g.ellipse(0, -48, 9, 50, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.filter = 'none';
  });
  const shape = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shapeTex, transparent: true, depthWrite: false, opacity: 0, fog: false, color: 0x000000 }));
  shape.rotation.x = Math.PI / 2; shape.renderOrder = 4; shape.visible = false;
  scene.add(shape);
  let dimmed = null;
  function scratchVisual(ep) {
    if (dimmed && dimmed.mesh) dimmed.mesh.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(dimmed.base);
    dimmed = null;
    if (!ep) { shape.visible = false; return; }
    const { sky, t, dur } = ep, b = sky.beam;
    const k = Math.max(0, Math.min(1, t / 0.8, (dur - t) / 1.2));
    shape.visible = k > 0;
    shape.material.opacity = k;
    shape.position.set(sky.x + Math.sin(t * 0.9) * 0.35, sky.y - 0.03, sky.z + Math.cos(t * 0.6) * 0.25);
    shape.rotation.z = Math.sin(t * 0.4) * 0.5;
    if (b && b.mesh) { dimmed = b; b.mesh.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(b.base * (1 - 0.45 * k)); }
  }

  // floating dust drifts down inside the beams near the player
  function updateDust(dt, time, pos) {
    for (const p of dusts) {
      if (!p.parent || !p.parent.parent) continue;
      const { b, floor, h } = p.userData.dust, a = p.geometry.attributes.position;
      if (Math.abs((b.x0 + b.x1) / 2 - pos.x) > 30 || Math.abs((b.z0 + b.z1) / 2 - pos.z) > 30) continue;
      for (let k = 0; k < a.count; k++) {
        let y = a.getY(k) - dt * 0.05, x = a.getX(k) + Math.sin(time * 0.3 + k) * dt * 0.03;
        if (y < floor) y += h;
        if (x < b.x0) x = b.x1; if (x > b.x1) x = b.x0;
        a.setXY(k, x, y);
      }
      a.needsUpdate = true;
    }
  }
  // a chunk with beams is unloaded
  function detach(group) {
    group.traverse((o) => { if (o.userData.beam) o.userData.beam.mesh = null; });
    for (let i = dusts.length - 1; i >= 0; i--) if (!dusts[i].parent || !dusts[i].parent.parent) dusts.splice(i, 1);
  }
  return { makeBeam, sunAt, pickSkylight, scratchVisual, updateDust, detach };
}
