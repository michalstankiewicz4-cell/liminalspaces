// The layered gate at the start of the Great Path (story 01:20): six steel doors that open one after another,
// sliding right, left, up into the ceiling and down into the floor. Closed doors are colliders.
import * as THREE from '../../vendor/three.module.js';
import { H } from './grid.js';

export function createGate(scene, steelBase, gates) {
  const MOVES = ['right', 'left', 'up', 'down', 'right', 'up'];
  const gateDoors = [];
  const steel = steelBase.clone(); steel.vertexColors = false; steel.color.setScalar(0.32);
  for (const gt of gates) for (let i = 0; i < gt.layers; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, gt.w), steel);
    const x = gt.x + 0.15 + i * 0.3;
    m.position.set(x, H / 2, gt.z);
    m.castShadow = m.receiveShadow = true;
    // a raised rim and bolts per door
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, gt.w), steel); rim.position.y = 0.6 - (i % 3) * 0.4; m.add(rim);
    scene.add(m);
    gateDoors.push({ m, x, z: gt.z, w: gt.w, move: MOVES[i % MOVES.length], t0: 0.8 + i * 0.9, k: 0, box: [x - 0.06, 0, gt.z - gt.w / 2, x + 0.06, H, gt.z + gt.w / 2] });
  }
  let gateT = -1;                 // -1 = closed and waiting, >= 0 = opening time
  function setGate(open) {
    gateT = open ? 99 : -1;
    for (const d of gateDoors) applyDoor(d, open ? 1 : 0);
  }
  function applyDoor(d, k) {
    d.k = k;
    const e = k * k * (3 - 2 * k), m = d.m;
    m.position.set(d.x, H / 2, d.z);
    if (d.move === 'right') m.position.z = d.z + e * (d.w + 0.2);
    else if (d.move === 'left') m.position.z = d.z - e * (d.w + 0.2);
    else if (d.move === 'up') m.position.y = H / 2 + e * (H + 0.1);
    else m.position.y = H / 2 - e * (H + 0.1);
  }
  // closed (or not yet open enough) doors as collision boxes, pushed into out (called several times per frame)
  function gateSolids(out) { for (const dr of gateDoors) if (dr.k < 0.85) out.push(dr.box); return out; }
  return {
    set: setGate,
    start() { setGate(false); gateT = 0; },
    update(dt) { if (gateT >= 0 && gateT < 20) { gateT += dt; for (const d of gateDoors) applyDoor(d, Math.max(0, Math.min(1, (gateT - d.t0) / 1.2))); } },
    solids: gateSolids,
  };
}
