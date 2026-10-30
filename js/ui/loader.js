// Loading screen: the boot screen of index.html (shown while the code downloads) is reused when a walk starts.
// A spinning ring, a line saying what is being done and a progress bar (indeterminate when no fraction is given).
// CSS animations run on the compositor, so the ring keeps turning while the world is built on the main thread.
import { t } from '../i18n/index.js';

export function createLoader(el) {
  const text = el.querySelector('.ld-text'), bar = el.querySelector('.ld-bar i');
  let hideIn = 0;
  const api = {
    get visible() { return !el.hidden; },
    // key: i18n key of the step; frac: 0..1 or null (indeterminate)
    show(key, frac = null) {
      hideIn = 0;
      el.hidden = false; el.classList.remove('done');
      text.textContent = key ? t(key) : '';
      el.classList.toggle('indet', frac === null);
      if (frac !== null) bar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    },
    // hide once n more frames have been drawn (the first frames of a new world compile shaders and stutter)
    hideAfter(n = 3) { hideIn = n; },
    hide() { hideIn = 0; el.classList.add('done'); setTimeout(() => { if (el.classList.contains('done')) el.hidden = true; }, 350); },
    // call once per drawn frame
    frame() { if (hideIn > 0 && --hideIn === 0) api.hide(); },
  };
  return api;
}
// resolves after the browser has painted (so a loader shown just before is on screen before heavy work)
export const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
