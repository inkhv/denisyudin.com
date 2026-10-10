/* Гипераммониемия на доцирротической стадии — интерактивная версия доклада (/liver-update/).
   Точка входа ES-модулей без зависимостей: навигация по главам (hash), «линия пера» по пройденным
   главам, пейджер, ключевые выводы и запуск интерактивов из ui/* в том же порядке, что в /liver/app.js.
   Прогресс хранится только в localStorage этого браузера.
   События для внешних слоёв (3D): 'lu:route', 'lu:flow', 'lu:cycle', 'lu:break', 'lu:unlock',
   'lu:case', 'lu:quiz', 'lu:tsch' — см. on()/emit() в ui/core.js. */
import { $, $$, reduceMotion, state, save, toast, emit, unlock, onUnlock, onProgress } from './ui/core.js';
import { initCharts, redrawCharts } from './ui/charts.js';
import { initHero } from './ui/hero.js';
import { initFlow } from './ui/flow.js';
import { initPredict } from './ui/predict.js';
import { initCycle } from './ui/cycle.js';
import { initWho } from './ui/who.js';
import { initInterpreter } from './ui/interpreter.js';
import { initTsch } from './ui/tsch.js';
import { initAnt } from './ui/ant.js';
import { initEvidence } from './ui/evidence.js';
import { initRegimens } from './ui/regimens.js';
import { initCase } from './ui/case.js';
import { initQuiz, renderFinal } from './ui/quiz.js';
import { initShare } from './ui/share.js';
import { initScenes, isCalm } from './ui/scenes.js';
import { initMotion } from './ui/motion.js';

/* ------------------------------------------------------------ chapters & routing */
const ORDER = ['start', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'final'];
const chapters = ORDER.map((id) => document.getElementById(id));
let current = null;

function chDone(id) {
  switch (id) {
    case 'ch1': return !!state.t[1];
    case 'ch2': return !!state.t[2];
    case 'ch3': return !!state.t[3];
    case 'ch4': return !!state.t[4];
    case 'ch5': return !!state.t[5];
    case 'ch6': return !!state.caseDone;
    case 'final': return !!state.quizDone;
    default: return false;
  }
}

function updateTrail() {
  $$('.trail li').forEach((li, i, all) => {
    const id = li.getAttribute('data-ch');
    li.classList.toggle('is-current', id === current);
    li.classList.toggle('is-done', chDone(id));
    const prev = i > 0 ? all[i - 1].getAttribute('data-ch') : null;
    li.classList.toggle('is-linked', !!prev && chDone(prev) && chDone(id));
    const a = li.querySelector('a');
    if (id === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
  });
}

function chTitle(id) {
  const el = document.getElementById(id);
  return el ? el.getAttribute('data-title') : '';
}

function updatePager() {
  const i = ORDER.indexOf(current);
  const prev = $('#pagerPrev'), next = $('#pagerNext');
  if (i <= 0) { prev.setAttribute('aria-hidden', 'true'); prev.tabIndex = -1; }
  else {
    prev.removeAttribute('aria-hidden'); prev.removeAttribute('tabindex');
    prev.href = '#' + ORDER[i - 1];
    $('#pagerPrevT').textContent = ORDER[i - 1] === 'start' ? 'Начало' : chTitle(ORDER[i - 1]);
  }
  if (i >= ORDER.length - 1) {
    next.href = '#start';
    next.querySelector('small').textContent = 'В начало';
    $('#pagerNextT').textContent = 'К обложке доклада';
  } else {
    next.href = '#' + ORDER[i + 1];
    next.querySelector('small').textContent = i === 0 ? 'Начать' : 'Далее';
    $('#pagerNextT').textContent = chTitle(ORDER[i + 1]);
  }
  $('#pagerPos').textContent = i === 0 ? 'Обложка' : 'Глава ' + i + ' из 7';
}

function show(id, inner, fromNav) {
  const ch = document.getElementById(id) || chapters[0];
  chapters.forEach((c) => { const on = c === ch; c.classList.toggle('is-active', on); c.hidden = !on; });
  const prevId = current;
  const changed = current !== ch.id;
  current = ch.id;
  document.body.classList.toggle('at-start', current === 'start');
  state.seen[current] = true; save();
  updateTrail(); updatePager();
  document.title = (current === 'start' ? '' : chTitle(current) + ' — ') + 'Гипераммониемия на доцирротической стадии';
  if (current === 'final') renderFinal();
  let go = null;
  if (inner) {
    go = () => { inner.scrollIntoView({ behavior: fromNav && !reduceMotion ? 'smooth' : 'auto', block: 'start' }); };
    if (!fromNav) { setTimeout(go, 80); setTimeout(go, 400); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { setTimeout(go, 30); }); }
  }
  requestAnimationFrame(() => {
    if (inner) {
      go();
    } else if (changed) {
      window.scrollTo(0, 0);
      if (fromNav) { const h = ch.querySelector('h2[tabindex]'); if (h) h.focus({ preventScroll: true }); }
    }
    redrawCharts(ch);
  });
  // id: active chapter; prev: chapter before this call (null on boot, may equal id); inner: hash target inside the chapter
  emit('route', { id: current, prev: prevId, inner: inner ? inner.id : null, fromNav: !!fromNav });
}

