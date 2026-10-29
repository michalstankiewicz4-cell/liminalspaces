// The flashlight in the player's hand (first-person view model) and its spot light with shadows.
import * as THREE from '../../vendor/three.module.js';

export function createHand() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.35, metalness: 0.85 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, metalness: 0.1 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95, metalness: 0 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a4436, roughness: 0.95, metalness: 0 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.2, 14), metal);
  body.rotation.x = Math.PI / 2;
  const knurl = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.09, 14), grip);
  knurl.rotation.x = Math.PI / 2; knurl.position.z = 0.03;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.021, 0.06, 16), metal);
  head.rotation.x = Math.PI / 2; head.position.z = -0.12;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), lensMat);
  lens.position.z = -0.151; lens.rotation.y = Math.PI;
  const button = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.016), grip);
  button.position.set(0, 0.021, -0.02);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.1), glove);
  hand.position.set(0.006, -0.008, 0.03);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.06), glove);
  thumb.position.set(-0.03, 0.012, -0.0);
  thumb.rotation.y = 0.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.3), sleeve);
  arm.position.set(0.025, -0.035, 0.22);
  g.add(body, knurl, head, lens, button, hand, thumb, arm);
  g.position.set(0.22, -0.2, -0.42);
  g.rotation.set(0.06, 0.1, 0);
  g.scale.setScalar(0.8);
  for (const m of g.children) m.castShadow = false;

  // the beam: a spot light at the lens with soft shadows
  const spot = new THREE.SpotLight(0xfff1d6, 40, 32, 0.46, 0.55, 2);
  spot.position.set(0.2, -0.17, -0.5);
  spot.target.position.set(0.05, -0.3, -6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.025;
  spot.shadow.camera.near = 0.15;
  spot.shadow.camera.far = 32;
  spot.shadow.radius = 3;

  const mats = [metal, grip, glove, sleeve];
  const base = mats.map((m) => m.color.clone());
  return {
    group: g, spot, lens: lensMat,
    // brightness of the place the hand is in (0..1+) so the view model is not lit in the dark
    setLight(k) { mats.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(Math.max(0.12, Math.min(1.4, k)))); },
    setOn(on) { spot.visible = on; lensMat.color.set(on ? 0xfff4d8 : 0x333028); },
    // gentle sway with the walk
    sway(t, bob, amp) {
      g.position.set(0.22 + Math.sin(bob) * 0.008 * amp, -0.2 - Math.abs(Math.cos(bob)) * 0.01 * amp + Math.sin(t * 1.3) * 0.002, -0.42);
    },
  };
}
