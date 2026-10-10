/* Глава 1: схема обмена аммиака — переключение состояния печени (FLOW). */
import { FLOW } from '../data.js';
import { $, $$, emit } from './core.js';

/* ------------------------------------------------------------ chapter 1: flow scenarios */
export function initFlow() {
  const seg = $('#flowSeg'); if (!seg) return;
  function set(key) {
    const f = FLOW[key];
    $$('button', seg).forEach((b) => { b.setAttribute('aria-pressed', String(b.getAttribute('data-s') === key)); });
    $$('[data-fl="cap"]').forEach((cap) => { cap.setAttribute('width', (+cap.getAttribute('data-w') * f.cap / 100).toFixed(1)); cap.classList.toggle('low', f.cap < 50); });
    $('#flCapV').textContent = f.capV; $('#flCapNote').textContent = f.capNote;
    const bar = $('#flCapBar'); bar.style.width = f.cap + '%'; bar.classList.toggle('low', f.cap < 50);
    $('#flNh3').textContent = f.nh3;
    const flag = $('#flFlag'); flag.className = 'flag flag-' + f.flag; flag.textContent = f.flag === 'h' ? '↑' : (f.flag === 'n' ? 'N' : '—');
    $('#flWhere').textContent = f.where;
    $$('[data-fl="blood"]').forEach((x) => { x.setAttribute('fill', f.blood); });
    $$('[data-fl="shunt"]').forEach((x) => { x.classList.toggle('on', f.shunt); });
    $$('[data-fl="shuntT"]').forEach((x) => { x.style.opacity = f.shunt ? 1 : 0; });
    $$('[data-fl="portal"]').forEach((x) => { x.setAttribute('stroke-width', f.shunt ? 3 : 7); });
    $('#flText').textContent = f.text; $('#flSrc').textContent = f.src;
    emit('flow', { key });
  }
  seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b) set(b.getAttribute('data-s')); });
  // the markup already shows «Норма»; announce it without re-rendering (set() would alter the static texts)
  emit('flow', { key: 'norm' });
}
