/* Глава 4: тест называния животных — 60 секунд, счётчик по нажатию. */
import { $, icon, unlock } from './core.js';

/* ------------------------------------------------------------ chapter 4: animal naming test */
export function initAnt() {
  const startB = $('#antStart'), tap = $('#antTap'); if (!startB) return;
  let count = 0, t0 = 0, raf = 0, running = false;
  const C = 326.73, DUR = 60000;
  const prog = $('#antProg'), cnt = $('#antCount'), left = $('#antLeft'), res = $('#antResult');
  function frame() {
    if (!running) return;
    const el = performance.now() - t0, rem = Math.max(0, DUR - el);
    prog.setAttribute('stroke-dashoffset', (C * el / DUR).toFixed(2));
    left.textContent = Math.ceil(rem / 1000) + ' с';
    if (rem <= 0) return end();
    raf = requestAnimationFrame(frame);
  }
  function end() {
    running = false; cancelAnimationFrame(raf); tap.disabled = true;
    startB.innerHTML = icon('restart') + 'Ещё раз'; left.textContent = 'время вышло';
    let cls, head, txt;
    if (count >= 15) { cls = 'is-ok'; head = count + ' — в пределах нормы'; txt = '15 и больше животных за минуту не характерно для скрытой энцефалопатии.'; }
    else if (count >= 10) { cls = 'is-strong'; head = count + ' — характерно для скрытой энцефалопатии'; txt = 'У пациентов с циррозом 10–14 животных за минуту соответствовали минимальной энцефалопатии или I стадии.'; }
    else { cls = 'is-strong'; head = count + ' — характерно для явной энцефалопатии'; txt = 'Меньше 10 животных у пациентов с циррозом соответствовало энцефалопатии II стадии и выше. Учтите возраст, образование и усталость.'; }
    res.innerHTML = '<div class="result ' + cls + '"><h4>' + head + '</h4><p>' + txt + ' Экранная версия — демонстрация методики.</p></div>';
    unlock(4);
  }
  startB.addEventListener('click', () => {
    count = 0; cnt.textContent = '0'; res.innerHTML = ''; prog.setAttribute('stroke-dashoffset', '0');
    running = true; tap.disabled = false; t0 = performance.now(); startB.innerHTML = icon('restart') + 'Заново'; tap.focus(); frame();
  });
  tap.addEventListener('click', () => { if (!running) return; count++; cnt.textContent = String(count); });
}
