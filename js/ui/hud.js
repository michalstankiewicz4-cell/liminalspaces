// In-game HUD: crosshair dot, a quiet status line (zone, distance, finds), centred toasts, control hint,
// "click to look" prompt and the optional FPS counter.
import { h } from './dom.js';

export function createHud(root) {
  const dot = h('div', { id: 'dot', hidden: true });
  const line = h('div', { id: 'line', hidden: true });
  const toast = h('div', { id: 'toast', hidden: true });
  const hint = h('div', { id: 'hint', hidden: true });
  const click = h('div', { id: 'click', hidden: true });
  const fps = h('div', { id: 'fps', hidden: true });
  root.append(dot, line, toast, hint, click, fps);
  let toastT = 0, hintT = 0;
  return {
    // on: in a walk (not paused); show: user HUD toggle
    showPlay(on, show) { dot.hidden = !on; line.hidden = !(on && show); toast.hidden = !on || toastT <= 0; hint.hidden = !(on && show) || hintT <= 0; },
    showClick(on) { click.hidden = !on; },
    showFps(on) { fps.hidden = !on; },
    setLine(s) { line.textContent = s; },
    setClick(s) { click.textContent = s; },
    setHint(s, seconds = 12) { hint.textContent = s; hintT = seconds; },
    toast(s, seconds = 3.5) { toast.textContent = s; toastT = seconds; toast.hidden = false; toast.classList.remove('fade'); },
    setFps(s) { fps.textContent = s; },
    tick(dt) {
      if (toastT > 0) { toastT -= dt; toast.classList.toggle('fade', toastT < 0.8); if (toastT <= 0) toast.hidden = true; }
      if (hintT > 0) { hintT -= dt; hint.classList.toggle('fade', hintT < 1.5); if (hintT <= 0) hint.hidden = true; }
    },
  };
}
