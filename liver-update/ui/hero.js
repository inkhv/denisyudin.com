/* Обложка: бланк теста связи чисел, который «заполняет» линия пера (детерминированный, seed 25). */
import { $, mulberry32, shuffle } from './core.js';

/* ------------------------------------------------------------ hero sheet (signature) */
export function initHero() {
  const host = $('#heroSheet'); if (!host) return;
  const rnd = mulberry32(25);
  const cells = shuffle(Array.from({ length: 25 }, (_, i) => i), rnd);
  const pad = 22, top = 44, size = 300, cw = (size - 2 * pad) / 5, ch = (size - top - 16) / 5;
  const pts = [];
  for (let n = 0; n < 25; n++) {
    const c = cells[n], r = Math.floor(c / 5), k = c % 5;
    pts.push({ x: pad + k * cw + cw / 2 + (rnd() - .5) * cw * .42, y: top + r * ch + ch / 2 + (rnd() - .5) * ch * .4 });
  }
  const d = 'M' + pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L');
  let s = '<svg viewBox="0 0 300 300" aria-hidden="true"><path class="hs-path" pathLength="1" d="' + d + '"/>';
  pts.forEach((p, i) => { s += '<circle class="hs-circle" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="12"/><text class="hs-num" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '">' + (i + 1) + '</text>'; });
  s += '</svg>';
  host.insertAdjacentHTML('beforeend', s);
}
