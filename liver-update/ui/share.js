/* Финал: поделиться ссылкой (Web Share API → буфер обмена → запасной вариант) и сброс прогресса. */
import { $, clearSaved } from './core.js';

const SHARE_URL = 'https://denisyudin.com/liver-update';

/* ------------------------------------------------------------ final: share & reset */
export function initShare() {
  const btn = $('#copyLink'); if (!btn) return;
  const url = SHARE_URL, label = btn.querySelector('span');
  if (navigator.share) label.textContent = 'Поделиться ссылкой';
  btn.addEventListener('click', () => {
    if (navigator.share) { navigator.share({ title: 'Гипераммониемия на доцирротической стадии — интерактивный доклад', url: url }).catch(() => {}); return; }
    const done = () => { label.textContent = 'Ссылка скопирована'; setTimeout(() => { label.textContent = 'Скопировать ссылку'; }, 2200); };
    const fallback = () => { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); done(); } catch (e) { label.textContent = url; } i.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { fallback(); });
    else fallback();
  });
  $('#resetAll').addEventListener('click', () => {
    if (!window.confirm('Сбросить прогресс и пройти доклад заново?')) return;
    clearSaved();
    // replaceState, а не location.hash: hashchange успел бы записать прогресс обратно до перезагрузки
    history.replaceState(null, '', location.pathname + location.search + '#start'); location.reload();
  });
}
