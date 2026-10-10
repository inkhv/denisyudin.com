/* Глава 4: тест связи чисел (форма А) на экране — новый случайный бланк на каждый старт.
   События 'lu:tsch': { phase: 'start' | 'hit' | 'miss' | 'finish', n, sec }
   n — число, которого коснулись (0 при старте, 25 при финише); sec — секунды от старта. */
import { $, $$, fmt, icon, shuffle, state, save, unlock, emit } from './core.js';

/* ------------------------------------------------------------ chapter 4: number connection test */
export function initTsch() {
  const board = $('#board'), svg = $('#boardLines'), cover = $('#boardCover'); if (!board) return;
  const pos = {};
  let next = 1, errors = 0, t0 = 0, raf = 0, running = false, last = null;
  const timeEl = $('#tschTime'), nextEl = $('#tschNext'), errEl = $('#tschErr'), res = $('#tschResult');
  function clock(ms) { return fmt(ms / 1000, 1) + ' с'; }
  function layout() {
    $$('.tc', board).forEach((b) => { b.remove(); }); svg.innerHTML = '';
    const cells = shuffle(Array.from({ length: 25 }, (_, i) => i));
    const pad = 7, cell = (100 - 2 * pad) / 5, byCell = [];
    for (let n = 1; n <= 25; n++) {
      const c = cells[n - 1], r = Math.floor(c / 5), k = c % 5;
      const x = pad + k * cell + cell / 2 + (Math.random() - .5) * cell * .24;
      const y = pad + r * cell + cell / 2 + (Math.random() - .5) * cell * .24;
      pos[n] = { x: x, y: y }; byCell[c] = n;
    }
    byCell.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tc'; b.textContent = n; b.setAttribute('data-n', n);
      b.setAttribute('aria-label', 'Число ' + n);
      b.style.left = pos[n].x + '%'; b.style.top = pos[n].y + '%';
      board.appendChild(b);
    });
  }
  function tick() { if (!running) return; timeEl.textContent = clock(performance.now() - t0); raf = requestAnimationFrame(tick); }
  function start() {
    cancelAnimationFrame(raf);
    layout(); next = 1; errors = 0; last = null;
    nextEl.textContent = '1'; errEl.textContent = '0'; timeEl.textContent = clock(0); res.innerHTML = '';
    $$('#tschBands tr').forEach((tr) => { tr.classList.remove('hit'); });
    cover.hidden = true; running = true; t0 = performance.now(); tick();
    const first = $('.tc', board); if (first) first.focus({ preventScroll: true });
    emit('tsch', { phase: 'start', n: 0, sec: 0 });
  }
  function finish() {
    running = false; cancelAnimationFrame(raf);
    const ms = performance.now() - t0, sec = ms / 1000;
    timeEl.textContent = clock(ms);
    const rows = $$('#tschBands tbody tr');
    let hit = null;
    rows.some((tr) => { if (sec <= +tr.getAttribute('data-max')) { hit = tr; return true; } return false; });
    if (hit) hit.classList.add('hit');
    const best = state.tsch && state.tsch.best ? Math.min(state.tsch.best, sec) : sec;
    state.tsch = { last: sec, best: best, errors: errors }; save();
    const ok = sec <= 40;
    res.innerHTML = '<div class="result ' + (ok ? 'is-ok' : 'is-strong') + '"><h4>' + fmt(sec, 1) + ' с, ошибок: ' + errors + '</h4><p>' +
      (ok ? 'Быстрее 40 секунд — на бумажном бланке это соответствовало бы норме.' : 'На бумажном бланке такое время соответствовало бы строке, выделенной в таблице. На экране результат зависит от устройства — это демонстрация, а не диагноз.') +
      '</p><p style="margin:0">Лучшее время в этом браузере: ' + fmt(best, 1) + ' с.</p></div>' +
      '<button class="btn btn-ghost" type="button" id="tschAgain" style="margin-top:12px">' + icon('restart') + 'Ещё раз, новый бланк</button>';
    $('#tschAgain').addEventListener('click', start);
    emit('tsch', { phase: 'finish', n: last, sec });
    unlock(4);
  }
  board.addEventListener('click', (e) => {
    const b = e.target.closest('.tc'); if (!b || !running) return;
    const n = +b.getAttribute('data-n');
    if (n === next) {
      b.classList.add('done');
      if (last) {
        const p = pos[last], q = pos[n];
        svg.insertAdjacentHTML('beforeend', '<line class="board-line" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '"/>');
        const prevBtn = $('.tc[data-n="' + last + '"]', board); if (prevBtn) prevBtn.classList.remove('last');
      }
      b.classList.add('last'); last = n; next++;
      nextEl.textContent = next > 25 ? '—' : String(next);
      emit('tsch', { phase: 'hit', n, sec: (performance.now() - t0) / 1000 });
      if (next > 25) finish();
    } else if (!b.classList.contains('done')) {
      errors++; errEl.textContent = String(errors);
      b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss');
      emit('tsch', { phase: 'miss', n, sec: (performance.now() - t0) / 1000 });
    }
  });
  $('#tschStart').addEventListener('click', start);
}
