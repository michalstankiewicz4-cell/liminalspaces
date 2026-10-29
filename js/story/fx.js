// Event effects of the Great Path world: falling dust, sparks, and short flashes from one reused point light.
import * as THREE from '../../vendor/three.module.js';

export function createFx(scene, grid) {
  // particles: falling dust and sparks; short point-light flashes
  const fxPts = [];
  const dustM = new THREE.PointsMaterial({ color: 0xcfc4a8, size: 0.03, transparent: true, opacity: 0.8, depthWrite: false });
  const sparkM = new THREE.PointsMaterial({ color: 0xffd080, size: 0.035, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  function particles(kind, x, y, z, n) {
    const fl0 = grid.floorAt(x, z);
    if (!Number.isFinite(y) || !Number.isFinite(fl0)) return;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      pos[k * 3] = x + (Math.random() - 0.5) * (kind === 'dust' ? 1.6 : 0.2); pos[k * 3 + 1] = y; pos[k * 3 + 2] = z + (Math.random() - 0.5) * (kind === 'dust' ? 1.6 : 0.2);
      vel[k * 3] = (Math.random() - 0.5) * (kind === 'dust' ? 0.1 : 2.5); vel[k * 3 + 1] = kind === 'dust' ? -0.3 - Math.random() * 0.6 : Math.random() * 1.5; vel[k * 3 + 2] = (Math.random() - 0.5) * (kind === 'dust' ? 0.1 : 2.5);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, kind === 'dust' ? dustM : sparkM);
    pts.userData = { vel, life: kind === 'dust' ? 5 : 1.4, kind, floor: fl0 };
    scene.add(pts); fxPts.push(pts);
  }
  // one persistent point light reused for flashes (adding lights at run time would recompile every shader)
  const flashL = new THREE.PointLight(0xfff0d0, 0, 9, 2);
  scene.add(flashL);
  function flash(x, y, z, color = 0xfff0d0, power2 = 6) { flashL.color.set(color); flashL.position.set(x, y, z); flashL.intensity = power2; }
  function updateFx(dt) {
    for (let i = fxPts.length - 1; i >= 0; i--) {
      const p = fxPts[i], u = p.userData, a = p.geometry.attributes.position;
      u.life -= dt;
      for (let k = 0; k < a.count; k++) {
        if (u.kind === 'spark') u.vel[k * 3 + 1] -= 9.8 * dt;
        let y = a.getY(k) + u.vel[k * 3 + 1] * dt;
        if (y < u.floor) { y = u.floor; u.vel[k * 3] *= 0.3; u.vel[k * 3 + 2] *= 0.3; u.vel[k * 3 + 1] = 0; }
        a.setXYZ(k, a.getX(k) + u.vel[k * 3] * dt, y, a.getZ(k) + u.vel[k * 3 + 2] * dt);
      }
      a.needsUpdate = true;
      if (u.life <= 0) { scene.remove(p); p.geometry.dispose(); fxPts.splice(i, 1); }
    }
    flashL.intensity = flashL.intensity < 0.02 ? 0 : flashL.intensity * Math.exp(-dt * 9);
  }
  return { particles, flash, update: updateFx };
}
