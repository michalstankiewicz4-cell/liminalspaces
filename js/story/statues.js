// Statues of the story's scenes: pale stone figures in poses, with faint, broken (dashed) outlines, grouped in
// tableaux at the places where the scenes happen. Each tableau stands with a brass plaque (see layout.js) and is a
// step of the story guide. Figures are built from capsules and spheres in a joint hierarchy and added to the scene
// only when the player is near.
import * as THREE from '../../vendor/three.module.js';

/* ---- poses: arm [forward, outward, elbow], leg [forward, knee], lean, head [pitch, yaw], seat height / lying ---- */
const P = {
  stand: { aL: [0, 0.08, 0.15], aR: [0, 0.08, 0.15] },
  walk: { aL: [-0.35, 0.06, 0.2], aR: [0.35, 0.06, 0.25], lL: [0.35, 0.1], lR: [-0.3, 0.35] },
  point: { aL: [0, 0.08, 0.15], aR: [1.45, 0.1, 0], head: [-0.1, 0] },
  lookUp: { aL: [0.1, 0.1, 0.2], aR: [0.1, 0.1, 0.2], head: [-0.65, 0] },
  read: { aL: [0.55, 0.05, 1.45], aR: [0.55, 0.05, 1.45], head: [0.45, 0] },
  cup: { aL: [0, 0.1, 0.1], aR: [0.45, 0.25, 2.2], head: [0.05, 0], lean: 0.05 },
  limp: { aL: [0, 0.04, 0], aR: [0, 0.1, 0.25], head: [0.45, 0], lean: 0.06 },
  shock: { aL: [0.55, 0.25, 2.35], aR: [0.55, 0.25, 2.35], head: [0.15, 0], lean: -0.05 },
  defend: { aL: [0.2, 0.1, 0.6], aR: [1.05, 0.05, 0.6], head: [-0.05, 0], lean: -0.08 },
  bow: { aL: [0.2, 0.05, 0.1], aR: [0.2, 0.05, 0.1], head: [0.45, 0], lean: 0.6 },
  kneel: { aL: [0.3, 0.05, 0.4], aR: [0.3, 0.05, 0.4], lL: [1.57, 1.57], lR: [-0.05, 1.6], lean: 0.25, head: [0.3, 0], drop: 0.47 },
  teach: { aL: [0.1, 0.1, 0.3], aR: [1.25, 0.35, 0.3], head: [0, 0.5] },
  guard: { aL: [0.15, 0.4, 1.6], aR: [0.15, 0.4, 1.6], head: [0.35, 0] },
  sit: { aL: [0.55, 0.08, 0.7], aR: [0.55, 0.08, 0.7], lL: [1.5, 1.5], lR: [1.5, 1.5], seat: 0.46 },
  sitDesk: { aL: [0.9, 0.05, 1.0], aR: [0.9, 0.05, 1.0], lL: [1.5, 1.5], lR: [1.5, 1.5], seat: 0.46, head: [0.25, 0] },
  sitTalk: { aL: [0.55, 0.08, 0.7], aR: [0.7, 0.15, 1.3], lL: [1.5, 1.5], lR: [1.5, 1.5], seat: 0.46, head: [-0.05, 0] },
  sitLow: { aL: [0.55, 0.08, 0.7], aR: [0.55, 0.08, 0.7], lL: [1.2, 1.9], lR: [1.3, 2.0], seat: 0.3, head: [0.4, 0], lean: 0.25 },
  chalk: { aL: [0, 0.08, 0.15], aR: [1.55, 0.05, 0.55], head: [-0.1, 0] },
  scoop: { aL: [0.6, 0.1, 0.3], aR: [1.3, 0.05, 0.25], lL: [0.35, 0.6], lR: [0.2, 0.5], lean: 0.75, head: [0.2, 0], drop: 0.08 },
  talk: { aL: [0.1, 0.08, 0.2], aR: [0.55, 0.2, 1.05], head: [-0.05, 0] },
  climb: { aL: [2.7, 0.15, 0.2], aR: [2.4, 0.2, 0.3], lL: [1.0, 1.4], lR: [-0.1, 0.1], lean: 0.15, head: [-0.4, 0] },
  backHands: { aL: [-0.35, 0.05, 1.2], aR: [-0.35, 0.05, 1.2], head: [0.05, 0] },
  fallen: { aL: [0.3, 0.9, 0.3], aR: [-0.2, 0.5, 0.6], lL: [0.15, 0.2], lR: [-0.1, 0.5], head: [0, 0.6], lie: true },
  crossed: { aL: [0.6, 0.05, 2.0], aR: [0.6, 0.05, 2.0], head: [0.1, 0] },
};

