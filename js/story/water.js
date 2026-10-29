// Moving water of the Great Path journey (89:54 – 90:46): blue water with white foam flowing under the glass path,
// and, through the opening in the wall, the open air: an ocean flowing violently to the horizon under a sky with
// clouds. Shaders only (no textures); built when the player comes near, hidden when far.
import * as THREE from '../../vendor/three.module.js';

const NOISE = `
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += n2(p) * a; p *= 2.03; a *= 0.5; } return s; }
`;

function waterMaterial({ flow, scale, deep, shallow, foam, haze }) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, flow: { value: new THREE.Vector2(...flow) }, scale: { value: scale }, deep: { value: new THREE.Color(...deep) },
      shallow: { value: new THREE.Color(...shallow) }, foamC: { value: new THREE.Color(...foam) }, haze: { value: new THREE.Color(...(haze || deep)) }, hazeK: { value: haze ? 1 : 0 } },
    vertexShader: `
      uniform float time; uniform vec2 flow; uniform float scale; varying vec2 vW; varying float vD;
      ${NOISE}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 q = w.xz * scale + flow * time;
        w.y += (fbm(q * 0.6) - 0.5) * 0.35 / scale * 0.08;
        vW = w.xz; vec4 mv = viewMatrix * w; vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float time; uniform vec2 flow; uniform float scale; uniform vec3 deep, shallow, foamC, haze; uniform float hazeK;
      varying vec2 vW; varying float vD;
      ${NOISE}
      void main() {
        vec2 q = vW * scale + flow * time;
        float a = fbm(q), b = fbm(q * 2.7 + vec2(3.1, 1.7) - flow * time * 0.6);
        vec3 c = mix(deep, shallow, smoothstep(0.35, 0.75, a));
        float f = smoothstep(0.62, 0.78, b * 0.7 + a * 0.45);
        c = mix(c, foamC, f);
        c = mix(c, haze, hazeK * smoothstep(40.0, 290.0, vD));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time; varying vec3 vP;
      ${NOISE}
      void main() {
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 c = mix(vec3(0.78, 0.86, 0.92), vec3(0.28, 0.5, 0.85), pow(h, 0.55));
        vec2 uv = vP.xz / max(0.08, vP.y) * 1.4 + vec2(time * 0.01, 0.0);
        float cl = smoothstep(0.52, 0.78, fbm(uv));
        c = mix(c, vec3(0.97), cl * smoothstep(0.02, 0.2, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, fog: false, depthWrite: false,
  });
}

export function createWater(scene, list) {
  const made = new Map();          // entry -> group
  const mats = [];
  function build(e) {
    const g = new THREE.Group();
    const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2, w = e.x1 - e.x0, d = e.z1 - e.z0;
    // the sides of the channel / pit under the walkable floor
    const sides = (depth, mat) => {
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), mat);
        p.position.set(cx, e.top - depth / 2, cz + s * d / 2); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p);
      }
    };
    if (e.kind === 'channel') {
      const m = waterMaterial({ flow: [0.9, 0.05], scale: 0.55, deep: [0.02, 0.18, 0.42], shallow: [0.1, 0.45, 0.8], foam: [0.85, 0.92, 1.0] });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2), m);
      mesh.position.set(cx, e.y, cz);
      g.add(mesh); mats.push(m);
      sides(e.top - e.y + 0.05, new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.6 }));
    } else if (e.kind === 'pit') {
      // the abyss under the grate (91:07): walls fading into black, no bottom in sight
      const wall = new THREE.MeshStandardMaterial({ color: 0x4a4844, roughness: 0.95 });
      sides(e.top - e.y, wall);
      const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      bottom.position.set(cx, e.y, cz); g.add(bottom);
    } else {
      // the ocean to the horizon and the sky
      const m = waterMaterial({ flow: [0.18, 0.35], scale: 0.05, deep: [0.02, 0.16, 0.38], shallow: [0.08, 0.38, 0.7], foam: [0.92, 0.96, 1.0], haze: [0.72, 0.82, 0.9] });
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 96, 96).rotateX(-Math.PI / 2), m);
      sea.position.set(e.x, e.y, e.z - 280);
      const sm = skyMaterial();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), sm);
      sky.position.set(e.x, e.y, e.z); sky.renderOrder = -1;
      g.add(sea, sky); mats.push(m, sm);
    }
    scene.add(g);
    return g;
  }
  return {
    update(dt, time, pos) {
      for (const e of list) {
        const cx = e.kind === 'ocean' ? e.x : (e.x0 + e.x1) / 2, d = Math.abs(cx - pos.x);
        let g = made.get(e);
        if (!g && d < (e.kind === 'ocean' ? 90 : 220)) { g = build(e); made.set(e, g); }
        if (g) g.visible = d < (e.kind === 'ocean' ? 90 : 260);     // the ocean must not show down the abyss further on
      }
      for (const m of mats) m.uniforms.time.value = time;
    },
  };
}
