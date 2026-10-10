/* Глава 3: чек-лист «Кому измерять аммиак» по НОГР-2025. */
import { $, $$, esc, unlock } from './core.js';

/* ------------------------------------------------------------ chapter 3: who to test */
export function initWho() {
  const bg = $('#bgChecks'), sym = $('#symChecks'), out = $('#whoResult'); if (!bg) return;
  function names(fs) { return $$('input:checked', fs).map((i) => i.closest('label').querySelector('span').firstChild.textContent.trim()); }
  function render() {
    const b = names(bg), s = names(sym);
    if (!b.length && !s.length) {
      out.className = 'result'; out.innerHTML = '<h4>Здесь появится рекомендация</h4><p class="empty">Отметьте заболевание печени и жалобы пациента слева.</p>'; return;
    }
    if (b.length && s.length) {
      out.className = 'result is-strong';
      out.innerHTML = '<h4>Показано: аммиак крови и тест связи чисел</h4>' +
        '<p>Заболевание печени (' + esc(b.join(', ').toLowerCase()) + ') и жалобы (' + esc(s.join(', ').toLowerCase()) + ') — ситуация, в которой НОГР-2025 рекомендует измерить аммиак.</p>' +
        '<ul><li>Аммиак ≥ 60 мкмоль/л (капиллярная кровь) и/или тест связи чисел дольше 40 с — латентная гипераммониемия.</li><li>Исключите непечёночные причины: лекарства, шунты, инфекции, врождённые дефекты.</li><li>Лечение основного заболевания + L-орнитин-L-аспартат 9 г в сутки 4 недели, затем контроль аммиака и теста.</li></ul>' +
        '<p style="margin:0"><a href="#ammonia">Расшифровать результат анализа →</a></p>';
      unlock(3); return;
    }
    if (b.length) {
      out.className = 'result is-ok';
      out.innerHTML = '<h4>Активно расспросите о жалобах</h4><p>Латентная гипераммониемия редко звучит в жалобах сама. Спросите об утомляемости, сне, памяти и внимании, мышечной силе; тест связи чисел займёт 1–2 минуты.</p>';
      return;
    }
    out.className = 'result is-warn';
    out.innerHTML = '<h4>Оцените печень и группу риска</h4><p>Без известного заболевания печени начните с АЛТ, АСТ, ГГТП, УЗИ и FIB-4. НОГР-2025 рекомендует измерять аммиак и вне выявленных болезней печени — у лиц из групп риска: избыточные физические и психоэмоциональные нагрузки, ночные смены, депривация сна, алкоголь, онкологические заболевания, постковидный синдром.</p>';
  }
  bg.addEventListener('change', render); sym.addEventListener('change', render);
  render();
}
