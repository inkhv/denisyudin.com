/* Глава 4: расшифровка анализа на аммиак — степени по Российскому консенсусу (капиллярная кровь)
   или отношение к норме лаборатории (венозная плазма), плюс проверка преаналитики. */
import { $, $$, fmt, esc, unlock } from './core.js';

/* ------------------------------------------------------------ chapter 4: ammonia interpreter */
export function initInterpreter() {
  const val = $('#nh3Val'), uln = $('#nh3Uln'), out = $('#nh3Out'); if (!val) return;
  let unit = 'umol', sample = 'cap';
  function segSet(id, attr, cb) {
    const seg = $(id);
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', seg).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); });
      cb(b.getAttribute(attr)); render();
    });
  }
  segSet('#nh3Unit', 'data-v', (v) => { unit = v; });
  segSet('#nh3Sample', 'data-v', (v) => { sample = v; $('#ulnField').hidden = v !== 'ven'; });
  function num(s) { s = String(s || '').replace(',', '.').replace(/\s/g, ''); return s === '' ? null : (isFinite(+s) ? +s : NaN); }
  function pos(v) { if (v <= 60) return v / 60 * 24; if (v <= 100) return 24 + (v - 60) / 40 * 16; if (v <= 200) return 40 + (v - 100) / 100 * 40; return Math.min(99, 80 + (v - 200) / 50 * 20); }
  function render() {
    const raw = num(val.value);
    if (raw === null) { out.innerHTML = '<div class="result"><h4>Введите результат анализа</h4><p class="empty">Расшифровка появится здесь: степень гипераммониемии по Российскому консенсусу или отношение к норме вашей лаборатории.</p></div>'; return; }
    if (isNaN(raw) || raw < 0 || raw > 2000) { out.innerHTML = '<div class="result is-warn"><h4>Не получается прочитать число</h4><p>Введите результат цифрами, например 86 или 52,5.</p></div>'; return; }
    const v = unit === 'ugdl' ? raw * 0.587 : raw;
    const conv = unit === 'ugdl' ? '<p class="lab-note">' + fmt(raw) + ' мкг/дл × 0,587 = ' + fmt(v, 1) + ' мкмоль/л</p>' : '';
    const PROBLEM = { fast: 'забор не натощак, после нагрузки или стресса', smoke: 'курение перед забором', fist: 'жгут или «работа кулаком»', ice: 'образец не охлаждён или плазма отделена позже 15 минут' };
    const unmet = $$('#preChecks input').filter((i) => !i.checked && (i.value !== 'ice' || sample === 'ven'))
      .map((i) => PROBLEM[i.value]);
    let html = '', head, text, flag, ref;
    if (sample === 'cap') {
      ref = '≤ 60';
      if (v <= 60) { flag = 'n'; head = 'Гипераммониемии нет'; text = '<p>Результат в пределах нормы для экспресс-метода. Нормальный аммиак не объясняет астению и когнитивные жалобы — ищите другие причины; при сохранении жалоб повторите анализ в сопоставимых условиях.</p>'; }
      else if (v <= 100) { flag = 'h'; head = 'Лёгкая гипераммониемия (I степень)'; text = '<ul><li>Выполните тест связи чисел и исключите непечёночные причины.</li><li>НОГР-2025: L-орнитин-L-аспартат 3–6 г 3 раза в сутки 4 недели, затем контроль аммиака и теста связи чисел.</li></ul>'; }
      else if (v <= 200) { flag = 'h'; head = 'Средняя гипераммониемия (II степень)'; text = '<ul><li>Обязателен поиск причины, в том числе непечёночной.</li><li>НОГР-2025: L-орнитин-L-аспартат 3–6 г 3 раза в сутки до 3 месяцев с контролем в процессе и по окончании.</li></ul>'; }
      else { flag = 'h'; head = 'Тяжёлая гипераммониемия (III степень)'; text = '<ul><li>Требует срочной оценки клинического состояния и поиска причины, включая непечёночные.</li><li>НОГР-2025: внутривенная терапия 10–40 г в сутки до купирования симптомов, затем приём внутрь 3–6 месяцев.</li></ul>'; }
      html += '<div class="lab"><div class="lab-row lab-head"><span>Показатель</span><span>Результат</span><span>Ед.</span><span>Флаг</span><span>Норма</span></div>' +
        '<div class="lab-row"><span class="lab-name">Аммиак, капиллярная кровь</span><span class="lab-val">' + fmt(v, v % 1 ? 1 : 0) + '<span class="lab-unit-inline">мкмоль/л</span></span><span>мкмоль/л</span><span class="flag flag-' + flag + '">' + (flag === 'h' ? '↑' : 'N') + '</span><span>' + ref + '</span></div></div>' + conv;
      html += '<div class="scale" aria-hidden="true"><div class="scale-marker" style="left:' + pos(v).toFixed(1) + '%" data-v="' + fmt(v, 0) + '"></div><div class="scale-bands"><span></span><span></span><span></span><span></span></div><div class="scale-ticks"><span>0 · норма</span><span>60 · I</span><span>100 · II</span><span>200 · III</span></div></div>';
      html += '<div class="result ' + (flag === 'h' ? 'is-strong' : 'is-ok') + '" style="margin-top:12px"><h4>' + head + '</h4>' + text + '</div>';
    } else {
      const u = num(uln.value);
      if (!u || isNaN(u) || u <= 0) { out.innerHTML = '<div class="result is-warn"><h4>Укажите норму лаборатории</h4><p>Для венозной плазмы степень оценивают относительно верхней границы нормы конкретной лаборатории — обычно 11–50 мкмоль/л.</p></div>'; return; }
      const ratio = v / u; flag = ratio > 1 ? 'h' : 'n';
      html += '<div class="lab"><div class="lab-row lab-head"><span>Показатель</span><span>Результат</span><span>Ед.</span><span>Флаг</span><span>Норма</span></div>' +
        '<div class="lab-row"><span class="lab-name">Аммиак, венозная плазма</span><span class="lab-val">' + fmt(v, v % 1 ? 1 : 0) + '<span class="lab-unit-inline">мкмоль/л</span></span><span>мкмоль/л</span><span class="flag flag-' + flag + '">' + (flag === 'h' ? '↑' : 'N') + '</span><span>≤ ' + fmt(u) + '</span></div>' +
        '<div class="lab-row"><span class="lab-name">Отношение к норме</span><span class="lab-val">' + fmt(ratio, 2) + '<span class="lab-unit-inline">× ВГН</span></span><span>× ВГН</span><span class="flag flag-' + (ratio > 1.4 ? 'h' : 'na') + '">' + (ratio > 1.4 ? '!' : '·') + '</span><span>—</span></div></div>' + conv;
      html += '<div class="result ' + (flag === 'h' ? 'is-strong' : 'is-ok') + '" style="margin-top:12px"><h4>' + (flag === 'h' ? 'Аммиак выше нормы лаборатории в ' + fmt(ratio, 1) + ' раза' : 'В пределах нормы лаборатории') + '</h4>' +
        '<p>Степени Российского консенсуса рассчитаны для капиллярной крови и экспресс-метода; для венозной плазмы ориентируйтесь на норму своей лаборатории. При циррозе отношение больше 1,4 связано с риском госпитализаций и смерти (Tranah, 2022); для доцирротической стадии такой порог не установлен.</p></div>';
    }
    if (unmet.length) {
      html += '<div class="result is-warn" style="margin-top:12px"><h4>Результат может быть ложно завышен</h4><p>Причина: ' + esc(unmet.join('; ')) + '. Повторите анализ натощак, в то же время суток и при соблюдении всех условий.</p></div>';
    }
    out.innerHTML = html;
    unlock(4);
  }
  val.addEventListener('input', render); uln.addEventListener('input', render);
  $('#preChecks').addEventListener('change', render);
}
