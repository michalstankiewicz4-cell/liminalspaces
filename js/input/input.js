// Keyboard and mouse input for a first-person game.
// Mouse look: pointer lock when available (click the game to capture the mouse); otherwise drag with any button.
// Nothing is recorded or sent anywhere: key codes and mouse movement stay in memory for the current frame only.
import { ACTIONS } from './bindings.js';

const typing = (t) => !!(t && t.closest && t.closest('input,textarea,select,[contenteditable]'));

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.held = new Set();              // currently held key codes
    this.suspended = false;             // true while a key is being rebound
    this.look = { x: 0, y: 0 };         // accumulated mouse movement since the last frame (pixels)
    this.dragging = false;
    this.skip = 0; this.recent = 0;     // mouse spike filter (see mousemove)
    this.onPress = null;                // (actionId) => void
    this.onLockChange = null;           // (locked) => void
    this.#rebuild();
    settings.onChange(() => this.#rebuild());

    addEventListener('keydown', (e) => this.#key(e, true));
    addEventListener('keyup', (e) => this.#key(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // with the mouse captured: left button = use (pull a lever…), right button = flashlight
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!this.locked) { this.dragging = true; return; }
      if (this.suspended || !this.onPress) return;
      if (e.button === 0) this.onPress('use'); else if (e.button === 2) this.onPress('flashlight');
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!(this.locked || this.dragging)) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      // Chrome sometimes reports a single huge jump while the pointer is locked (and right after locking):
      // drop the first events after a lock and any event far larger than the recent movement.
      if (this.skip > 0) { this.skip--; return; }
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      if (m > 150 && m > this.recent * 8 + 60) { this.recent += (Math.min(m, this.recent * 2 + 30) - this.recent) * 0.3; return; }
      this.recent = this.recent * 0.8 + m * 0.2;
      this.look.x += dx; this.look.y += dy;
    });
    document.addEventListener('pointerlockchange', () => { this.skip = 2; this.recent = 0; if (this.onLockChange) this.onLockChange(this.locked); });
    addEventListener('blur', () => this.clear());
  }

  get locked() { return document.pointerLockElement === this.canvas; }
  // Must be called from a user gesture (click / key press). Failures (e.g. headless browsers) are ignored.
  // Raw (unadjusted) movement avoids OS acceleration and most of Chrome's jumps; falls back when not supported.
  lock() {
    const plain = () => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* not available */ } };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotSupportedError') plain(); });
    } catch (e) { plain(); }
  }
  unlock() { if (this.locked) document.exitPointerLock(); }

  #rebuild() {
    this.codeMap = new Map();
    for (const a of ACTIONS) for (const c of this.settings.data.keys[a.id]) if (c) this.codeMap.set(c, a.id);
  }

  #key(e, down) {
    if (this.suspended || typing(e.target)) return;
    const act = this.codeMap.get(e.code);
    if (!act) return;
    e.preventDefault();
    if (down) this.held.add(e.code); else this.held.delete(e.code);
    if (down && !e.repeat && this.onPress) this.onPress(act);
  }

  isDown(action) {
    for (const c of this.settings.data.keys[action]) if (c && this.held.has(c)) return true;
    return false;
  }
  clear() { this.held.clear(); this.dragging = false; this.look.x = this.look.y = 0; }

  // Returns and resets the mouse movement accumulated since the last call.
  takeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = this.look.y = 0; return l; }

  // Local movement intent: x = strafe (right +), z = forward (+), normalised.
  moveVector() {
    const d = (a) => (this.isDown(a) ? 1 : 0);
    const x = d('moveRight') - d('moveLeft'), z = d('moveFwd') - d('moveBack');
    const l = Math.hypot(x, z);
    return l ? { x: x / l, z: z / l } : { x: 0, z: 0 };
  }
  turnAxis() { return (this.isDown('turnRight') ? 1 : 0) - (this.isDown('turnLeft') ? 1 : 0); }
}
