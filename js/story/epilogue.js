// The ending (1:51:47 – 1:53:12): Rudon lies on his back and stares at the sky; then the view rises above him — a black
// speck on a white sheet — up through the clouds, until the plane curves into a white sphere in an endless black
// void, circled by machines in low orbit; and ships appear out of the darkness, first a few, then more and more,
// and speed towards the planet. A cut scene with its own scenes and camera; text lines come from i18n.
import * as THREE from '../../vendor/three.module.js';

const LINES = [[0.5, 'gp.e.1'], [7, 'gp.e.2'], [15, 'gp.e.3'], [24, 'gp.e.4'], [33, 'gp.e.5']];
export const EPILOGUE_LENGTH = 44;

export function createEpilogue() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 40000);
  /* ---- 1: the white plane from above, clouds ---- */
  const plane = new THREE.Scene();
  plane.background = new THREE.Color(0x8fb4e0);
  plane.fog = new THREE.Fog(0xcfe0f0, 2000, 14000);
  plane.add(new THREE.HemisphereLight(0xe8f0ff, 0xffffff, 2.2));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.9 }));
  plane.add(ground);
  const speck = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 8).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  speck.position.y = 0.25; plane.add(speck);
  // faint lines in the floor
  for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(60000, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8c8c4 })); l.rotation.y = k * Math.PI / 4; l.position.y = 0.02; plane.add(l); }
  const cloudTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
  })();
  const clouds = new THREE.Group(); plane.add(clouds);
  let s = 9;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 160; k++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
    const sc = 300 + rnd() * 700; m.scale.set(sc, sc * 0.6, 1);
    m.position.set((rnd() - 0.5) * 9000, 900 + rnd() * 500, (rnd() - 0.5) * 9000);
    clouds.add(m);
  }

  /* ---- 2: the sphere in the void, machines, ships ---- */
  const space = new THREE.Scene();
  space.background = new THREE.Color(0x000000);
  const R = 100;
  const sunL = new THREE.DirectionalLight(0xffffff, 3); sunL.position.set(300, 120, 200); space.add(sunL, new THREE.AmbientLight(0xffffff, 0.12));
  const marble = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.85 }));
  space.add(marble);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 64, 32), new THREE.MeshBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.12, side: THREE.BackSide }));
  space.add(atmo);
  const stars = new THREE.BufferGeometry(), sp = new Float32Array(3000 * 3);
  for (let k = 0; k < 3000; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(9000); sp.set([v.x, v.y, v.z], k * 3); }
  stars.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  space.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
  // machines in low orbit: boxes with panels on rings at different tilts
  const machines = [];
  const mm = new THREE.MeshStandardMaterial({ color: 0x9a9ea6, metalness: 0.7, roughness: 0.4 }), pm = new THREE.MeshStandardMaterial({ color: 0x223a6a, metalness: 0.4, roughness: 0.3 });
  for (let k = 0; k < 36; k++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 2.2), mm));
    const p = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 1.4), pm); g.add(p);
    const pivot = new THREE.Group(); pivot.rotation.set(rnd() * Math.PI, rnd() * Math.PI, 0);
    g.position.x = R * (1.12 + rnd() * 0.08); pivot.add(g); space.add(pivot);
    machines.push({ pivot, speed: 0.05 + rnd() * 0.05, a: rnd() * 6.3 });
  }
  // ships: dark wedges with a light, appearing from the darkness and speeding towards the planet
  const shipGeo = new THREE.ConeGeometry(2.6, 11, 4).rotateX(Math.PI / 2);
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x5a606c, metalness: 0.6, roughness: 0.45, emissive: 0x1a2430 });
  const MAXS = 420;
  const ships = new THREE.InstancedMesh(shipGeo, shipMat, MAXS); ships.count = 0; ships.frustumCulled = false;
  space.add(ships);
  const glows = new THREE.InstancedMesh(new THREE.SphereGeometry(1.4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbfe2ff }), MAXS); glows.count = 0; glows.frustumCulled = false;
  space.add(glows);
  const fleet = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zf = new THREE.Vector3(0, 0, 1);

  let T = 0, active = false, lineI = 0;
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  return {
    camera,
    get active() { return active; },
    start() { T = 0; active = true; lineI = 0; fleet.length = 0; ships.count = 0; glows.count = 0; },
    stop() { active = false; },
    // returns { scene, fade: [css colour, alpha], line: i18n key or null, done }
    update(dt, aspect) {
      T += dt;
      camera.aspect = aspect; camera.updateProjectionMatrix();
      let line = null;
      if (lineI < LINES.length && T >= LINES[lineI][0]) line = LINES[lineI++][1];
      let fade = ['#fff', 0], scene = plane;
      if (T < 20) {
        // lying, looking up (0-6 s), then rising, looking down
        if (T < 6) { camera.position.set(0, 0.35, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 100, 0); fade = ['#000', Math.max(0, 1 - T / 1.5)]; }
        else {
          const k = ease((T - 6) / 13), h = 0.6 * Math.pow(9000 / 0.6, k);
          camera.position.set(0, h, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
          clouds.position.y = 0;
          if (T > 18.5) fade = ['#fff', (T - 18.5) / 1.5];
        }
      } else {
        scene = space;
        if (T < 21.5) fade = ['#fff', 1 - (T - 20) / 1.5];
        const k = ease((T - 20) / 14);
        const dist = lerp(R * 1.6, R * 4.2, k), a = 0.4 + T * 0.02;
        camera.up.set(0, 1, 0);
        camera.position.set(Math.sin(a) * dist, lerp(R * 0.4, R * 1.1, k), Math.cos(a) * dist);
        camera.lookAt(0, 0, 0);
        for (const m of machines) { m.a += dt * m.speed; m.pivot.children[0].position.set(Math.cos(m.a) * R * 1.16, 0, Math.sin(m.a) * R * 1.16); }
        // the fleet: first a few, then more and more (from 26 s)
        if (T > 25.5) {
          const want = Math.min(MAXS, Math.floor(Math.pow(T - 25.5, 2.4) * 2.2));
          while (fleet.length < want) {
            const dir = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.6, rnd() - 0.5).normalize();
            fleet.push({ p: dir.clone().multiplyScalar(R * (7 + rnd() * 5)), v: 40 + rnd() * 60 });
          }
          ships.count = glows.count = fleet.length;
          fleet.forEach((f, i) => {
            const to = v.copy(f.p).multiplyScalar(-1).normalize();
            if (f.p.length() > R * 1.35) f.p.addScaledVector(to, f.v * dt * (1 + (T - 26) * 0.08));
            q.setFromUnitVectors(zf, to);
            m4.compose(f.p, q, one); ships.setMatrixAt(i, m4);
            m4.compose(v.copy(f.p).addScaledVector(to, -6), q, one); glows.setMatrixAt(i, m4);
          });
          ships.instanceMatrix.needsUpdate = true; glows.instanceMatrix.needsUpdate = true;
        }
        if (T > EPILOGUE_LENGTH - 3) fade = ['#000', (T - (EPILOGUE_LENGTH - 3)) / 3];
      }
      const done = T >= EPILOGUE_LENGTH;
      if (done) active = false;
      return { scene, fade, line, done };
    },
  };
}
