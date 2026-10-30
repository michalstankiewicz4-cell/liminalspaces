// Materials of the cave world. The rock has no image textures: its colour, grain, strata, veins and small bumps are
// computed in the shader from the world position (3D noise), so nothing repeats however far you walk. Per vertex it
// gets the zone's albedo tint and roughness (attribute `tint`) and the baked light (vertex colours), so the result is
// albedo x baked light (with an ambient light of PI in the scene), plus the real flashlight.
import * as THREE from '../../vendor/three.module.js';

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
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tint;\nvarying vec4 vTint;\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = tint;\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTint;\nvarying vec3 vWP;\n' + NOISE)
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
        diffuseColor.rgb *= alb;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp(vTint.a * (0.85 + mid * 0.3), 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // small bumps from the same noise (surface gradient from screen-space derivatives)
        {
          float hgt = cvF(vWP * 2.2) * 0.6 + cvN(vWP * 7.0) * 0.25;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hgt), dhy = dFdy(hgt);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          vec3 nb = normalize(abs(det) * normal - grad * 0.3 * vTint.a);
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
