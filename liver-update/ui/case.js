/* Глава 6: клинический пример в три решения (CASE_Q) и динамика на шаге 4 (CASE_CHART). */
import { CASE_Q, CASE_CHART } from '../data.js';
import { $, $$, esc, reduceMotion, state, save, toast, progressChanged, emit } from './core.js';
import { vbar, redrawCharts } from './charts.js';

/* ------------------------------------------------------------ chapter 6: case */
export function initCase() {
  const box = $('#case'); if (!box) return;
  const KEYS = ['А', 'Б', 'В', 'Г'];
  let step = 0, solved = {};
  const steps = $$('.case-step', box), bars = $$('.steps-bar span', box);
  const back = $('#caseBack'), nxt = $('#caseNext'), again = $('#caseRestart');
  CASE_Q.forEach((q, qi) => {
    const host = $('.opts[data-q="' + qi + '"]', box);
    host.innerHTML = q.opts.map((o, i) => '<button type="button" class="opt" data-i="' + i + '"><span class="key">' + KEYS[i] + '</span><span>' + esc(o[0]) + '</span></button>').join('');
    host.addEventListener('click', (e) => {
      const b = e.target.closest('.opt'); if (!b) return;
      const i = +b.getAttribute('data-i'), right = i === q.correct;
      b.classList.remove('right', 'wrong'); b.classList.add(right ? 'right' : 'wrong');
      const fb = host.nextElementSibling; fb.hidden = false; fb.className = 'fb ' + (right ? 'right' : 'wrong'); fb.textContent = q.opts[i][1];
      if (right) { solved[qi] = true; nav(); nxt.focus({ preventScroll: true }); }
    });
  });
  function nav() {
    steps.forEach((s, i) => { s.hidden = i !== step; });
    bars.forEach((b, i) => { b.classList.toggle('on', i <= step); });
    back.hidden = step === 0;
    nxt.hidden = step >= 3 || !solved[step];
    again.hidden = step < 3;
  }
  function go(n) {
    step = n; nav();
    box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (step === 3) {
      if (!$('#caseChart').innerHTML) vbar($('#caseChart'), CASE_CHART);
      else redrawCharts(box);
      if (!state.caseDone) { state.caseDone = true; save(); progressChanged(); toast('Клинический пример пройден'); }
    }
    emit('case', { step });
  }
  back.addEventListener('click', () => { go(Math.max(0, step - 1)); });
  nxt.addEventListener('click', () => { go(Math.min(3, step + 1)); });
  again.addEventListener('click', () => {
    solved = {};
    $$('.opt', box).forEach((o) => { o.classList.remove('right', 'wrong'); });
    $$('.fb', box).forEach((f) => { f.hidden = true; });
    go(0);
  });
  nav();
}
