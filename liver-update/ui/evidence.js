/* Глава 5: исследования L-орнитин-L-аспартата (STUDIES) с фильтром по популяции (TAGNAME). */
import { STUDIES, TAGNAME } from '../data.js';
import { $, $$, esc, state, save, unlock } from './core.js';
import { vbar, pruneCharts } from './charts.js';

/* ------------------------------------------------------------ chapter 5: evidence explorer */
export function initEvidence() {
  const list = $('#evList'), det = $('#evDetail'), filt = $('#evFilter'); if (!list) return;
  let f = 'all', sel = null;
  function renderList() {
    const items = STUDIES.filter((s) => f === 'all' || s.tags.indexOf(f) >= 0);
    if (!sel || items.indexOf(sel) < 0) sel = items[0];
    list.innerHTML = items.map((s) => '<li><button type="button" data-id="' + s.id + '" aria-pressed="' + (s === sel) + '"><span class="ev-name">' + esc(s.name) + '</span><span class="ev-who">' + esc(s.who) + '</span></button></li>').join('');
    renderDetail(false);
  }
  function renderDetail(user) {
    const s = sel; if (!s) return;
    let h = '<div class="ev-tags">' + s.tags.map((t) => '<span class="tag">' + TAGNAME[t] + '</span>').join('') + '</div>' +
      '<h4>' + esc(s.name) + '</h4><p style="color:var(--ink-3);margin:0 0 .4rem">' + esc(s.who) + '</p>' +
      '<dl class="kv"><dt>Пациенты</dt><dd>' + esc(s.pop) + '</dd><dt>Дизайн</dt><dd>' + esc(s.design) + '</dd><dt>Результат</dt><dd>' + esc(s.result) + '</dd></dl>';
    if (s.stats) h += '<div class="stats" style="margin-top:6px">' + s.stats.map((x) => '<div class="stat"><b>' + esc(x.v) + '</b><p>' + esc(x.l) + '</p></div>').join('') + '</div>';
    if (s.charts) h += '<div class="grid-2 ' + (s.charts.length > 1 ? 'even' : '') + '" style="margin-top:6px">' + s.charts.map((_, i) => '<div class="chart" id="evc' + i + '"' + (s.charts.length === 1 ? ' style="grid-column:1/-1"' : '') + '></div>').join('') + '</div>';
    h += '<p class="src">' + esc(s.who) + '. ' + esc(s.src) + '</p>';
    det.innerHTML = h;
    pruneCharts();
    if (s.charts) s.charts.forEach((c, i) => { vbar($('#evc' + i), c); });
    if (user) {
      state.ev[s.id] = true; save();
      if (Object.keys(state.ev).length >= 2) unlock(5);
    }
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    sel = STUDIES.filter((s) => s.id === b.getAttribute('data-id'))[0];
    $$('button', list).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); });
    renderDetail(true);
  });
  filt.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]'); if (!b) return;
    f = b.getAttribute('data-f');
    $$('button', filt).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); });
    renderList();
  });
  renderList();
}
