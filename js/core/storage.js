// localStorage wrappers (all failures are swallowed: private mode, blocked storage, quota...).
export const KEYS = { save: 'ls:save:v1', settings: 'ls:settings:v1', pathMap: 'ls:pathmap:v1', tumiMap: 'ls:tumimap:v1' };

export function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}
export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
