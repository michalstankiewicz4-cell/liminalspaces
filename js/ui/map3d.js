// 3D map of the caves of Tumithak (key M): the tunnels, rooms, caverns and shafts you have explored, drawn as lines
// coloured by place, the place names you have visited, and you (an arrow). It opens over the game in its own canvas
// (a second, small WebGL renderer made on first use). Mouse: drag to turn the view around, right drag (or Shift +
// drag) to move it, wheel to zoom; R centres it on you again; L shows the whole world (and hides the unexplored again). Explored parts are remembered (ls:tumimap:v1).
import * as THREE from '../../vendor/three.module.js';
import { h } from './dom.js';
import { t, onLang } from '../i18n/index.js';
import { read, write, KEYS } from '../core/storage.js';

const CELL = 4;                         // exploration cells (m)
const key = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);

export function createMap3d(uiEl) {
  let caves = null, renderer = null, scene = null, cam = null, lines = null, marker = null;
  const explored = new Set(read(KEYS.tumiMap) || []);
  let dirty = false, open = false, drawn = -1, reveal = false;     // reveal: show the whole world (L on the map)
  const view = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0.75, dist: 90 };

  const canvas = h('canvas', { class: 'map3d-canvas' });
  const title = h('div', { class: 'map3d-title' });
  const help = h('div', { class: 'map3d-help' });
  const labelBox = h('div', { class: 'map3d-labels' });
  const root = h('div', { id: 'map3d', hidden: true }, canvas, labelBox, title, help);
  uiEl.append(root);
  const relabel = () => { title.textContent = t('map3d.title'); help.textContent = t('map3d.help'); };
  relabel(); onLang(() => { relabel(); drawn = -1; });

  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a08);
    cam = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);
    marker = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 12), new THREE.MeshBasicMaterial({ color: 0xff5a3a }));
    cone.rotation.x = -Math.PI / 2;                 // tip forward (-z)
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 32), new THREE.MeshBasicMaterial({ color: 0xff5a3a, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    marker.add(cone, ring);
    scene.add(marker);
  }

  // the line geometry of everything explored (rebuilt when the explored set grew)
  function rebuild() {
    if (lines) { scene.remove(lines); lines.geometry.dispose(); }
    const pos = [], col = [], c = new THREE.Color();
    const seg = (a, b, color) => { pos.push(...a, ...b); c.set(color); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    const seen = (x, y, z) => reveal || explored.has(key(x, y, z));
    for (const p of caves.W.prims) {
      const color = (caves.zones[p.zone] || caves.zones[0]).map;
      if (p.k === 'tube') {
        if (!seen((p.ax + p.bx) / 2, (p.ay + p.by) / 2 + 1, (p.az + p.bz) / 2)) continue;
        // the floor line and the ceiling line of the tunnel
        seg([p.ax, p.ay, p.az], [p.bx, p.by, p.bz], color);
        if (p.w > 1.2) seg([p.ax, p.ay + p.h, p.az], [p.bx, p.by + p.h, p.bz], color);
      } else if (p.k === 'shaft') {
        if (!seen(p.x, p.y0 + 1, p.z) && !seen(p.x, p.y1 - 2, p.z)) continue;
        for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2; seg([p.x + Math.cos(ang) * p.r, p.y0, p.z + Math.sin(ang) * p.r], [p.x + Math.cos(ang) * p.r, p.y1, p.z + Math.sin(ang) * p.r], '#e0d0a0'); }
      } else if (p.k === 'room') {
        if (!seen(p.x, p.y + 1, p.z)) continue;
        const x0 = p.x - p.hw, x1 = p.x + p.hw, z0 = p.z - p.hd, z1 = p.z + p.hd, y = p.y;
        seg([x0, y, z0], [x1, y, z0], color); seg([x1, y, z0], [x1, y, z1], color); seg([x1, y, z1], [x0, y, z1], color); seg([x0, y, z1], [x0, y, z0], color);
      } else if (p.k === 'cavern') {
        if (!seen(p.x, p.fl + 1, p.z)) continue;
        for (const [ry, yy] of [[1, p.fl], [0.8, p.y]]) for (let a = 0; a < 24; a++) {
          const a0 = a / 24 * Math.PI * 2, a1 = (a + 1) / 24 * Math.PI * 2;
          seg([p.x + Math.cos(a0) * p.rx * ry, yy, p.z + Math.sin(a0) * p.rz * ry], [p.x + Math.cos(a1) * p.rx * ry, yy, p.z + Math.sin(a1) * p.rz * ry], color);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
    scene.add(lines);
    drawn = explored.size;
  }

  // place names of the visited zones, projected to the screen each frame
  let labelEls = [];
  function placeLabels() {
    labelBox.textContent = '';
    labelEls = [];
    for (const l of caves.labels) {
      const z = caves.zones.findIndex((q) => q.key === l.key);
      const known = reveal || (z >= 0 && caves.visited.has(z)) || explored.has(key(l.x, l.y + 1, l.z));
      if (!known) continue;
      const el = h('div', { class: 'map3d-label' }, t('tm.l.' + l.key));
      labelBox.append(el);
      labelEls.push([el, new THREE.Vector3(l.x, l.y + 3, l.z)]);
    }
  }

  /* ---- mouse: orbit, pan, zoom ---- */
  let drag = null;
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  root.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; });
  addEventListener('mousemove', (e) => {
    if (!drag || !open) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const k = view.dist / 600, c = Math.cos(view.yaw), s = Math.sin(view.yaw);
      view.tx -= (dx * c + dy * s * Math.sin(view.pitch)) * k; view.tz -= (-dx * s + dy * c * Math.sin(view.pitch)) * k;
      view.ty += dy * Math.cos(view.pitch) * k;
    } else {
      view.yaw -= dx * 0.006;
      view.pitch = Math.max(-1.45, Math.min(1.45, view.pitch + dy * 0.006));
    }
  });
  addEventListener('mouseup', () => { drag = null; });
  root.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = Math.max(8, Math.min(1500, view.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  addEventListener('keydown', (e) => { if (open && e.code === 'KeyR') centre(); });

  let player = null;
  function centre() { if (player) { view.tx = player.x; view.ty = player.y; view.tz = player.z; view.yaw = player.yaw; view.pitch = 0.75; view.dist = 90; } }

  return {
    attach(c) { caves = c; drawn = -1; },
    get open() { return open; },
    toggleReveal() { reveal = !reveal; if (renderer) { rebuild(); placeLabels(); } return reveal; },
    get revealed() { return reveal; },
    setOpen(o, p) {
      open = !!o; root.hidden = !open;
      if (open) { init(); player = p || player; centre(); if (dirty || drawn !== explored.size) rebuild(); placeLabels(); }
      drag = null;
    },
    // mark what is around you as explored (call a few times a second)
    explore(x, y, z) {
      for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz > 5) continue;
        const k = key(x + dx * CELL, y + 1 + dy * CELL, z + dz * CELL);
        if (!explored.has(k)) { explored.add(k); dirty = true; }
      }
    },
    save() { if (dirty) { write(KEYS.tumiMap, [...explored]); dirty = false; } },
    clear() { explored.clear(); write(KEYS.tumiMap, null); drawn = -1; },
    frame(p) {
      if (!open) return;
      player = p;
      const w = root.clientWidth, hh = root.clientHeight;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(hh * renderer.getPixelRatio())) { renderer.setSize(w, hh, false); cam.aspect = w / Math.max(1, hh); cam.updateProjectionMatrix(); }
      if (drawn !== explored.size) rebuild();
      const cp = Math.cos(view.pitch);
      cam.position.set(view.tx + Math.sin(view.yaw) * cp * view.dist, view.ty + Math.sin(view.pitch) * view.dist, view.tz + Math.cos(view.yaw) * cp * view.dist);
      cam.lookAt(view.tx, view.ty, view.tz);
      marker.position.set(p.x, p.y + 1, p.z); marker.rotation.y = p.yaw;
      marker.scale.setScalar(Math.max(0.6, view.dist / 90));
      renderer.render(scene, cam);
      const v = new THREE.Vector3();
      for (const [el, pos] of labelEls) {
        v.copy(pos).project(cam);
        const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && pos.distanceTo(cam.position) < view.dist * 4;
        el.hidden = !vis;
        if (vis) { el.style.left = ((v.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - v.y) / 2 * hh) + 'px'; }
      }
    },
  };
}
