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
    this.onPress = null;                // (actionId) => void
    this.onLockChange = null;           // (locked) => void
    this.#rebuild();
    settings.onChange(() => this.#rebuild());

    addEventListener('keydown', (e) => this.#key(e, true));
    addEventListener('keyup', (e) => this.#key(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => { if (!this.locked) this.dragging = true; e.preventDefault(); });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) { this.look.x += e.movementX || 0; this.look.y += e.movementY || 0; }
    });
    document.addEventListener('pointerlockchange', () => { if (this.onLockChange) this.onLockChange(this.locked); });
    addEventListener('blur', () => this.clear());
  }

  get locked() { return document.pointerLockElement === this.canvas; }
  // Must be called from a user gesture (click / key press). Failures (e.g. headless browsers) are ignored.
  lock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ }
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