/* ---- shared geometry: figures of the same size reuse their parts and outlines (never disposed, a few hundred KB) ---- */
const geoCache = new Map(), edgeCache = new WeakMap();
function geom(kind, args, make) {
  const key = kind + ':' + args.map((v) => +(+v).toFixed(4)).join(',');
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
function edgesOf(geo) {
  let e = edgeCache.get(geo);
  if (!e) {
    // dashed outline: line distances baked into the geometry once
    e = new THREE.EdgesGeometry(geo, 28);
    const tmp = new THREE.LineSegments(e); tmp.computeLineDistances();
    edgeCache.set(geo, e);
  }
  return e;
}

/* ---- figures: s = size (adult 1, teen 0.9, child 0.76), g = girth ---- */
function humanoid(o, mat, line) {
  const s = o.s || 1, g = o.g || 1, pose = P[o.pose] || P.stand;
  const root = new THREE.Group();
  const add = (parent, geo, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    const e = new THREE.LineSegments(edgesOf(geo), line);
    m.add(e);
    parent.add(m); return m;
  };
  const cap = (r, len) => geom('limb', [r, len], () => new THREE.CapsuleGeometry(r, len, 3, 8).translate(0, -len / 2 - r * 0.2, 0));
  const hips = new THREE.Group();
  hips.position.y = (pose.seat ? pose.seat + 0.06 : 0.92 * s) - (pose.drop || 0) * s;
  root.add(hips);
  // torso
  const torso = new THREE.Group(); torso.rotation.x = pose.lean || 0; hips.add(torso);
  add(torso, geom('Capsule', [0.15 * s, 0.3 * s, 3, 10], () => new THREE.CapsuleGeometry(0.15 * s, 0.3 * s, 3, 10)), 0, 0.27 * s, 0, 1.2 * g, 1, 0.78 * g);
  add(torso, geom('Sphere', [0.135 * s * g, 10, 8], () => new THREE.SphereGeometry(0.135 * s * g, 10, 8)), 0, 0.02 * s, 0, 1.15, 0.7, 0.85);       // pelvis
  // head and neck
  const head = new THREE.Group(); head.position.y = 0.56 * s; torso.add(head);
  if (pose.head) { head.rotation.x = pose.head[0]; head.rotation.y = pose.head[1]; }
  add(head, geom('Cylinder', [0.045 * s, 0.055 * s, 0.1 * s, 8], () => new THREE.CylinderGeometry(0.045 * s, 0.055 * s, 0.1 * s, 8)), 0, 0.03 * s, 0);
  add(head, geom('Sphere', [0.105 * s, 12, 10], () => new THREE.SphereGeometry(0.105 * s, 12, 10)), 0, 0.17 * s, 0.01 * s, 0.92, 1.15, 1);
  if (o.hair === 'long') add(head, geom('Capsule', [0.09 * s, 0.16 * s, 3, 8], () => new THREE.CapsuleGeometry(0.09 * s, 0.16 * s, 3, 8)), 0, 0.12 * s, -0.06 * s, 1.15, 1, 0.7);
  if (o.hair === 'short') add(head, geom('Sphere', [0.11 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2], () => new THREE.SphereGeometry(0.11 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), 0, 0.19 * s, 0, 0.95, 1, 1.05);
  // arms
  const arms = {};
  for (const [side, sign, key] of [['L', 1, 'aL'], ['R', -1, 'aR']]) {
    const [fwd, out, bend] = pose[key] || [0, 0.08, 0.15];
    const sh = new THREE.Group(); sh.position.set(sign * 0.2 * s * g, 0.47 * s, 0); torso.add(sh);
    sh.rotation.x = -fwd; sh.rotation.z = sign * out;
    add(sh, cap(0.052 * s * g, 0.24 * s), 0, 0, 0);
    const el = new THREE.Group(); el.position.y = -0.3 * s; sh.add(el); el.rotation.x = -bend;
    add(el, cap(0.043 * s * g, 0.21 * s), 0, 0, 0);
    const hand = new THREE.Group(); hand.position.y = -0.27 * s; el.add(hand);
    add(hand, geom('Sphere', [0.045 * s, 8, 6], () => new THREE.SphereGeometry(0.045 * s, 8, 6)), 0, -0.02 * s, 0, 0.8, 1.1, 0.6);
    arms[side] = hand;
  }
  // legs
  for (const [sign, key] of [[1, 'lL'], [-1, 'lR']]) {
    const [fwd, knee] = pose[key] || [0, 0.04];
    const hp = new THREE.Group(); hp.position.set(sign * 0.095 * s * g, 0, 0); hips.add(hp);
    hp.rotation.x = -fwd;
    add(hp, cap(0.07 * s * g, 0.34 * s), 0, 0, 0);
    const kn = new THREE.Group(); kn.position.y = -0.45 * s; hp.add(kn); kn.rotation.x = knee;
    add(kn, cap(0.056 * s * g, 0.34 * s), 0, 0, 0);
    const ft = new THREE.Group(); ft.position.y = -0.45 * s; kn.add(ft); ft.rotation.x = -knee + fwd - (pose.seat ? 0 : 0);
    add(ft, geom('Box', [0.09 * s, 0.06 * s, 0.24 * s], () => new THREE.BoxGeometry(0.09 * s, 0.06 * s, 0.24 * s)), 0, -0.01 * s, 0.06 * s);
  }
  if (o.robe) add(hips, geom('Cylinder', [0.2 * s * g, 0.36 * s * g, 0.86 * s, 12, 1, true], () => new THREE.CylinderGeometry(0.2 * s * g, 0.36 * s * g, 0.86 * s, 12, 1, true)), 0, -0.45 * s, 0);
  // held and worn things
  const it = o.items || [];
  if (it.includes('backpack')) add(torso, geom('Box', [0.34 * s, 0.42 * s, 0.18 * s], () => new THREE.BoxGeometry(0.34 * s, 0.42 * s, 0.18 * s)), 0, 0.3 * s, -0.2 * s * g);
  if (it.includes('bigpack')) add(torso, geom('Box', [0.42 * s, 0.6 * s, 0.26 * s], () => new THREE.BoxGeometry(0.42 * s, 0.6 * s, 0.26 * s)), 0, 0.3 * s, -0.24 * s * g);
  if (it.includes('vest')) add(torso, geom('Box', [0.4 * s * g, 0.34 * s, 0.3 * s * g], () => new THREE.BoxGeometry(0.4 * s * g, 0.34 * s, 0.3 * s * g)), 0, 0.3 * s, 0);
  if (it.includes('holster')) add(hips, geom('Box', [0.06, 0.16, 0.1], () => new THREE.BoxGeometry(0.06, 0.16, 0.1)), -0.22 * s * g, -0.05, 0);
  if (it.includes('skateboard')) add(arms.L, geom('Box', [0.2, 0.78, 0.025], () => new THREE.BoxGeometry(0.2, 0.78, 0.025)), 0, -0.36, 0.03);
  if (it.includes('notebook')) add(arms.R, geom('Box', [0.16, 0.02, 0.22], () => new THREE.BoxGeometry(0.16, 0.02, 0.22)), -0.08 * s, -0.04, 0.06);
  if (it.includes('slip')) add(arms.R, geom('Box', [0.2, 0.004, 0.26], () => new THREE.BoxGeometry(0.2, 0.004, 0.26)), -0.1 * s, -0.04, 0.04);
  if (it.includes('cup')) add(arms.R, geom('Cylinder', [0.04, 0.035, 0.09, 10], () => new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10)), 0, -0.05, 0.04);
  if (it.includes('ruler')) add(arms.L, geom('Box', [0.03, 0.6, 0.006], () => new THREE.BoxGeometry(0.03, 0.6, 0.006)), 0, -0.25, 0.03);
  if (it.includes('chalk')) add(arms.R, geom('Box', [0.015, 0.06, 0.015], () => new THREE.BoxGeometry(0.015, 0.06, 0.015)), 0, -0.07, 0.03);
  if (it.includes('tie')) add(torso, geom('Box', [0.05, 0.3 * s, 0.02], () => new THREE.BoxGeometry(0.05, 0.3 * s, 0.02)), 0, 0.3 * s, 0.13 * s * g);
  if (o.lie) { root.rotation.x = 0; }
  if (pose.lie) { root.rotation.x = -Math.PI / 2; root.position.y = 0.14; hips.position.y = 0.0; }
  return root;
}

/* ---- tableaux: step key (route.js), position, figures [x, z (relative), facing radians (0 = +z), options] ---- */
// facing: 0 looks south (+z), PI/2 east (+x), -PI/2 west, PI north
const E = Math.PI / 2, W = -Math.PI / 2, N = Math.PI, S0 = 0;
export const TABLEAUX = [
  // you are Rudon at the gate: the others watch you go
  { step: 'gate', x: 52, z: 0, figs: [
    [-1.5, -3.4, E, { name: 'mother', s: 0.96, pose: 'shock', hair: 'long', robe: true }],
    [-2.3, -2.7, E, { name: 'father', s: 1.02, pose: 'stand', hair: 'short' }],
    [-2.0, 3.3, E, { name: 'nestor', s: 0.86, g: 0.85, pose: 'backHands' }],
    [-2.8, 2.6, E, { name: 'adam', s: 0.98, g: 1.3, pose: 'crossed' }],
    [5.2, -2.1, W, { name: 'guard', pose: 'guard', items: ['vest', 'holster'] }],
  ] },
  { step: 'classroom', x: 46, z: -24, figs: [
    [0, -8.6, S0, { name: 'teacher', pose: 'teach', hair: 'short', items: ['chalk'] }],
    ...[[-4, -4], [0, -4], [4, -4], [-4, -1], [0, -1], [4, -1]].map(([x, z], i) => [x, z + 0.7, N, { s: 0.74, pose: i === 1 ? 'sitTalk' : 'sitDesk', hair: i % 2 ? 'long' : 'short' }]),
  ] },
  { step: 'sketch', x: 6.5, z: -8.4, figs: [
    [0, 0, N, { name: 'rudon-child', s: 0.74, pose: 'read', items: ['notebook'], hair: 'short' }],
  ] },
  { step: 'friends', x: 0, z: 116, figs: [
    [0, 0, S0, { name: 'rudon-child', s: 0.76, pose: 'point', hair: 'short', items: ['backpack'] }],
    [-0.9, -0.8, S0, { name: 'adam', s: 0.84, g: 1.3, pose: 'stand', items: ['bigpack'] }],
    [0.85, -0.7, S0, { name: 'nestor', s: 0.68, g: 0.85, pose: 'read', items: ['notebook'] }],
  ] },
  { step: 'rebecca', x: 46, z: -18, figs: [
    [0, -1.6, S0, { name: 'rebecca', s: 0.78, pose: 'talk', hair: 'long' }],
    [-0.4, 0.6, N, { name: 'rudon-child', s: 0.78, pose: 'stand', hair: 'short' }],
    [0.5, 0.9, N, { name: 'adam', s: 0.84, g: 1.3, pose: 'crossed' }],
    [0, 1.5, N, { name: 'nestor', s: 0.7, g: 0.85, pose: 'backHands' }],
  ] },
  { step: 'door', x: 0, z: 155, figs: [
    [0.2, 2.2, N, { name: 'gary', g: 1.45, pose: 'read', items: ['vest', 'holster', 'slip'], hair: 'short' }],
    [-0.6, 0, S0, { name: 'rebecca', s: 0.8, pose: 'talk', hair: 'long' }],
    [0.4, -0.5, S0, { name: 'rudon-child', s: 0.8, pose: 'stand', items: ['ruler'] }],
    [-0.9, -1.1, S0, { name: 'adam', s: 0.86, g: 1.3, pose: 'stand', items: ['ruler'] }],
    [0.8, -1.3, S0, { name: 'nestor', s: 0.72, g: 0.85, pose: 'read', items: ['notebook'] }],
  ] },
  { step: 'station', x: -0.6, z: 220.6, figs: [
    [0, 0, W, { name: 'rebecca', s: 0.8, pose: 'cup', hair: 'long', items: ['cup'] }],
    [0.9, -1.2, S0, { name: 'rudon-child', s: 0.8, pose: 'stand' }],
  ] },
  { step: 'blue', x: 0, z: 397, figs: [
    [-0.9, 0, S0, { name: 'rebecca', s: 0.8, pose: 'lookUp', hair: 'long' }],
    [0, 0.4, S0, { name: 'rudon-child', s: 0.8, pose: 'walk' }],
    [0.9, -0.2, S0, { name: 'adam', s: 0.86, g: 1.3, pose: 'stand', items: ['bigpack'] }],
    [0.3, -1.1, S0, { name: 'nestor', s: 0.72, g: 0.85, pose: 'shock' }],
  ] },
  { step: 'chapel', x: 0, z: 449, figs: [
    [0, 0, S0, { name: 'rudon-child', s: 0.8, pose: 'kneel' }],
    [-2.6, -1.2, S0, { name: 'rebecca', s: 0.8, pose: 'lookUp', hair: 'long' }],
    [2.6, -1.6, 0.3, { name: 'nestor', s: 0.72, g: 0.85, pose: 'point' }],
    [1.4, -3.8, -0.4, { name: 'adam', s: 0.86, g: 1.3, pose: 'bow' }],
  ] },
  { step: 'cafeteria', x: 29.5, z: -6.2, figs: [
    [1.0, -0.2, W, { name: 'rudon', s: 0.9, pose: 'limp', items: ['skateboard'] }],
    [-0.4, -0.3, E, { name: 'mel', s: 0.92, pose: 'fallen' }],
    [-1.3, 1.1, E, { name: 'rebecca', s: 0.88, pose: 'shock', hair: 'long' }],
  ] },
  { step: 'holding', x: 50, z: 14, figs: [
    [0, -0.8, S0, { name: 'rudon', s: 0.9, pose: 'sit' }],
    [2.4, 1.6, -2.2, { name: 'sam', pose: 'talk', items: ['tie'], hair: 'short' }],
    [-2.3, 1.4, 2.4, { name: 'rebecca', s: 0.88, pose: 'shock', hair: 'long' }],
  ] },
  { step: 'court', x: 51, z: 4, figs: [
    [0, 4.2, N, { name: 'judge', pose: 'sitDesk', robe: false, hair: 'short' }],
    [0, 0, S0, { name: 'rudon', s: 0.9, pose: 'sit' }],
    [-3.2, -0.8, 0.5, { name: 'mrs-dogger', s: 0.96, pose: 'talk', hair: 'long', robe: true }],
    [3.0, -0.6, -0.5, { name: 'sam', pose: 'backHands', items: ['tie'], hair: 'short' }],
  ] },
  { step: 'office', x: -36.5, z: -11, figs: [
    [0, -2.4, S0, { name: 'senior', pose: 'sitDesk', hair: 'short' }],
    [0.3, 1.3, N, { name: 'rudon', s: 0.92, pose: 'backHands' }],
  ] },
  { step: 'deadEnd', x: -116.6, z: 310, figs: [
    [-1.0, -0.7, W, { name: 'explorer', pose: 'chalk', items: ['chalk', 'backpack'], hair: 'short' }],
    [0.2, 0.8, W, { name: 'explorer2', pose: 'read', items: ['notebook', 'backpack'] }],
    [1.1, -0.2, W, { name: 'rudon', s: 0.92, pose: 'stand', items: ['backpack'] }],
  ] },
  { step: 'collector', x: 1.75, z: 1.3, figs: [
    [0, 0, -2.3, { name: 'explorer', pose: 'scoop', items: ['backpack'], hair: 'short' }],
  ] },
  { step: 'machine', x: -24, z: -44.2, figs: [
    [0, 0, N, { name: 'rudon', s: 0.92, pose: 'read', items: ['notebook'] }],
    [1.9, 3.3, -2.6, { name: 'senior', pose: 'crossed', hair: 'short' }],
  ] },
  { step: 'visit', x: -28.5, z: -7, figs: [
    [0, 0, E, { name: 'rudon', s: 0.92, pose: 'sitLow' }],
    [1.6, -0.5, W, { name: 'adam', s: 0.98, g: 1.3, pose: 'crossed' }],
    [1.6, 0.6, W, { name: 'nestor', s: 0.86, g: 0.85, pose: 'talk' }],
  ] },
  { step: 'path', x: 330, z: 0, figs: [
    [0, 0, E, { name: 'rudon', s: 0.92, pose: 'walk', items: ['backpack', 'skateboard'] }],
  ] },
];

export function createStatues(story, stoneMaps) {
  const groups = new Map();      // tableau -> Group
  const line = new THREE.LineDashedMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.5, dashSize: 0.05, gapSize: 0.07, depthWrite: false });
  function build(tb) {
    const g = new THREE.Group();
    const k = Math.max(0.25, Math.min(1.1, story.lightAt(tb.x, story.floorAt(tb.x, tb.z) + 1.2, tb.z)));
    const mat = new THREE.MeshStandardMaterial({ map: stoneMaps.map, normalMap: stoneMaps.normalMap, roughness: 0.8, metalness: 0, normalScale: new THREE.Vector2(2, 2), color: new THREE.Color(0.95 * k, 0.93 * k, 0.88 * k).multiplyScalar(0.5) });
    for (const [dx, dz, face, o] of tb.figs) {
      const f = humanoid(o, mat, line);
      const x = tb.x + dx, z = tb.z + dz, fl = story.floorAt(x, z);
      f.position.set(x, Number.isFinite(fl) ? fl : 0, z);
      f.rotation.y = face;
      if (P[o.pose] && P[o.pose].lie) f.rotation.x = 0;
      g.add(f);
    }
    g.userData.mat = mat;
    return g;
  }
  return {
    update(pos) {
      for (const tb of TABLEAUX) {
        const d = Math.hypot(tb.x - pos.x, tb.z - pos.z);
        const g = groups.get(tb);
        if (d < 45 && !g) { const ng = build(tb); story.scene.add(ng); groups.set(tb, ng); }
        else if (d > 60 && g) {
          story.scene.remove(g);
          g.userData.mat.dispose();
          groups.delete(tb);
        }
      }
    },
    // solid boxes for collision (one per figure)
    solids() {
      const out = [];
      for (const tb of TABLEAUX) for (const [dx, dz, , o] of tb.figs) {
        const x = tb.x + dx, z = tb.z + dz, fl = story.floorAt(x, z), r = 0.28 * (o.s || 1) * (o.g || 1);
        if (Number.isFinite(fl)) out.push([x - r, fl, z - r, x + r, fl + 1.6 * (o.s || 1), z + r]);
      }
      return out;
    },
  };
}
