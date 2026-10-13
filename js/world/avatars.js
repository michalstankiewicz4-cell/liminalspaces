// Other players: simple box figures with a per-player colour, smoothly interpolated towards the last received pose.
import * as THREE from '../../vendor/three.module.js';

const COLORS = [0x3d7fd8, 0xd8513d, 0x4caf50, 0xc9a227, 0x9c5bd1, 0x2cb8b0, 0xd85fa0, 0x8a8a8a];

function figure(color) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), mat(color));
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(0xd9b48f));
  head.position.y = 1.68;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), mat(0x2a2a30));
  legs.position.y = 0.4;
  // a small glowing marker above the head so players can find each other in dark zones
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color }));
  mark.position.y = 2.05;
  g.add(body, head, legs, mark);
  return g;
}

export function createAvatars(scene) {
  const list = new Map();         // id -> { g, target: {x,y,z,yaw}, color }
  let n = 0;
  return {
    // Updates (or creates) the avatar of player `id`.
    set(id, pose) {
      let a = list.get(id);
      if (!a) {
        const color = COLORS[n++ % COLORS.length];
        a = { g: figure(color), target: { ...pose }, color };
        a.g.position.set(pose.x, pose.y - 1.6, pose.z);
        scene.add(a.g); list.set(id, a);
      }
      Object.assign(a.target, pose);
    },
    remove(id) {
      const a = list.get(id);
      if (!a) return;
      scene.remove(a.g);
      a.g.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } });
      list.delete(id);
    },
    clear() { for (const id of [...list.keys()]) this.remove(id); n = 0; },
    color(id) { const a = list.get(id); return a ? '#' + a.color.toString(16).padStart(6, '0') : '#888'; },
    update(dt) {
      const k = 1 - Math.exp(-12 * dt);
      for (const a of list.values()) {
        const p = a.g.position, t = a.target;
        p.x += (t.x - p.x) * k; p.z += (t.z - p.z) * k; p.y += (t.y - 1.6 - p.y) * k;
        let d = t.yaw - a.g.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.g.rotation.y += d * k;
      }
    },
    get size() { return list.size; },
  };
}
