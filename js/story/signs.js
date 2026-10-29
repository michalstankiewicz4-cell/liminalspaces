// Paper notes and brass plaques of the Great Path world: textures drawn from i18n strings (re-drawn when the
// language changes), meshes lit by the baked light at their place, and which one the player is looking at.
import * as THREE from '../../vendor/three.module.js';
import { CW } from './grid.js';
import { canvasTexture } from './textures.js';
import { t } from '../i18n/index.js';

const fdiv = (a, b) => Math.floor(a / b);

export function createSigns(grid) {
  const signTex = new Map();         // sign -> texture
  // Text of a note or plaque (plaques: story time, scene title, what happens).
  function signText(s) {
    return s.kind === 'plaque' ? `${s.time} — ${t('gp.s.' + s.step)}\n${t('gp.sd.' + s.step)}` : t(s.key, s.params);
  }
  function drawPlaque(s) {
    const [title, ...body] = signText(s).split('\n');
    return canvasTexture(512, 380, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8a6a2c'); gr.addColorStop(0.5, '#b8934a'); gr.addColorStop(1, '#6e5222');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#4a3814'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
      for (const [x, y] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) { g.fillStyle = '#5a4418'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
      g.fillStyle = '#2a1e08'; g.font = 'bold 30px Georgia,serif'; g.textAlign = 'center';
      g.fillText(title, w / 2, 76, w - 70);
      g.font = '23px Georgia,serif';
      let y = 128;
      for (const para of body) {
        const words = para.split(' '); let line = '';
        for (const wd of words) { if (g.measureText(line + wd).width > w - 80) { g.fillText(line, w / 2, y); y += 30; line = ''; } line += wd + ' '; }
        g.fillText(line, w / 2, y); y += 34;
      }
    });
  }
  function drawSign(s) {
    if (s.kind === 'plaque') return drawPlaque(s);
    const txt = t(s.key, s.params), [title, ...body] = txt.split('\n');
    return canvasTexture(512, 380, (g, w, h) => {
      g.fillStyle = '#efe8d4'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,100,60,.08)'; for (let k = 0; k < 40; k++) g.fillRect((k * 97) % w, (k * 53) % h, 30, 2);
      g.strokeStyle = 'rgba(80,110,160,.25)'; g.lineWidth = 1;
      for (let y = 70; y < h; y += 28) { g.beginPath(); g.moveTo(16, y); g.lineTo(w - 16, y); g.stroke(); }
      g.fillStyle = '#1e2430';
      g.font = 'bold 30px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
      g.fillText(title, 22, 48, w - 44);
      g.font = '22px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
      let y = 92;
      for (const para of body) {
        const words = para.split(' '); let line = '';
        for (const wd of words) {
          if (g.measureText(line + wd).width > w - 44) { g.fillText(line, 22, y); y += 28; line = ''; }
          line += wd + ' ';
        }
        g.fillText(line, 22, y); y += 32;
      }
    });
  }
  function makeSign(s, bake) {
    const tex = drawSign(s);
    signTex.set(s, tex);
    const l = bake(s.x, s.y, s.z, Math.sin(s.rot), 0, Math.cos(s.rot));
    const k = Math.min(1.1, Math.max(0.12, (l[0] + l[1] + l[2]) / 3));
    const m = s.kind === 'plaque'
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.75, color: new THREE.Color(k, k, k).multiplyScalar(1.4) })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, color: new THREE.Color(k, k, k), side: THREE.FrontSide });
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), m);
    sheet.receiveShadow = true;
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xa02018 }));
    pin.position.set(0, 0.14, 0.01);
    g.add(sheet, pin);
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(0, s.rot, s.tilt);
    g.userData.sign = s;
    s.mat = m;
    return g;
  }
  function disposeSigns(group) {
    group.traverse((o) => { if (o.userData.sign) { const s = o.userData.sign; const tx = signTex.get(s); if (tx) tx.dispose(); signTex.delete(s); s.mat = null; } });
  }
  function relabel() {
    for (const [s, tx] of signTex) { if (!s.mat) continue; const nt = drawSign(s); s.mat.map = nt; s.mat.needsUpdate = true; tx.dispose(); signTex.set(s, nt); }
  }

  // Nearest note the player is looking at (within 2.2 m), or null.
  function signNear(pos, fwdX, fwdZ) {
    let best = null, bd = 2.2;
    const ci = fdiv(pos.x, CW), cj = fdiv(pos.z, CW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = grid.chunk(ci + di, cj + dj, false);
      if (!c) continue;
      for (const s of c.signs) {
        const d = Math.hypot(s.x - pos.x, s.z - pos.z);
        if (d > bd || Math.abs(s.y - (pos.y + 1.5)) > 1.4) continue;
        const nx = Math.sin(s.rot), nz = Math.cos(s.rot);
        if (fwdX * -nx + fwdZ * -nz < 0.35) continue;
        bd = d; best = s;
      }
    }
    return best;
  }

  return { make: makeSign, dispose: disposeSigns, relabel, text: signText, near: signNear };
}
