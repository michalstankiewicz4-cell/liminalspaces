// Tiny i18n layer: t(key, params), bind(el, key) for static texts, onLang(fn) for dynamic UI.
import en from './en.js';
import pl from './pl.js';

export const LANGS = [{ id: 'en', name: 'English' }, { id: 'pl', name: 'Polski' }];
const dicts = { en, pl };
let lang = 'en';
const bound = new Map();       // element -> { key, attr, params }
const subs = new Set();

export const getLang = () => lang;
export function t(key, params) {
  const s = dicts[lang][key] ?? dicts.en[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m)) : s;
}
const apply = (el, b) => { const v = t(b.key, b.params); if (b.attr) el.setAttribute(b.attr, v); else el.textContent = v; };

// Keeps `el` (its text, or attribute `attr`) in sync with the current language.
export function bind(el, key, attr, params) {
  const b = { key, attr, params };
  bound.set(el, b); apply(el, b);
  return el;
}
export function setLang(l) {
  if (!dicts[l] || l === lang) return;
  lang = l;
  document.documentElement.lang = l;
  for (const [el, b] of bound) { if (!el.isConnected) bound.delete(el); else apply(el, b); }
  subs.forEach((f) => f(l));
}
export const onLang = (fn) => { subs.add(fn); return () => subs.delete(fn); };
