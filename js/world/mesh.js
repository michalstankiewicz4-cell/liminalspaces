// Geometry builder: collects subdivided faces into per-material buckets and turns them into BufferGeometry.
// Vertex colours carry baked lighting (see shade() in chunks.js), so the world looks lit without real lights.
import * as THREE from '../../vendor/three.module.js';

export class MeshBuilder {
  constructor() { this.buckets = new Map(); }

  bucket(name) {
    let b = this.buckets.get(name);
    if (!b) { b = { p: [], n: [], uv: [], c: [], i: [] }; this.buckets.set(name, b); }
    return b;
  }

  // Rectangle O + a*U + b*V (a, b in [0, 1]) with normal nrm, subdivided su x sv.
  // uv(x, y, z, a, b) -> [u, v]; col(x, y, z) -> [r, g, b].
  face(name, O, U, V, nrm, su, sv, uv, col) {
    const b = this.bucket(name), base = b.p.length / 3;
    for (let j = 0; j <= sv; j++) for (let k = 0; k <= su; k++) {
      const a = k / su, c = j / sv;
      const x = O[0] + U[0] * a + V[0] * c, y = O[1] + U[1] * a + V[1] * c, z = O[2] + U[2] * a + V[2] * c;
      b.p.push(x, y, z); b.n.push(nrm[0], nrm[1], nrm[2]);
      const t = uv(x, y, z, a, c); b.uv.push(t[0], t[1]);
      const cc = col(x, y, z); b.c.push(cc[0], cc[1], cc[2]);
    }
    // winding so that the front face points along nrm
    const cx = U[1] * V[2] - U[2] * V[1], cy = U[2] * V[0] - U[0] * V[2], cz = U[0] * V[1] - U[1] * V[0];
    const flip = cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0;
    const row = su + 1;
    for (let j = 0; j < sv; j++) for (let k = 0; k < su; k++) {
      const q = base + j * row + k, r = q + 1, s = q + row, t = s + 1;
      if (flip) b.i.push(q, s, r, r, s, t); else b.i.push(q, r, s, r, t, s);
    }
  }

  // Axis-aligned box. opt: { uv: 'world' | 'local', scale (metres per texture repeat), seg (max segment length),
  // skip: Set of face names 'px','nx','py','ny','pz','nz', col: (x,y,z) -> rgb }
  box(name, x0, y0, z0, x1, y1, z1, opt) {
    const sc = opt.scale || 1, seg = opt.seg || 100, skip = opt.skip;
    const n = (len) => Math.max(1, Math.ceil(len / seg - 1e-6));
    const W = x1 - x0, Hh = y1 - y0, D = z1 - z0;
    const world = opt.uv !== 'local';
    const uvX = world ? (x, y, z) => [z / sc, y / sc] : (x, y, z, a, b) => [a, b];
    const uvZ = world ? (x, y, z) => [x / sc, y / sc] : (x, y, z, a, b) => [a, b];
    const uvY = world ? (x, y, z) => [x / sc, z / sc] : (x, y, z, a, b) => [a, b];
    const col = opt.col;
    if (!skip || !skip.has('px')) this.face(name, [x1, y0, z1], [0, 0, -D], [0, Hh, 0], [1, 0, 0], n(D), n(Hh), uvX, col);
    if (!skip || !skip.has('nx')) this.face(name, [x0, y0, z0], [0, 0, D], [0, Hh, 0], [-1, 0, 0], n(D), n(Hh), uvX, col);
    if (!skip || !skip.has('pz')) this.face(name, [x0, y0, z1], [W, 0, 0], [0, Hh, 0], [0, 0, 1], n(W), n(Hh), uvZ, col);
    if (!skip || !skip.has('nz')) this.face(name, [x1, y0, z0], [-W, 0, 0], [0, Hh, 0], [0, 0, -1], n(W), n(Hh), uvZ, col);
    if (!skip || !skip.has('py')) this.face(name, [x0, y1, z1], [W, 0, 0], [0, 0, -D], [0, 1, 0], n(W), n(D), uvY, col);
    if (!skip || !skip.has('ny')) this.face(name, [x0, y0, z0], [W, 0, 0], [0, 0, D], [0, -1, 0], n(W), n(D), uvY, col);
  }

  // Builds one THREE.Mesh per bucket (materials: name -> Material) inside a Group.
  build(materials) {
    const group = new THREE.Group();
    for (const [name, b] of this.buckets) {
      if (!b.i.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.setIndex(b.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, materials[name]);
      m.matrixAutoUpdate = false;
      if (name === 'water') m.renderOrder = 2;
      m.castShadow = m.receiveShadow = !materials[name].isMeshBasicMaterial;
      group.add(m);
    }
    return group;
  }
}

// Disposes all geometries of a group built by MeshBuilder.build (materials are shared and kept).
export function disposeGroup(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
