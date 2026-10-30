// Rebindable keyboard actions. Each action has two key slots (KeyboardEvent.code values). Esc is reserved for pause/back.

export const ACTIONS = [
  { id: 'moveFwd', keys: ['KeyW', 'ArrowUp'] },
  { id: 'moveBack', keys: ['KeyS', 'ArrowDown'] },
  { id: 'moveLeft', keys: ['KeyA', null] },
  { id: 'moveRight', keys: ['KeyD', null] },
  { id: 'turnLeft', keys: ['ArrowLeft', null] },
  { id: 'turnRight', keys: ['ArrowRight', null] },
  { id: 'sprint', keys: ['ShiftLeft', 'ShiftRight'] },
  { id: 'jump', keys: ['Space', null] },
  { id: 'flashlight', keys: ['KeyF', null] },
  { id: 'workLights', keys: ['KeyL', null] },
  { id: 'map', keys: ['KeyM', null] },
  { id: 'guide', keys: ['KeyG', null] },
  { id: 'use', keys: ['KeyE', null] },
  { id: 'hotbar1', keys: ['Digit1', null] },
  { id: 'hotbar2', keys: ['Digit2', null] },
  { id: 'hotbar3', keys: ['Digit3', null] },
  { id: 'hotbar4', keys: ['Digit4', null] },
  { id: 'hotbar5', keys: ['Digit5', null] },
  { id: 'hotbar6', keys: ['Digit6', null] },
  { id: 'hotbar7', keys: ['Digit7', null] },
  { id: 'hotbar8', keys: ['Digit8', null] },
  { id: 'toggleHud', keys: ['KeyH', null] },
];
export const RESERVED = new Set(['Escape']);

export const defaultKeys = () => Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.keys]]));

// Accepts only known actions and plausible key codes; a code may be used by one action only.
export function sanitizeKeys(raw) {
  const out = defaultKeys();
  if (!raw || typeof raw !== 'object') return out;
  const used = new Set();
  for (const a of ACTIONS) {
    const slots = Array.isArray(raw[a.id]) ? raw[a.id] : a.keys;
    out[a.id] = [0, 1].map((i) => {
      const c = slots[i];
      if (typeof c !== 'string' || c.length > 24 || !/^[A-Za-z0-9]+$/.test(c) || RESERVED.has(c) || used.has(c)) return null;
      used.add(c); return c;
    });
  }
  return out;
}

const NAMES = { Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export function keyLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  const n = /^Numpad(.+)$/.exec(code);
  return n ? 'Num ' + n[1] : code;
}

// Short human-readable labels for HUD hints.
export const firstKey = (keys, id) => keyLabel(keys[id][0] || keys[id][1]);
export const moveLabel = (keys) => ['moveFwd', 'moveLeft', 'moveBack', 'moveRight'].map((id) => firstKey(keys, id)).join('');
