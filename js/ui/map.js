// Map for the Great Path world: a north-up minimap in the corner and a full-screen map (M) with zoom, pan,
// place labels and a journal of visited places (with their story timestamps). Only cells the player has seen are drawn.
import { h, tx } from './dom.js';
import { t, onLang } from '../i18n/index.js';
import { CN, CS, CW, F } from '../story/grid.js';

const WALL = [34, 30, 24];

function hex(c) { const n = parseInt(c.slice(1), 16); return c.length === 4 ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export function createMapUi(root) {
  const mini = h('canvas', { id: 'minimap', width: 180, height: 180, hidden: true });
  const big = h('canvas', { id: 'mapcanvas' });
  const list = h('ol', { class: 'journal' });
  const full = h('div', { id: 'mapfull', hidden: true }, big,
    h('div', { class: 'mappanel' }, tx('map.title', 'h2'), tx('map.journal', 'h3'), list, h('p', { class: 'note' }, tx('map.help'))));
  root.append(mini, full);

  let story = null, zones = null, colors = null;
  const cache = new Map();             // chunk -> { cv, key }
  let view = { x: 0, z: 0, s: 2 };     // full map centre (m) and pixels per cell
  let open = false, drag = null, follow = false, fit = false;

  function chunkImage(c) {
    const key = c.version + '|' + (c.seenV || 0);
    let e = cache.get(c);
    if (e && e.key === key) return e.cv;
    if (!e) { const cv = document.createElement('canvas'); cv.width = cv.height = CN; e = { cv, key: '' }; cache.set(c, e); }
    e.key = key;
    const g = e.cv.getContext('2d'), img = g.createImageData(CN, CN), d = img.data;
    for (let k = 0; k < CN * CN; k++) {
      if (!c.seen[k]) continue;
      let r, gg, b;
      if (!c.open[k]) [r, gg, b] = WALL;
      else {
        [r, gg, b] = colors[c.zone[k]] || [120, 120, 120];
        const f = c.floor[k];
        const sh = Math.max(0.45, Math.min(1.25, 1 + f * 0.06));
        r *= sh; gg *= sh; b *= sh;
        if (c.flags[k] & F.SKY) { r = r * 0.5 + 128; gg = gg * 0.5 + 128; b = b * 0.5 + 120; }
        if (c.ceil[k] - f < 2.2) { r *= 0.7; gg *= 0.7; b *= 0.7; }
      }
      const i = k * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return e.cv;
  }

  // Draws the world into a 2D context: centre (cx, cz) metres at canvas centre, s pixels per cell.
  function drawWorld(g, w, hgt, cx, cz, s, player, labels) {
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, w, hgt);
    g.imageSmoothingEnabled = false;
    const px = (x) => w / 2 + (x - cx) / CS * s, pz = (z) => hgt / 2 + (z - cz) / CS * s;
    const r = Math.max(w, hgt) / 2 / s * CS + CW;
    for (const c of story.grid.chunks.values()) {
      const x0 = c.ci * CW, z0 = c.cj * CW;
      if (x0 > cx + r || x0 + CW < cx - r || z0 > cz + r || z0 + CW < cz - r) continue;
      if (!c.seenV) continue;
      g.drawImage(chunkImage(c), Math.floor(px(x0)), Math.floor(pz(z0)), Math.ceil(CN * s), Math.ceil(CN * s));
    }
    if (labels) {
      g.font = `${Math.max(11, Math.min(16, s * 5))}px ui-monospace,Consolas,monospace`; g.textAlign = 'center';
      for (const [id] of story.visited) {
        const z = zones[id];
        if (z.lx === undefined) continue;
        const x = px(z.lx), y = pz(z.lz);
        if (x < -100 || y < -20 || x > w + 100 || y > hgt + 20) continue;
        g.fillStyle = 'rgba(0,0,0,.65)'; g.fillText(t('gp.z.' + z.key), x + 1, y + 1);
        g.fillStyle = '#f4e8b8'; g.fillText(t('gp.z.' + z.key), x, y);
      }
    }
    // player arrow
    const ax = px(player.x), ay = pz(player.z), a = player.yaw;
    g.save(); g.translate(ax, ay); g.rotate(-a);
    g.fillStyle = '#ff5a3a'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  function fillJournal() {
    list.textContent = '';
    const items = [...story.visited].sort((a, b) => a[1] - b[1]);
    for (const [id] of items) {
      const z = zones[id];
      list.append(h('li', {}, h('span', { class: 'jt' }, z.t || ''), ' ', t('gp.z.' + z.key)));
    }
  }

  big.addEventListener('wheel', (e) => { e.preventDefault(); view.s = Math.max(0.3, Math.min(12, view.s * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });
  big.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vz: view.z }; follow = false; });
  addEventListener('mouseup', () => { drag = null; });
  addEventListener('mousemove', (e) => { if (!drag) return; view.x = drag.vx - (e.clientX - drag.x) / view.s * CS; view.z = drag.vz - (e.clientY - drag.y) / view.s * CS; });
  onLang(() => { if (story && open) fillJournal(); });

  let miniT = 0;
  return {
    attach(s) {
      story = s; zones = s.zones;
      colors = zones.map((z) => hex(z.map || '#777'));
      cache.clear();
    },
    show(on) { mini.hidden = !on || !story; if (!on) this.setOpen(false); },
    get open() { return open; },
    setOpen(on) {
      open = on && !!story; full.hidden = !open;
      if (open) { follow = false; fit = true; fillJournal(); }
    },
    update(dt, player) {
      if (!story) return;
      if (open) {
        const w = big.clientWidth, hh = big.clientHeight;
        if (big.width !== w || big.height !== hh) { big.width = w; big.height = hh; }
        // on opening: frame everything explored (and the player); afterwards the view stays where you put it
        if (fit && w > 0) {
          fit = false;
          const b = story.seenBounds() || { x0: player.x - 30, z0: player.z - 30, x1: player.x + 30, z1: player.z + 30 };
          b.x0 = Math.min(b.x0, player.x - 20); b.x1 = Math.max(b.x1, player.x + 20); b.z0 = Math.min(b.z0, player.z - 20); b.z1 = Math.max(b.z1, player.z + 20);
          view.x = (b.x0 + b.x1) / 2; view.z = (b.z0 + b.z1) / 2;
          view.s = Math.max(0.3, Math.min(6, Math.min(w / ((b.x1 - b.x0) / CS), hh / ((b.z1 - b.z0) / CS)) * 0.9));
        }
        if (follow) { view.x = player.x; view.z = player.z; }
        drawWorld(big.getContext('2d'), w, hh, view.x, view.z, view.s, player, true);
        return;
      }
      miniT -= dt;
      if (mini.hidden || miniT > 0) return;
      miniT = 0.1;
      drawWorld(mini.getContext('2d'), 180, 180, player.x, player.z, 1.4, player, false);
    },
  };
}
