/* Общие утилиты интерактивного доклада: DOM-хелперы, форматирование, состояние (localStorage),
   toast, шина событий 'lu:*' и реестр прогресса. Модули ui/* импортируют только отсюда,
   из charts.js и из data.js — никогда из main.js (так нет циклических импортов). */
export { COLORS } from '../data.js';

/* ------------------------------------------------------------ utilities */
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
export const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Russian number format: decimal comma, non-breaking space (U+00A0) between thousands
export function fmt(v, d) {
  if (v == null || isNaN(v)) return '—';
  if (d == null) d = Number.isInteger(v) ? 0 : (Math.abs(v) < 1 ? 3 : 1);
  return v.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function icon(id, cls) { return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function shuffle(arr, rnd) { rnd = rnd || Math.random; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

/* ------------------------------------------------------------ state */
const KEY = 'liver-update-v1';
function defaults() { return { t: {}, caseDone: false, quiz: {}, quizDone: false, guess: null, seen: {}, ev: {}, tsch: null }; }
// shared progress: t = unlocked takeaways {1..5: true}, caseDone, quiz answers, quizDone, guess, seen chapters, ev studies, tsch times
export const state = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); const d = defaults(); for (const k in s) d[k] = s[k]; return d; }
  catch (e) { return defaults(); }
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: progress lives only in memory */ } }
export function clearSaved() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } }

/* ------------------------------------------------------------ toast */
let toastEl = null, toastTimer = 0;
export function toast(msg) {
  if (!toastEl) toastEl = $('#toast');
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 2400);
}

/* ------------------------------------------------------------ event bus
   Внешние слои (3D, моушен) слушают события 'lu:<type>' на document; detail — объект с данными.
   on() возвращает функцию отписки. Обработчик получает сам CustomEvent (данные — в e.detail). */
export function emit(type, detail) { document.dispatchEvent(new CustomEvent('lu:' + type, { detail })); }
export function on(type, fn) {
  document.addEventListener('lu:' + type, fn);
  return () => { document.removeEventListener('lu:' + type, fn); };
}

/* ------------------------------------------------------------ unlock & progress registry
   ui/* сообщают о прогрессе сюда; main.js регистрирует обработчики: открыть вывод (toast, анимация)
   и перерисовать «линию пера». */
const unlockHandlers = [], progressHandlers = [];
export function onUnlock(fn) { unlockHandlers.push(fn); }
export function onProgress(fn) { progressHandlers.push(fn); }
export function progressChanged() { progressHandlers.forEach((fn) => { fn(); }); }
export function unlock(n) {
  if (state.t[n]) return;
  state.t[n] = true; save();
  unlockHandlers.forEach((fn) => { fn(n); });
  emit('unlock', { n });
}
