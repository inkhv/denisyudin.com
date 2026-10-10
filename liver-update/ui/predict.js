/* Глава 1: «Проверьте интуицию» — оценка читателя против российских когорт (COHORTS). */
import { COHORTS } from '../data.js';
import { $, state, save, unlock } from './core.js';
import { hbar, redrawCharts } from './charts.js';

/* ------------------------------------------------------------ chapter 1: predict, then reveal */
export function initPredict() {
  const r = $('#guess'), out = $('#guessOut'), btn = $('#guessBtn'); if (!r) return;
  let drawn = false;
  function upd() { out.textContent = r.value + ' %'; }
  r.addEventListener('input', () => { upd(); if (drawn) reveal(true); });
  function reveal(silent) {
    const g = +r.value;
    $('#predictResult').hidden = false;
    const el = $('#cohortChart');
    if (!drawn) { drawn = true; hbar(el, { title: 'Доля пациентов с гипераммониемией, %', rows: COHORTS, max: 100, unit: ' %', get guide() { return +r.value; } }); }
    else redrawCharts(el.parentNode);
    let msg;
    if (g < 50) msg = '<h4>Реальность выше вашей оценки</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
    else if (g <= 90) msg = '<h4>Близко к реальности</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
    else msg = '<h4>Чуть выше реальности</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
    msg += '<p>Это амбулаторные пациенты без явной энцефалопатии: гипераммониемию у них находят, только если её ищут.</p>';
    const fb = $('#predictFb'); fb.innerHTML = msg; fb.className = 'result ' + (g < 50 ? 'is-strong' : 'is-ok');
    state.guess = g; save();
    if (!silent) unlock(1);
  }
  btn.addEventListener('click', () => { reveal(false); });
  if (state.guess != null) { r.value = state.guess; upd(); reveal(true); } else upd();
}
