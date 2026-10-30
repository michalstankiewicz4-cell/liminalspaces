// Skylights of the Great Path world: sunbeams with floating dust, sun exposure under the glass, and the scratching
// episodes' visuals (a dark shape on the glass, the beam dims). Sounds are in audio.js.
import * as THREE from '../../vendor/three.module.js';
import { CS, F } from './grid.js';
import { canvasTexture } from './textures.js';

export function createSkylights(scene, grid, beams) {
  // Sunbeams: soft-edged shafts of light. Each face fades out towards its edges and towards the top and the floor,
  // with slowly drifting procedural streaks (rays) seeded per beam, so no two beams look alike.
  const time = { value: 0 };
  const beamVert = `
    varying vec2 vUv; varying vec3 vW;
    void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const beamFrag = `
    uniform vec3 color; uniform float time, seed;
    varying vec2 vUv; varying vec3 vW;
    float h1(float n) { return fract(sin(n * 127.1 + seed * 311.7) * 43758.5453); }
    float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
    void main() {
      float u = fract(vUv.x * 4.0);                          // across one face, 0..1
      float edge = smoothstep(0.0, 0.28, u) * smoothstep(1.0, 0.72, u);
      float y = vUv.y;                                        // 0 floor .. 1 skylight
      float vert = smoothstep(0.0, 0.18, y) * smoothstep(1.0, 0.92, y) * (0.6 + 0.4 * y);
      // streaks along the beam, drifting slowly; a breath of the whole beam
      float s = 0.55 + 0.45 * n1(vUv.x * 22.0 + time * 0.07) * (0.6 + 0.4 * n1(vUv.x * 9.0 - time * 0.05 + 7.0));
      float breath = 0.85 + 0.15 * sin(time * 0.37 + seed * 6.0);
      float a = edge * vert * s * breath * 2.3;               // the soft edges take light away: make it up
      gl_FragColor = vec4(color * a, 1.0);
    }`;
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { time, size: { value: 3.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `
      attribute float phase; uniform float time, size; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * (0.8 + fract(phase * 7.3) * 1.6) + phase * 6.283), 3.0);  // twinkle
        gl_PointSize = max(1.0, size * projectionMatrix[1][1] / max(0.3, -mv.z));        // ~1.6 cm motes, in render-target pixels
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vec3(1.0, 0.94, 0.8) * vA * 0.75 * (1.0 - r * 4.0), 1.0); }`,
  });
  const dusts = [];
  let beamN = 0;
  function makeBeam(b) {
    let floor = Infinity;
    for (let z = b.z0 + CS / 2; z < b.z1; z += CS) for (let x = b.x0 + CS / 2; x < b.x1; x += CS) floor = Math.min(floor, grid.floorAt(x, z));
    const g = new THREE.Group();
    if (!Number.isFinite(floor) || !Number.isFinite(b.top)) return g;
    const h = b.top - floor, w = b.x1 - b.x0, d = b.z1 - b.z0;
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 1.06, 1, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    const m = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(1, 0.93, 0.78).multiplyScalar(0.11 * b.sun) }, time, seed: { value: (beamN++ * 0.6180339) % 1 } },
      vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    m.color = m.uniforms.color.value;                     // tinted by fades and scratching episodes (see tint)
    const mesh = new THREE.Mesh(geo, m);
    b.mesh = mesh; b.base = 0.11 * b.sun; b.floor = floor; b.fade = 1; b.dim = 1;
    g.userData.beam = b;
    mesh.scale.set(w, h, d);
    mesh.position.set((b.x0 + b.x1) / 2, floor + h / 2, (b.z0 + b.z1) / 2);
    mesh.renderOrder = 3;
    g.add(mesh);
    // floating dust inside the beam
    const n = Math.round(Math.min(400, w * d * h * 2));
    const pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let k = 0; k < n; k++) { pos[k * 3] = b.x0 + Math.random() * w; pos[k * 3 + 1] = floor + Math.random() * h; pos[k * 3 + 2] = b.z0 + Math.random() * d; ph[k] = Math.random(); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
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
  const tint = (b) => { if (b.mesh) b.mesh.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(b.base * b.fade * b.dim); };
  function scratchVisual(ep) {
    if (dimmed) { dimmed.dim = 1; tint(dimmed); }
    dimmed = null;
    if (!ep) { shape.visible = false; return; }
    const { sky, t, dur } = ep, b = sky.beam;
    const k = Math.max(0, Math.min(1, t / 0.8, (dur - t) / 1.2));
    shape.visible = k > 0;
    shape.material.opacity = k;
    shape.position.set(sky.x + Math.sin(t * 0.9) * 0.35, sky.y - 0.03, sky.z + Math.cos(t * 0.6) * 0.25);
    shape.rotation.z = Math.sin(t * 0.4) * 0.5;
    if (b && b.mesh) { dimmed = b; b.dim = 1 - 0.45 * k; tint(b); }
  }

  // floating dust drifts down inside the beams near the player; beams fade out with distance (they ignore fog)
  let fadeT = 0;
  function updateDust(dt, t, pos) {
    time.value = t;
    fadeT -= dt;
    if (fadeT <= 0) {
      fadeT = 0.25;
      for (const b of beams) {
        if (!b.mesh) continue;
        const d = Math.hypot((b.x0 + b.x1) / 2 - pos.x, (b.z0 + b.z1) / 2 - pos.z), k = Math.max(0, Math.min(1, (44 - d) / 18));
        if (Math.abs(k - b.fade) > 0.02) { b.fade = k; tint(b); }
        b.mesh.visible = k > 0;
      }
    }
    for (const p of dusts) {
      if (!p.parent || !p.parent.parent) continue;
      const { b, floor, h } = p.userData.dust, a = p.geometry.attributes.position;
      if (Math.abs((b.x0 + b.x1) / 2 - pos.x) > 30 || Math.abs((b.z0 + b.z1) / 2 - pos.z) > 30) continue;
      // slow swirling drift: each mote sinks at its own speed, sways in x and z, now and then lifts
      for (let k = 0; k < a.count; k++) {
        const sk = 0.6 + ((k * 37) % 11) / 11;
        let y = a.getY(k) - dt * (0.035 * sk - 0.04 * Math.max(0, Math.sin(t * 0.21 + k * 0.7)));
        let x = a.getX(k) + Math.sin(t * 0.5 * sk + k * 1.7) * dt * 0.07;
        let z = a.getZ(k) + Math.cos(t * 0.43 * sk + k * 2.3) * dt * 0.06;
        if (y < floor) y += h; if (y > floor + h) y -= h;
        if (x < b.x0) x = b.x1; if (x > b.x1) x = b.x0;
        if (z < b.z0) z = b.z1; if (z > b.z1) z = b.z0;
        a.setXYZ(k, x, y, z);
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
