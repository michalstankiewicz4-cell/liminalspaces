// The surface (107:27 – 112:00): the roof over the halls — a white, flat, desolate plane under a blue sky with big
// clouds, wind, the sun warm but not burning. A dark bluish building with a domed roof stands on timbers half-way
// between our stair hole and its mirror; under it a plaque covers the floor with carved symbols — a circle with a
// line down the middle and a dot at its midpoint — and one inscription in our language (110:15). Lines in the floor
// run off into the distance. This is its own scene and its own little world for the walker ({ blocked, support }).
import * as THREE from '../../vendor/three.module.js';
import { JX, STAIRS, base, SURFACE_Y } from './journey.js';
import { stairBoxes, stairMesh } from './journey-run.js';
import { canvasTexture } from './textures.js';

export const DOME = { x: (STAIRS.A.hole[1] + STAIRS.B.hole[0]) / 2, z: base(JX.roomA).zc, r: 6.5, under: 5.6 };

export function createSurface(mats) {
  const scene = new THREE.Scene();
  const zc = base(JX.roomA).zc, Y = SURFACE_Y;
  scene.fog = new THREE.Fog(0xdfe9f2, 60, 700);
  scene.background = new THREE.Color(0xdfe9f2);

  /* ---- sky: gradient, big drifting clouds ---- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, side: THREE.BackSide, fog: false, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float time; varying vec3 vP;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += n2(p) * a; p *= 2.02; a *= 0.5; } return s; }
      void main() {
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 c = mix(vec3(0.86, 0.91, 0.95), vec3(0.18, 0.42, 0.82), pow(h, 0.45));
        vec2 uv = vP.xz / max(0.06, vP.y + 0.04) * 0.9 + vec2(time * 0.006, time * 0.002);
        float cl = smoothstep(0.5, 0.72, fbm(uv));
        float shade = smoothstep(0.55, 0.9, fbm(uv * 1.7 + 3.0));
        c = mix(c, mix(vec3(1.0), vec3(0.78, 0.8, 0.85), shade * 0.6), cl * smoothstep(0.0, 0.18, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(680, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  /* ---- light: a bright sun and the white plane bouncing it back ---- */
  scene.add(new THREE.HemisphereLight(0xdde8f6, 0xf2f0ea, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
  sun.position.set(40, 90, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  /* ---- the plane: white panels, seams, lines in the floor; holes for the two staircases ---- */
  const seamTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h);
    const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(5);
    for (let k = 0; k < 900; k++) { const v = 225 + rnd() * 25; g.fillStyle = `rgba(${v},${v},${v - 4},.5)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.strokeStyle = 'rgba(150,150,145,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
  seamTex.wrapS = seamTex.wrapT = THREE.RepeatWrapping;
  const groundMat = new THREE.MeshStandardMaterial({ map: seamTex, roughness: 0.62, metalness: 0 });
  const EXT = 1400, holes = [STAIRS.A.hole, STAIRS.B.hole].sort((a, b) => a[0] - b[0]);
  const rect = (x0, z0, x1, z1) => {
    if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const px = geo.attributes.position.getX(i) + (x0 + x1) / 2, pz = geo.attributes.position.getZ(i) + (z0 + z1) / 2; uv.setXY(i, px / 4, pz / 4); }
    const m = new THREE.Mesh(geo, groundMat); m.position.set((x0 + x1) / 2, Y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  };
  const cx = DOME.x;
  rect(cx - EXT, zc - EXT, cx + EXT, zc - 0.75); rect(cx - EXT, zc + 0.75, cx + EXT, zc + EXT);
  let px = cx - EXT;
  for (const h of holes) { rect(px, zc - 0.75, h[0], zc + 0.75); px = h[1]; }
  rect(px, zc - 0.75, cx + EXT, zc + 0.75);
  // lines marked in the floor that go out into the distance (109:06): along the path below, and at 90° and 45°
  // drawn on the plane with a depth offset (a few mm above it would flicker far away)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x8a8c90, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const line = (a, len, w = 0.14) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), lineMat);
    m.rotation.y = a; m.position.set(cx + Math.cos(a) * (len / 2 + DOME.r + 1), Y + 0.006, zc - Math.sin(a) * (len / 2 + DOME.r + 1));
    scene.add(m);
  };
  for (let k = 0; k < 8; k++) if (k % 4) line(k * Math.PI / 4, EXT, k % 2 ? 0.1 : 0.16);
  // along the hallway below, either side of the hatches
  for (const s of [-1.15, 1.15]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2, 0.16).rotateX(-Math.PI / 2), lineMat); m.position.set(cx, Y + 0.006, zc + s); scene.add(m); }
  // the hatches: a steel rim, a dark pit, the staircase going down
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.45, metalness: 0.8 });
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.95, side: THREE.BackSide });
  const pitWall = (x, z, sx, sz, hgt, yMid) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(sx, sz), hgt), pitMat); m.position.set(x, yMid, z); if (sx < sz) m.rotation.y = Math.PI / 2; scene.add(m); };
  for (const st of [STAIRS.A, STAIRS.B]) {
    const [h0, h1] = st.hole, w = h1 - h0, { f } = base(st.x0);
    for (const [ax, az, sx, sz] of [[h0 + w / 2, zc - 0.8, w + 0.2, 0.1], [h0 + w / 2, zc + 0.8, w + 0.2, 0.1], [h0 - 0.05, zc, 0.1, 1.7], [h1 + 0.05, zc, 0.1, 1.7]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.08, sz), steel); r.position.set(ax, Y + 0.04, az); r.castShadow = true; scene.add(r);
    }
    // the shaft's four walls, 2 cm outside the hole (open top and bottom: nothing lies in the stairs' planes)
    const hh = Y - f, ym = (Y + f) / 2;
    pitWall(h0 + w / 2, zc - 0.77, w + 0.04, 0, hh, ym); pitWall(h0 + w / 2, zc + 0.77, w + 0.04, 0, hh, ym);
    pitWall(h0 - 0.02, zc, 0, 1.54, hh, ym); pitWall(h1 + 0.02, zc, 0, 1.54, hh, ym);
    scene.add(stairMesh(st, mats));
  }

  /* ---- the building: on timbers, a drum with window openings without glass, a dome ---- */
  const blue = new THREE.MeshStandardMaterial({ color: 0x2d3c58, roughness: 0.7, metalness: 0.1 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85 });
  const B = new THREE.Group(); B.position.set(DOME.x, Y, DOME.z);
  const solids = [];
  const postAt = (x, z, w = 0.3) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 3.3, w), timber); p.position.set(x, 1.65, z); p.castShadow = p.receiveShadow = true; B.add(p);
    solids.push([DOME.x + x - w / 2, Y, DOME.z + z - w / 2, DOME.x + x + w / 2, Y + 3.3, DOME.z + z + w / 2]);
  };
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; postAt(Math.cos(a) * 5.9, Math.sin(a) * 5.9, 0.34); }
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.26; postAt(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0.26); }
  // beams under the floor of the drum, criss-cross
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.22, 0.2), timber); b.rotation.y = k * Math.PI / 6; b.position.y = 3.2; b.castShadow = true; B.add(b); }
  const under = new THREE.Mesh(new THREE.CircleGeometry(DOME.r, 40).rotateX(Math.PI / 2), timber); under.position.y = 3.3; B.add(under);
  // the drum: 8 wall pieces between 8 window openings
  const drumH = 2.8, y0 = 3.3;
  for (let k = 0; k < 8; k++) {
    const a0 = k * Math.PI / 4, seg = new THREE.Mesh(new THREE.CylinderGeometry(DOME.r, DOME.r, drumH, 6, 1, true, a0, Math.PI / 4 * 0.55), blue);
    seg.material.side = THREE.DoubleSide; seg.position.y = y0 + drumH / 2; seg.castShadow = true; B.add(seg);
    for (const [hh, yy] of [[0.7, y0 + 0.35], [0.5, y0 + drumH - 0.25]]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(DOME.r, DOME.r, hh, 6, 1, true, a0 + Math.PI / 4 * 0.55, Math.PI / 4 * 0.45), blue);
      band.position.y = yy; B.add(band);
    }
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME.r, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), blue);
  dome.position.y = y0 + drumH; dome.castShadow = true; B.add(dome);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), blue); tip.position.y = y0 + drumH + DOME.r + 0.5; B.add(tip);
  // the plaque covering the footprint: an army of carved symbols; in the centre a circle, a line down the middle,
  // a dot at its midpoint (108:53); one inscription in our language
  const plaqueTex = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#7d7a72'; g.fillRect(0, 0, w, h);
    const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(23);
    g.fillStyle = 'rgba(40,38,34,.55)'; g.font = '15px monospace';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ⊕⊗⊘⊙⌬⍟◬◭◮⧫⟁⟐⟡∴∵≡≣⊞⊟⊠⊡';
    for (let y = 30; y < h; y += 22) {
      let x = 20;
      while (x < w - 20) { const ch = glyphs[(rnd() * glyphs.length) | 0]; g.fillText(ch, x, y); x += 12 + rnd() * 6; }
    }
    g.fillStyle = '#7d7a72'; g.beginPath(); g.arc(w / 2, h / 2, 250, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2c2a26'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, 220, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w / 2, h / 2 - 220); g.lineTo(w / 2, h / 2 + 220); g.stroke();
    g.fillStyle = '#2c2a26'; g.beginPath(); g.arc(w / 2, h / 2, 14, 0, Math.PI * 2); g.fill();
    // our language, small, below the circle (the full text is shown in the HUD)
    g.fillStyle = '#7d7a72'; g.fillRect(w / 2 - 300, h / 2 + 262, 600, 70);
    g.fillStyle = '#26241f'; g.font = 'bold 22px serif'; g.textAlign = 'center';
    g.fillText('YOU ARE AT THE HALF-WAY POINT OF THIS DESIGN — 20', w / 2, h / 2 + 290);
    g.font = '18px serif'; g.fillText('CODENAME: "RAT MAZE"   ·   CONGRATULATIONS TRAVELER', w / 2, h / 2 + 318);
  });
  const plaque = new THREE.Mesh(new THREE.CircleGeometry(DOME.r - 0.3, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: plaqueTex, emissiveMap: plaqueTex, emissive: 0x6a6a66, roughness: 0.8, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
  plaque.position.y = 0.012; plaque.receiveShadow = true; B.add(plaque);
  scene.add(B);

  /* ---- the walker's world up here ---- */
  const stairs = [stairBoxes(STAIRS.A), stairBoxes(STAIRS.B)];
  const inHoleBox = (x0, z0, x1, z1) => {
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    return holes.some((h) => x > h[0] && x < h[1] && Math.abs(z - zc) < 0.75);
  };
  const world = {
    blocked(x0, z0, x1, z1, y0, y1) {
      for (const b of solids) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1 && b[4] > y0 + 1e-4 && b[1] < y1) return true;
      for (const list of stairs) for (const b of list) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1 && b[4] > y0 + 1e-4 && b[1] < y1) return true;
      return false;
    },
    support(x0, z0, x1, z1, yMax) {
      let s = -Infinity;
      if (!inHoleBox(x0, z0, x1, z1) && Y <= yMax + 1e-4) s = Y;
      for (const list of stairs) for (const b of list) if (b[3] > x0 && b[0] < x1 && b[5] > z0 && b[2] < z1 && b[4] <= yMax + 1e-4 && b[4] > s) s = b[4];
      return s;
    },
  };

  return {
    scene, world,
    // under the dome, close to the centre: the inscription can be read
    underDome: (p) => Math.hypot(p.x - DOME.x, p.z - DOME.z) < DOME.under,
    update(dt, time, pos) {
      skyMat.uniforms.time.value = time;
      sky.position.set(pos.x, Y, pos.z);
      sun.position.set(pos.x + 40, Y + 90, pos.z + 25); sun.target.position.set(pos.x, Y, pos.z);
    },
  };
}