function route(fromNav) {
  const hash = decodeURIComponent(location.hash.replace(/^#/, '')) || 'start';
  const target = document.getElementById(hash);
  const ch = target ? target.closest('.chapter') : null;
  if (!ch) { show('start', null, fromNav); return; }
  show(ch.id, target !== ch ? target : null, fromNav);
}

/* ------------------------------------------------------------ takeaways */
function renderTakeaways() {
  $$('[data-takeaway]').forEach((el) => { el.classList.toggle('is-locked', !state.t[el.getAttribute('data-takeaway')]); });
}
// called by core.unlock(n) right after the takeaway is marked in state
function openTakeaway(n) {
  const el = $('[data-takeaway="' + n + '"]');
  if (el) { el.classList.remove('is-locked'); el.classList.add('just-opened'); setTimeout(() => { el.classList.remove('just-opened'); }, 1300); }
  toast('Ключевой вывод ' + n + ' открыт');
  updateTrail();
}

/* ------------------------------------------------------------ boot (same order as /liver/app.js) */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* переход между главами: View Transitions API (кружок главы из шапки становится номером главы
   на сцене); без поддержки или при пониженной анимации — обычная смена с проявлением */
function chapterOf(hash) {
  const el = document.getElementById(decodeURIComponent(hash.replace(/^#/, '')) || 'start');
  const ch = el ? el.closest('.chapter') : null;
  return { ch: ch ? ch.id : 'start', inner: !!el && !!ch && el !== ch };
}
window.addEventListener('hashchange', () => {
  const t = chapterOf(location.hash);
  if (!document.startViewTransition || isCalm() || t.ch === current || t.inner) { route(true); return; }
  const dot = $('.trail li[data-ch="' + t.ch + '"] .dot');
  const num = $('#' + t.ch + ' .stage-num');
  if (dot && num) dot.style.viewTransitionName = 'chnum';
  const vt = document.startViewTransition(() => {
    route(true);
    window.scrollTo(0, 0);
    if (dot) dot.style.viewTransitionName = '';
    if (dot && num) num.style.viewTransitionName = 'chnum';
  });
  vt.finished.finally(() => { if (num) num.style.viewTransitionName = ''; });
});

onUnlock(openTakeaway);
onProgress(updateTrail);
$$('[data-unlock]').forEach((b) => { b.addEventListener('click', () => { unlock(+b.getAttribute('data-unlock')); }); });

initCharts();
initHero();
initFlow();
initPredict();
initCycle();
initWho();
initInterpreter();
initTsch();
initAnt();
initEvidence();
initRegimens();
initCase();
initQuiz();
initShare();
initScenes();
initMotion();

renderTakeaways();
route(false);

// boot succeeded: keep the interactive layout (also if the 8-second no-js fallback already fired on a slow load)
document.documentElement.classList.replace('no-js', 'js');
document.documentElement.classList.add('booted');
