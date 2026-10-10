/* Микро-моушен интерфейса. Каждый приём кодирует действие пользователя или изменение данных
   и отключается при пониженной анимации (системной или «Меньше движения»):
   - «одометр» чисел: мощность цикла мочевины, крупные числа в карточках данных;
   - печать лабораторного результата как термочека анализатора, стрелка шкалы пружинит;
   - тест связи чисел: линия пера «растекается», вибрация на Android (10 мс — верно, 30–20–30 — ошибка);
   - тест называния животных: кольцо краснеет к концу минуты, счётчик откликается на нажатие;
   - клинический пример: тайм-лапс 6 месяцев на шаге динамики, плашка «учебный пример» не уходит из вида;
   - «магнитные» основные кнопки на десктопе. */
import { $, $$, on } from './core.js';
import { isCalm } from './scenes.js';

const fine = () => window.matchMedia && window.matchMedia('(pointer: fine)').matches;
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* число внутри строки: «≈ 17 %», «4 472», «ОР 2,13» → {pre, num, post, dec} */
function parseNum(s) {
  const m = String(s).match(/^(.*?)(\d{1,3}(?:[  ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(.*)$/);
  if (!m) return null;
  const sep = (m[2].match(/[  ]/) || [''])[0];
  const raw = m[2].replace(/[  ]/g, '');
  const dec = raw.includes(',') ? raw.split(',')[1].length : 0;
  return { pre: m[1], num: parseFloat(raw.replace(',', '.')), post: m[3], dec, sep };
}
function fmtNum(v, p) {
  let s = v.toFixed(p.dec).replace('.', ',');
  if (p.sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, p.sep);
  return p.pre + s + p.post;
}
function odometer(el, fromText, toText, ms = 650) {
  const a = parseNum(fromText), b = parseNum(toText);
  if (!a || !b || isCalm()) { el.textContent = toText; return; }
  const live = el.closest('[aria-live]');
  if (live) live.setAttribute('aria-busy', 'true');
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    if (k < 1) { el.textContent = fmtNum(a.num + (b.num - a.num) * ease(k), b); requestAnimationFrame(step); }
    else { el.textContent = toText; if (live) live.removeAttribute('aria-busy'); }
  };
  requestAnimationFrame(step);
}

export function initMotion() {
  /* ---------------- одометр: мощность цикла мочевины */
  const capV = $('#flCapV');
  let capPrev = capV ? capV.textContent : '';
  on('flow', () => { if (!capV) return; const to = capV.textContent; if (to !== capPrev) odometer(capV, capPrev, to); capPrev = to; });

  /* ---------------- одометр: крупные числа карточек данных при первом появлении */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const b = en.target, txt = b.textContent, p = parseNum(txt);
      if (!p || isCalm()) return;
      odometer(b, fmtNum(0, p), txt, 900);
    }), { threshold: 0.6 });
    $$('.chapter .stat > b').forEach((b) => io.observe(b));
  }

  /* ---------------- анализатор: термочек и пружинящая стрелка */
  const out = $('#nh3Out');
  if (out) {
    let lastVal = null, lastLeft = null, printT = 0;
    new MutationObserver(() => {
      const marker = $('.scale-marker', out);
      if (marker && lastLeft != null && !isCalm()) {
        const to = marker.style.left;
        marker.style.transition = 'none'; marker.style.left = lastLeft; void marker.offsetWidth;
        marker.style.transition = ''; marker.style.left = to;
      }
      lastLeft = marker ? marker.style.left : null;
      const lab = $('.lab', out), val = lab ? (lab.querySelector('.lab-val') || {}).textContent : null;
      clearTimeout(printT);
      if (!lab || isCalm() || val === lastVal) { lastVal = val; return; }
      // печатаем, когда ввод остановился, — не на каждое нажатие клавиши
      lab.classList.add('pending');
      printT = setTimeout(() => { const l = $('.lab', out); if (l) { l.classList.remove('pending'); l.classList.add('print'); } lastVal = val; }, 420);
    }).observe(out, { childList: true });
  }

  /* ---------------- тест связи чисел: чернила и вибрация */
  const lines = $('#boardLines');
  if (lines) new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType === 1 && n.classList.contains('board-line') && !isCalm()) { n.setAttribute('pathLength', '1'); n.classList.add('ink'); }
  }))).observe(lines, { childList: true });
  on('tsch', (e) => {
    if (!navigator.vibrate || isCalm()) return;
    if (e.detail.phase === 'hit') navigator.vibrate(10);
    else if (e.detail.phase === 'miss') navigator.vibrate([30, 20, 30]);
  });

  /* ---------------- тест называния животных */
  const dial = $('.ant-dial'), prog = $('#antProg'), cnt = $('#antCount'), tap = $('#antTap');
  if (dial && prog) {
    new MutationObserver(() => { dial.style.setProperty('--k', Math.min(1, (+prog.getAttribute('stroke-dashoffset') || 0) / 326.73).toFixed(3)); })
      .observe(prog, { attributes: true, attributeFilter: ['stroke-dashoffset'] });
    tap.addEventListener('click', () => { if (isCalm()) return; cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump'); });
  }

  /* ---------------- клинический пример: тайм-лапс полугода и постоянная плашка */
  const caseBox = $('#case');
  if (caseBox) {
    const tag = document.createElement('p');
    tag.className = 'case-sticky'; tag.setAttribute('aria-hidden', 'true'); tag.textContent = 'Учебный (условный) пример';
    caseBox.prepend(tag);
    const step4 = $('.case-step[data-step="3"]', caseBox), chart = $('#caseChart');
    const tl = document.createElement('div');
    tl.className = 'timelapse'; tl.setAttribute('aria-hidden', 'true');
    tl.innerHTML = '<div class="tl-track">' + [0, 1, 2, 3, 4, 5, 6].map((m) => '<span style="left:' + (m / 6 * 100) + '%"></span>').join('') +
      '<i class="tl-dot"></i></div><div class="tl-labels"><span>исходно</span><span style="left:' + (100 / 6) + '%">4 недели</span><span style="left:100%">6 месяцев</span></div><p class="tl-now">месяц <b>0</b></p>';
    const grid = chart && chart.closest('.grid-2');
    if (step4 && grid) grid.parentNode.insertBefore(tl, grid);
    on('case', (e) => {
      if (e.detail.step !== 3) return;
      const b = $('.tl-now b', tl), dot = $('.tl-dot', tl);
      if (isCalm()) { b.textContent = '6'; dot.style.left = '100%'; return; }
      tl.classList.remove('run'); void tl.offsetWidth; tl.classList.add('run');
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / 2200); b.textContent = String(Math.round(k * 6)); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      // серии графика проявляются по очереди: исходно → 4 недели → 6 месяцев
      requestAnimationFrame(() => $$('#caseChart rect.c-bar').forEach((r) => {
        const si = { '#8B1A1A': 0, '#B8860B': 1, '#1F3A5F': 2 }[r.getAttribute('fill')] || 0;
        r.style.animationDelay = (si * 650 + 120) + 'ms';
      }));
    });
  }

  /* ---------------- «магнитные» кнопки (только мышь) */
  if (fine()) {
    $$('.btn-primary, .pager .next.primary').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        if (isCalm() || e.pointerType !== 'mouse') return;
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = `translate(${(dx * 6).toFixed(1)}px, ${(dy * 4).toFixed(1)}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }
}
