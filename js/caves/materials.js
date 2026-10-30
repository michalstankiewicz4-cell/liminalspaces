// Materials of the cave world. The rock has no image textures: its colour, grain, strata, veins and small bumps are
// computed in the shader from the world position (3D noise), so nothing repeats however far you walk. Per vertex it
// gets the zone's albedo tint and roughness (attribute `tint`) and the baked light (vertex colours), so the result is
// albedo x baked light, plus real lights: the flashlight and the lamps nearest to you (caves/index.js).
import * as THREE from '../../vendor/three.module.js';

// Light near you is real (point lights with shadows on the nearest lamps); further away it is baked. The baked lamp
// light fades to a little bounce light (uBounce) within uNear..uFar of you, while the real lights fade in: so nothing
// is lit twice. Shared by every material that uses baked light.
export const LIT = {
  uPlayer: { value: new THREE.Vector3() }, uNear: { value: 12 }, uFar: { value: 20 }, uBounce: { value: 0.22 },
};
const LIT_GLSL = `uniform vec3 uPlayer; uniform float uNear, uFar, uBounce;
float bakeW(vec3 p){ return mix(uBounce, 1.0, smoothstep(uNear, uFar, distance(p, uPlayer))); }`;

// Baked light for things other than the rock (props, curtains, steles, pictures): instead of the scene's flat
// ambient light they take the light of their place — amb (ambient) + lamp (the lamps, faded near you as above) —
// as indirect light. pos: where the thing stands.
export function baked(m, amb, lamp, pos) {
  const U = { uAmb: { value: amb }, uLamp: { value: lamp }, uPos: { value: new THREE.Vector3(pos.x, pos.y, pos.z) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LIT, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAmb, uLamp; uniform vec3 uPos;\n' + LIT_GLSL)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse = material.diffuseColor * (uAmb + uLamp * bakeW(uPos));');
  };
  m.customProgramCacheKey = () => 'caveBaked';
  return m;
}

const NOISE = `
float cvH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cvN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cvH(i), cvH(i + vec3(1,0,0)), f.x), mix(cvH(i + vec3(0,1,0)), cvH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cvH(i + vec3(0,0,1)), cvH(i + vec3(1,0,1)), f.x), mix(cvH(i + vec3(0,1,1)), cvH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float cvF(vec3 p){ return cvN(p) * 0.5 + cvN(p * 2.03 + 7.1) * 0.25 + cvN(p * 4.07 + 3.3) * 0.125 + cvN(p * 8.1 + 1.7) * 0.0625; }
`;

export function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.5 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LIT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tint;\nattribute vec3 bake;\nvarying vec4 vTint;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying vec3 vBake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = tint;\nvBake = bake;\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTint;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying vec3 vBake;\n' + LIT_GLSL + NOISE)
      // the vertex colours are light, not colour: they must not dim the real lights (the flashlight) as well
      .replace('#include <color_fragment>', '')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse = material.diffuseColor * (vColor.rgb + vBake * bakeW(vWP));`)
      .replace('#include <map_fragment>', `
        // rock albedo: large blotches, strata along y (bent by noise), fine grain, dark veins, pale specks
        float big = cvF(vWP * 0.18), mid = cvF(vWP * 0.9 + 11.0), fine = cvN(vWP * 6.0);
        float strata = sin(vWP.y * 2.6 + cvF(vWP * 0.12) * 9.0) * 0.5 + 0.5;
        float vn = cvF(vWP * 0.35 + 3.0);
        float vein = smoothstep(0.485, 0.5, vn) * smoothstep(0.515, 0.5, vn);
        vec3 alb = vTint.rgb * (0.68 + big * 0.5) * (0.88 + strata * 0.2) * (0.9 + fine * 0.18);
        alb = mix(alb, alb * 0.6, vein * 0.5);
        alb += step(0.95, cvN(vWP * 11.0)) * 0.02;
        alb = mix(alb, alb * vec3(1.05, 0.98, 0.9), mid * 0.4);
        // carved halls (roughness >= 2): bands and rosettes of reliefs on the walls, coloured inlay on the floor
        if (vTint.a > 1.5) {
          alb = vTint.rgb * (0.94 + fine * 0.06);
          if (vWN.y > 0.6) {
            vec2 c = floor(vWP.xz * 1.25); float h = cvH(vec3(c, 3.0));
            vec3 stone = h < 0.25 ? vec3(0.8, 0.35, 0.3) : h < 0.5 ? vec3(0.3, 0.45, 0.7) : h < 0.75 ? vec3(0.85, 0.75, 0.45) : vec3(0.9, 0.88, 0.84);
            vec2 f = fract(vWP.xz * 1.25); float grout = step(0.94, max(f.x, f.y));
            alb = mix(stone * 0.9, vec3(0.35), grout);
          } else if (vWN.y < -0.5) {
            // ceilings: a coffered grid
            vec2 f = fract(vWP.xz * 0.5); float l = step(0.92, max(f.x, f.y));
            alb *= 1.0 - l * 0.22;
          } else {
            // walls: a frieze of rosettes between gilded lines at shoulder height, carved panels above and below
            float u = dot(vWP.xz, normalize(vec2(vWN.z, -vWN.x) + 1e-4));
            float fy = fract(vWP.y / 2.4);
            float frieze = step(0.48, fy) * step(fy, 0.62);
            float line = smoothstep(0.012, 0.0, abs(fy - 0.48)) + smoothstep(0.012, 0.0, abs(fy - 0.62));
            vec2 rc = vec2(fract(u / 0.8) - 0.5, (fy - 0.55) / 0.14 * 0.5);
            float rr = length(rc);
            float ros = (smoothstep(0.05, 0.0, abs(rr - 0.3)) + smoothstep(0.08, 0.0, rr)) * frieze;
            vec2 pc = vec2(fract(u / 1.6), fy); float panel = (smoothstep(0.02, 0.0, abs(pc.x - 0.04)) + smoothstep(0.012, 0.0, abs(pc.y - 0.08)) + smoothstep(0.012, 0.0, abs(pc.y - 0.42))) * (1.0 - frieze);
            alb = mix(alb, vec3(0.78, 0.6, 0.32), line * 0.8);
            alb = mix(alb, alb * vec3(0.75, 0.82, 0.95), frieze * 0.35);
            alb *= 1.0 - ros * 0.3 - panel * 0.16;
          }
        }
        diffuseColor.rgb *= alb;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp((vTint.a > 1.5 ? vTint.a - 2.0 : vTint.a) * (0.85 + mid * 0.3), 0.42, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // small bumps from the same noise (surface gradient from screen-space derivatives)
        {
          float hgt = cvF(vWP * 2.2) * 0.6 + cvN(vWP * 7.0) * 0.25;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hgt), dhy = dFdy(hgt);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          vec3 nb = normalize(abs(det) * normal - grad * 0.3 * (vTint.a > 1.5 ? 0.15 : vTint.a));
          if (dot(nb, normalize(vViewPosition)) > 0.08 && abs(det) > 1e-12) normal = nb;   // never tip a bump away from the eye (black specks)
        }`);
  };
  return m;
}

// sackcloth for the curtains in the doorways
export function sackcloth() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a7652'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(60,46,28,${0.15 + (y % 6 === 0 ? 0.15 : 0)})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = 'rgba(40,30,18,.12)'; g.fillRect(x, 0, 1, 128); }
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(30,22,12,${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * 128, r() * 128, 4 + r() * 14, 3 + r() * 9, r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide, vertexColors: true });
}
