/* Глава 5: таблица режимов НОГР-2025 — подсветка строки по выбранной ситуации. */
import { $, $$ } from './core.js';

/* ------------------------------------------------------------ chapter 5: regimens */
export function initRegimens() {
  const seg = $('#regSeg'), tbl = $('#regTable'); if (!seg) return;
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-r]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true', key = b.getAttribute('data-r');
    $$('button', seg).forEach((x) => { x.setAttribute('aria-pressed', String(on && x === b)); });
    tbl.classList.toggle('has-pick', on);
    $$('tbody tr', tbl).forEach((tr) => { tr.classList.toggle('pick', on && tr.getAttribute('data-r') === key); });
  });
}
