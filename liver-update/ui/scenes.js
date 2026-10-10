/* Режимы сцен и всё, что не требует three.js:
   - решает, запускать ли 3D (нет при пониженной анимации, «Меньше движения», экономии трафика);
   - лениво грузит gl/bridge.js после первой отрисовки; при отказе WebGL — тихо остаётся на постерах;
   - переключатель «Меньше движения» в шапке, кнопка «Включить наклон» на телефоне;
   - постеры окна дольки меняются вместе со сценарием (работают и без WebGL). */
import { $, on, emit } from './core.js';

const root = document.documentElement;
const CALM_KEY = 'liver-update-calm';
const systemCalm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let engine = null, loading = null;

function setMode(mode) { // 'wait' | 'on' | 'off'
  root.classList.toggle('gl-wait', mode === 'wait');
  root.classList.toggle('gl-on', mode === 'on');
  root.classList.toggle('gl-off', mode === 'off');
  const tilt = $('#tiltBtn');
  if (tilt) tilt.hidden = !(mode === 'on' && canTilt());
}
function canTilt() {
  return typeof window.DeviceOrientationEvent !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}
/* дешёвая проверка до загрузки three.js: без WebGL не качаем 140 КБ библиотеки */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}
function saveData() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
}
export function isCalm() { return root.classList.contains('calm') || systemCalm(); }

function start() {
  if (engine || loading) return;
  if (isCalm() || saveData() || !hasWebGL()) { setMode('off'); return; }
  setMode('wait');
  const go = () => {
    loading = import('../gl/bridge.js').then((m) => {
      loading = null;
      if (isCalm()) return;
      engine = m.boot({ onFail: () => { engine = null; setMode('off'); } });
      if (engine) setMode('on'); else setMode('off');
      if (engine && /[?&]debug\b/.test(location.search)) window.__lu = engine;
    }).catch(() => { loading = null; setMode('off'); });
  };
  // 3D — только после первой отрисовки текста
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1600 }); else setTimeout(go, 400);
}
function stop() {
  if (engine) { engine.destroy(); engine = null; }
  setMode('off');
}

export function initScenes() {
  const btn = $('#calmToggle');
  const sync = () => {
    const sys = systemCalm();
    btn.setAttribute('aria-pressed', String(isCalm()));
    btn.disabled = sys;
    btn.title = sys ? 'Пониженная анимация включена в настройках системы' : 'Без 3D-сцен и движения камеры: статичные кадры';
  };
  btn.addEventListener('click', () => {
    const on_ = !root.classList.contains('calm');
    root.classList.toggle('calm', on_);
    try { if (on_) localStorage.setItem(CALM_KEY, '1'); else localStorage.removeItem(CALM_KEY); } catch (e) { /* storage blocked: the choice lasts until reload */ }
    sync();
    if (on_) stop(); else start();
  });
  sync();
  if (window.matchMedia) window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { sync(); if (isCalm()) stop(); else start(); });

  const tilt = $('#tiltBtn');
  if (tilt) tilt.addEventListener('click', async () => {
    if (!engine) return;
    const want = tilt.getAttribute('aria-pressed') !== 'true';
    const ok = await engine.enableTilt(want);
    tilt.setAttribute('aria-pressed', String(want && ok));
    tilt.querySelector('span').textContent = want && ok ? 'Наклон включён' : 'Включить наклон';
  });

  // постер окна дольки следует за сценарием (виден до загрузки 3D и без WebGL)
  const poster = $('#flowPoster');
  on('flow', (e) => { if (poster) poster.src = 'posters/lobule-' + e.detail.key + '.webp'; });
  // в центре кольца при звене 4 появляется схема звёздчатых клеток — подпись круга уходит
  const list = $('#cycleList');
  on('cycle', (e) => { if (list) list.classList.toggle('sel-3', e.detail.n === 3); });

  initTargets();
  start();
}

/* органы-мишени: переключатель и свайп по окну; подсвечивается соответствующая карточка */
function initTargets() {
  const seg = $('#targetSeg'), win = $('#targetsGl'), poster = $('#targetsPoster');
  if (!seg) return;
  const order = ['brain', 'muscle', 'liver'];
  const cards = Array.from(document.querySelectorAll('.targets .target-card'));
  let cur = 'brain';
  const set = (m) => {
    cur = m;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === m)));
    cards.forEach((c, i) => c.classList.toggle('is-on', order[i] === m));
    if (win) win.dataset.state = JSON.stringify({ mode: m });
    if (poster) poster.src = 'posters/targets-' + m + '.webp';
    emit('target', { mode: m });
  };
  seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) set(b.dataset.t); });
  let x0 = null;
  win.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  win.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) < 40) return;
    const i = order.indexOf(cur) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < order.length) set(order[i]);
  });
  cards.forEach((c, i) => c.classList.toggle('is-on', i === 0));
}
