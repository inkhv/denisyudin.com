/* Глава 2: порочный круг «стеатоз — аммиак — фиброз» (CYCLE) и точки воздействия. */
import { CYCLE } from '../data.js';
import { $, $$, esc, unlock, emit } from './core.js';

/* ------------------------------------------------------------ chapter 2: vicious cycle */
export function initCycle() {
  const list = $('#cycleList'), detail = $('#cycleDetail'), brk = $('#breakBtn'); if (!list) return;
  const ring = $('#cycleRing'), cx = 235, r = 176, seen = {};
  let sel = -1;
  let s = '<circle class="ring-line" cx="' + cx + '" cy="' + cx + '" r="' + r + '"/>';
  [-60, 0, 60, 120, 180, 240].forEach((a) => {
    const rad = a * Math.PI / 180, x = cx + r * Math.cos(rad), y = cx + r * Math.sin(rad);
    s += '<path class="ring-arrow" d="M-7,-6 L7,0 L-7,6 z" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a + 90) + ')"/>';
  });
  s += '<text class="ring-center" x="' + cx + '" y="' + (cx - 4) + '">Порочный круг</text><text class="ring-center-s" x="' + cx + '" y="' + (cx + 16) + '">НАЖМИТЕ НА ЗВЕНО</text>';
  ring.innerHTML = s;

  function render() {
    const showBrk = brk.getAttribute('aria-pressed') === 'true';
    if (sel < 0) {
      if (showBrk) {
        detail.innerHTML = '<h4>Где можно разорвать круг</h4><ul>' + CYCLE.filter((c) => c.b).map((c) => '<li><b>' + esc(c.t) + ':</b> ' + esc(c.b) + '</li>').join('') + '</ul>';
      } else {
        detail.innerHTML = '<h4>Выберите звено круга</h4><p class="empty">Каждое звено подкреплено исследованием. Откройте хотя бы три, чтобы увидеть, как они связаны.</p>';
      }
      return;
    }
    const c = CYCLE[sel];
    detail.innerHTML = '<p class="label">Звено ' + (sel + 1) + ' из 6</p><h4>' + esc(c.t) + '</h4><p>' + esc(c.d) + '</p><p class="src">' + esc(c.s) + '</p>' +
      (showBrk && c.b ? '<div class="brk"><b>Точка воздействия</b>' + esc(c.b) + '</div>' : '') +
      '<p style="margin:12px 0 0;font-size:.9rem;color:var(--ink-3)">Далее по кругу: ' + esc(CYCLE[(sel + 1) % 6].t) + '</p>';
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]'); if (!b) return;
    sel = +b.getAttribute('data-n'); seen[sel] = true;
    $$('button[data-n]', list).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); });
    b.closest('.cycle-node').classList.add('is-seen');
    render();
    emit('cycle', { n: sel });
    if (Object.keys(seen).length >= 3) unlock(2);
  });
  brk.addEventListener('click', () => {
    const on = brk.getAttribute('aria-pressed') !== 'true';
    brk.setAttribute('aria-pressed', String(on));
    brk.textContent = on ? 'Скрыть точки воздействия' : 'Показать, где можно разорвать круг';
    list.classList.toggle('show-break', on);
    render();
    emit('break', { on });
  });
}
