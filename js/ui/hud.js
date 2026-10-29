// In-game HUD: crosshair dot, a quiet status line (zone, distance, finds), centred toasts, control hint,
// "click to look" prompt, the paper note being read and the optional FPS counter.
import { h } from './dom.js';

export function createHud(root) {
  const dot = h('div', { id: 'dot', hidden: true });
  const line = h('div', { id: 'line', hidden: true });
  const toast = h('div', { id: 'toast', hidden: true });
  const hint = h('div', { id: 'hint', hidden: true });
  const click = h('div', { id: 'click', hidden: true });
  const fps = h('div', { id: 'fps', hidden: true });
  const sign = h('div', { id: 'sign', hidden: true });
  const goalArrow = h('span', { class: 'garrow' }, '▲'), goalText = h('span');
  const goal = h('div', { id: 'goal', hidden: true }, goalArrow, goalText);
  const prompt = h('div', { id: 'prompt', hidden: true });
  const fade = h('div', { id: 'fade', hidden: true });
  root.append(dot, line, toast, hint, click, fps, sign, goal, prompt, fade);
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
    // text of the paper note the player is reading (null hides it)
    setSign(s) { sign.hidden = !s; if (s && sign.textContent !== s) sign.textContent = s; },
    // story guide: text and the arrow's angle relative to where the player looks (radians, null = no arrow)
    setGoal(s, ang) { goal.hidden = !s; if (!s) return; goalText.textContent = s; goalArrow.hidden = ang === null; if (ang !== null) goalArrow.style.transform = `rotate(${-ang}rad)`; },
    // an action the player can take here ("E: pull the lever"), null hides it
    setPrompt(s) { prompt.hidden = !s; if (s && prompt.textContent !== s) prompt.textContent = s; },
    // full-screen fade: css colour and opacity 0..1 (cut scenes)
    setFade(color, a) { fade.hidden = !(a > 0.001); if (a > 0.001) { fade.style.background = color; fade.style.opacity = String(Math.min(1, a)); } },
    tick(dt) {
      if (toastT > 0) { toastT -= dt; toast.classList.toggle('fade', toastT < 0.8); if (toastT <= 0) toast.hidden = true; }
      if (hintT > 0) { hintT -= dt; hint.classList.toggle('fade', hintT < 1.5); if (hintT <= 0) hint.hidden = true; }
    },
  };
}
