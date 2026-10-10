/* Гипераммониемия на доцирротической стадии — интерактивная версия доклада.
   Статический модуль без зависимостей: навигация по главам, «линия пера» по пройденным главам,
   схемы, графики, тест связи чисел, тест называния животных, клинический пример и самопроверка.
   Прогресс хранится только в localStorage этого браузера. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ utilities */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var COLORS = { bordo: '#8B1A1A', navy: '#1F3A5F', slate: '#8A97A8', gold: '#B8860B', rose: '#D9A3A3', sky: '#9FB3CC' };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmt(v, d) {
    if (v == null || isNaN(v)) return '—';
    if (d == null) d = Number.isInteger(v) ? 0 : (Math.abs(v) < 1 ? 3 : 1);
    return v.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(id, cls) { return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rnd) { rnd = rnd || Math.random; for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  /* ------------------------------------------------------------ state */
  var KEY = 'liver-talk-v1';
  function defaults() { return { t: {}, caseDone: false, quiz: {}, quizDone: false, guess: null, seen: {}, ev: {}, tsch: null }; }
  var state = (function () {
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); var d = defaults(); for (var k in s) d[k] = s[k]; return d; }
    catch (e) { return defaults(); }
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: progress lives only in memory */ } }

  /* ------------------------------------------------------------ toast */
  var toastEl = $('#toast'), toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  /* ------------------------------------------------------------ chapters & routing */
  var ORDER = ['start', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'final'];
  var chapters = ORDER.map(function (id) { return document.getElementById(id); });
  var current = null;

  function chDone(id) {
    switch (id) {
      case 'ch1': return !!state.t[1];
      case 'ch2': return !!state.t[2];
      case 'ch3': return !!state.t[3];
      case 'ch4': return !!state.t[4];
      case 'ch5': return !!state.t[5];
      case 'ch6': return !!state.caseDone;
      case 'final': return !!state.quizDone;
      default: return false;
    }
  }

  function updateTrail() {
    $$('.trail li').forEach(function (li, i, all) {
      var id = li.getAttribute('data-ch');
      li.classList.toggle('is-current', id === current);
      li.classList.toggle('is-done', chDone(id));
      var prev = i > 0 ? all[i - 1].getAttribute('data-ch') : null;
      li.classList.toggle('is-linked', !!prev && chDone(prev) && chDone(id));
      var a = li.querySelector('a');
      if (id === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }

  function chTitle(id) {
    var el = document.getElementById(id);
    return el ? el.getAttribute('data-title') : '';
  }

  function updatePager() {
    var i = ORDER.indexOf(current);
    var prev = $('#pagerPrev'), next = $('#pagerNext');
    if (i <= 0) { prev.setAttribute('aria-hidden', 'true'); prev.tabIndex = -1; }
    else {
      prev.removeAttribute('aria-hidden'); prev.removeAttribute('tabindex');
      prev.href = '#' + ORDER[i - 1];
      $('#pagerPrevT').textContent = ORDER[i - 1] === 'start' ? 'Начало' : chTitle(ORDER[i - 1]);
    }
    if (i >= ORDER.length - 1) {
      next.href = '#start';
      next.querySelector('small').textContent = 'В начало';
      $('#pagerNextT').textContent = 'К обложке доклада';
    } else {
      next.href = '#' + ORDER[i + 1];
      next.querySelector('small').textContent = i === 0 ? 'Начать' : 'Далее';
      $('#pagerNextT').textContent = chTitle(ORDER[i + 1]);
    }
    $('#pagerPos').textContent = i === 0 ? 'Обложка' : 'Глава ' + i + ' из 7';
  }

  function show(id, inner, fromNav) {
    var ch = document.getElementById(id) || chapters[0];
    chapters.forEach(function (c) { var on = c === ch; c.classList.toggle('is-active', on); c.hidden = !on; });
    var changed = current !== ch.id;
    current = ch.id;
    document.body.classList.toggle('at-start', current === 'start');
    state.seen[current] = true; save();
    updateTrail(); updatePager();
    document.title = (current === 'start' ? '' : chTitle(current) + ' — ') + 'Гипераммониемия на доцирротической стадии';
    if (current === 'final') renderFinal();
    if (inner) {
      var go = function () { inner.scrollIntoView({ behavior: fromNav && !reduceMotion ? 'smooth' : 'auto', block: 'start' }); };
      if (!fromNav) { setTimeout(go, 80); setTimeout(go, 400); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(go, 30); }); }
    }
    requestAnimationFrame(function () {
      if (inner) {
        go();
      } else if (changed) {
        window.scrollTo(0, 0);
        if (fromNav) { var h = ch.querySelector('h2[tabindex]'); if (h) h.focus({ preventScroll: true }); }
      }
      redrawCharts(ch);
    });
  }

  function route(fromNav) {
    var hash = decodeURIComponent(location.hash.replace(/^#/, '')) || 'start';
    var target = document.getElementById(hash);
    var ch = target ? target.closest('.chapter') : null;
    if (!ch) { show('start', null, fromNav); return; }
    show(ch.id, target !== ch ? target : null, fromNav);
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', function () { route(true); });

  /* ------------------------------------------------------------ takeaways */
  function renderTakeaways() {
    $$('[data-takeaway]').forEach(function (el) { el.classList.toggle('is-locked', !state.t[el.getAttribute('data-takeaway')]); });
  }
  function unlock(n) {
    if (state.t[n]) return;
    state.t[n] = true; save();
    var el = $('[data-takeaway="' + n + '"]');
    if (el) { el.classList.remove('is-locked'); el.classList.add('just-opened'); setTimeout(function () { el.classList.remove('just-opened'); }, 1300); }
    toast('Ключевой вывод ' + n + ' открыт');
    updateTrail();
  }
  $$('[data-unlock]').forEach(function (b) { b.addEventListener('click', function () { unlock(+b.getAttribute('data-unlock')); }); });

  /* ------------------------------------------------------------ charts */
  var charts = [];
  function registerChart(el, draw) { charts.push({ el: el, draw: draw }); draw(); }
  function redrawCharts(scope) { charts.forEach(function (c) { if (!scope || scope.contains(c.el)) c.draw(); }); }
  var rT = 0;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { redrawCharts(document.querySelector('.chapter.is-active')); }, 150); });

  function niceMax(v) {
    if (v <= 0) return 1;
    var raw = v * 1.15, p = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= raw) return steps[i] * p;
    return 10 * p;
  }
  /* split a category label into lines that fit maxW px (approximate glyph width for Plex Sans) */
  function wrapLabel(text, maxW, size) {
    var cw = size * 0.56, out = [];
    String(text).split('\n').forEach(function (part) {
      if (part.length * cw <= maxW) { out.push(part); return; }
      var words = part.replace(/, /g, ',\u0001').split(/[ \u0001]/), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (t.length * cw > maxW && line) { out.push(line); line = w; } else line = t;
      });
      if (line) out.push(line);
    });
    return out;
  }
  function legend(series) {
    return '<ul class="legend">' + series.map(function (s) { return '<li><i style="background:' + COLORS[s.c] + '"></i>' + esc(s.name) + '</li>'; }).join('') + '</ul>';
  }

  /* grouped vertical bars, drawn at real pixel width so text stays readable on phones */
  function vbar(el, cfg) {
    registerChart(el, function () {
      if (!el.offsetParent && el.clientWidth === 0) return;
      var W = Math.max(260, Math.round(el.clientWidth || 560));
      var narrow = W < 460;
      var H = cfg.height || (narrow ? 230 : 268);
      var cats = cfg.cats, series = cfg.series;
      var gw0 = (W - 44) / cats.length;
      var wrapped = cats.map(function (c) { return wrapLabel(c, gw0 - 6, 12); });
      var lines = Math.max.apply(null, wrapped.map(function (w) { return w.length; }));
      var padL = 38, padR = 6, padT = 22, padB = 18 + lines * 14;
      var iw = W - padL - padR, ih = H - padT - padB;
      var all = []; series.forEach(function (s) { s.v.forEach(function (v) { if (v != null) all.push(v); }); });
      var max = cfg.max || niceMax(Math.max.apply(null, all));
      var d = cfg.decimals;
      var aria = cats.map(function (c, ci) { return c.replace('\n', ' ') + ': ' + series.map(function (s) { return s.name + ' ' + fmt(s.v[ci], d); }).join(', '); }).join('; ');
      var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc((cfg.title ? cfg.title + '. ' : '') + aria) + '">';
      var ticks = 4;
      for (var i = 0; i <= ticks; i++) {
        var y = padT + ih - ih * i / ticks, tv = max * i / ticks;
        s += '<line class="c-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>';
        s += '<text class="c-tick" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(tv, max < 1 ? 2 : (max < 10 && tv % 1 ? 1 : 0)) + '</text>';
      }
      var gw = iw / cats.length, n = series.length;
      var bw = Math.min(narrow ? 30 : 46, gw * 0.8 / n), gap = Math.min(5, bw * 0.15);
      var groupW = n * bw + (n - 1) * gap;
      var vFont = (narrow && n >= 3) || bw < 24 ? 10 : 12;
      cats.forEach(function (c, ci) {
        var gx = padL + gw * ci + (gw - groupW) / 2;
        series.forEach(function (sr, si) {
          var v = sr.v[ci]; if (v == null) return;
          var h = Math.max(1, ih * v / max), x = gx + si * (bw + gap), y = padT + ih - h;
          s += '<rect class="c-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + COLORS[sr.c] + '" style="animation-delay:' + (si * 90 + ci * 40) + 'ms"/>';
          s += '<text class="c-val" style="font-size:' + vFont + 'px" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '">' + fmt(v, d) + '</text>';
        });
        wrapped[ci].forEach(function (ln, li) {
          s += '<text class="c-cat" x="' + (padL + gw * ci + gw / 2).toFixed(1) + '" y="' + (padT + ih + 17 + li * 14) + '">' + esc(ln) + '</text>';
        });
      });
      s += '<line class="c-axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '"/>';
      s += '</svg>';
      el.innerHTML = (cfg.title ? '<p class="chart-title">' + esc(cfg.title) + '</p>' : '') + s + (series.length > 1 || cfg.legend ? legend(series) : '');
    });
  }

  /* horizontal bars with an optional dashed guide (the reader's guess) */
  function hbar(el, cfg) {
    registerChart(el, function () {
      if (!el.offsetParent && el.clientWidth === 0) return;
      var W = Math.max(260, Math.round(el.clientWidth || 560));
      var narrow = W < 520;
      var labelW = narrow ? Math.min(140, Math.round(W * 0.42)) : 220;
      var rowH = 46, padT = cfg.guide != null ? 30 : 8, padB = 26;
      var x0 = labelW + 10, x1 = W - 52;
      var H = padT + cfg.rows.length * rowH + padB;
      var max = cfg.max || 100;
      var X = function (v) { return x0 + (x1 - x0) * v / max; };
      var aria = cfg.rows.map(function (r) { return r.label + ' (' + r.sub + '): ' + fmt(r.v) + (cfg.unit || ''); }).join('; ');
      var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc((cfg.title ? cfg.title + '. ' : '') + aria) + '">';
      [0, 25, 50, 75, 100].forEach(function (t) {
        s += '<line class="c-grid" x1="' + X(t) + '" x2="' + X(t) + '" y1="' + padT + '" y2="' + (H - padB) + '"/>';
        s += '<text class="c-tick" x="' + X(t) + '" y="' + (H - 8) + '" text-anchor="middle">' + t + (cfg.unit || '') + '</text>';
      });
      cfg.rows.forEach(function (r, i) {
        var cy = padT + i * rowH + rowH / 2;
        s += '<text class="fl-t" x="0" y="' + (cy - 3) + '" style="font-size:' + (narrow ? 12 : 13) + 'px">' + esc(r.label) + '</text>';
        s += '<text class="fl-s" x="0" y="' + (cy + 13) + '" style="font-size:' + (narrow ? 10 : 11) + 'px">' + esc(r.sub) + '</text>';
        s += '<rect x="' + x0 + '" y="' + (cy - 9) + '" width="' + (x1 - x0) + '" height="18" rx="3" fill="#F4F6F9"/>';
        s += '<rect class="c-bar" style="transform-origin:left;animation-name:growX;animation-delay:' + (i * 80) + 'ms" x="' + x0 + '" y="' + (cy - 9) + '" width="' + Math.max(1, X(r.v) - x0).toFixed(1) + '" height="18" rx="3" fill="' + COLORS[r.c || 'bordo'] + '"/>';
        s += '<text class="c-val" style="text-anchor:start" x="' + (X(r.v) + 6).toFixed(1) + '" y="' + (cy + 4) + '">' + fmt(r.v) + (cfg.unit || '') + '</text>';
      });
      if (cfg.guide != null) {
        var gx = X(cfg.guide);
        s += '<line class="c-guide" x1="' + gx + '" x2="' + gx + '" y1="' + (padT - 6) + '" y2="' + (H - padB) + '"/>';
        var anchor = gx > W - 90 ? 'end' : (gx < x0 + 60 ? 'start' : 'middle');
        s += '<text class="c-guide-t" x="' + gx + '" y="' + (padT - 12) + '" text-anchor="' + anchor + '">ваша оценка: ' + cfg.guide + (cfg.unit || '') + '</text>';
      }
      s += '</svg>';
      el.innerHTML = (cfg.title ? '<p class="chart-title">' + esc(cfg.title) + '</p>' : '') + s;
    });
  }
  // keyframes for horizontal growth (kept here to stay next to its only user)
  (function () { var st = document.createElement('style'); st.textContent = '@keyframes growX{from{transform:scaleX(0)}}'; document.head.appendChild(st); })();

  /* ------------------------------------------------------------ hero sheet (signature) */
  (function heroSheet() {
    var host = $('#heroSheet'); if (!host) return;
    var rnd = mulberry32(25);
    var cells = shuffle(Array.from({ length: 25 }, function (_, i) { return i; }), rnd);
    var pad = 22, top = 44, size = 300, cw = (size - 2 * pad) / 5, ch = (size - top - 16) / 5;
    var pts = [];
    for (var n = 0; n < 25; n++) {
      var c = cells[n], r = Math.floor(c / 5), k = c % 5;
      pts.push({ x: pad + k * cw + cw / 2 + (rnd() - .5) * cw * .42, y: top + r * ch + ch / 2 + (rnd() - .5) * ch * .4 });
    }
    var d = 'M' + pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L');
    var s = '<svg viewBox="0 0 300 300" aria-hidden="true"><path class="hs-path" pathLength="1" d="' + d + '"/>';
    pts.forEach(function (p, i) { s += '<circle class="hs-circle" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="12"/><text class="hs-num" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '">' + (i + 1) + '</text>'; });
    s += '</svg>';
    host.insertAdjacentHTML('beforeend', s);
  })();

  /* ------------------------------------------------------------ chapter 1: flow scenarios */
  var FLOW = {
    norm: { cap: 100, capV: '100 %', capNote: 'референс', nh3: '12–40', flag: 'n', where: 'артериальная кровь здоровых', blood: '#E8EEF5', shunt: false,
      text: 'Кишечник даёт основной поток аммиака: в воротной вене его концентрация примерно в 3 раза выше системной. Печень извлекает около 73 % портального аммиака — половину превращает в мочевину в перипортальных гепатоцитах, половину связывает в глутамин в перивенозных. Мышцы работают буфером.',
      src: 'Levitt D.G., Levitt M.D., 2018; Thomsen K.L. и соавт., 2023' },
    steatosis: { cap: 17, capV: '≈ 17 %', capNote: 'активность ОТК в биоптатах: 0,045 против 0,268 мкмоль/мин/мкг у контроля', nh3: '87 ± 24', flag: 'h', where: 'плазма, пациенты с ожирением и стеатозом', blood: '#EBCFCF', shunt: false,
      text: 'Свободные жирные кислоты вызывают гиперметилирование промоторов генов орнитинтранскарбамилазы (ОТК) и карбамоилфосфатсинтетазы-1. Активность ОТК падает примерно в 6 раз, функциональный клиренс азота — на 30 % уже при простом стеатозе.',
      src: 'De Chiara F. и соавт., 2018; Eriksen P.L. и соавт., 2019' },
    nash: { cap: 22, capV: '≈ 22 %', capNote: 'активность ОТК: 0,059 против 0,268 мкмоль/мин/мкг', nh3: '112 ± 35', flag: 'h', where: 'плазма, пациенты с НАСГ; p = 0,01 против стеатоза', blood: '#D9A3A3', shunt: false,
      text: 'При стеатогепатите экспрессия ОТК снижается ещё вдвое, а аммиак в ткани печени (окраска по Несслеру) примерно в 10 раз выше, чем у контроля: в 5 раз при стеатозе и ещё вдвое при НАСГ.',
      src: 'De Chiara F. и соавт., 2018' },
    alcohol: { cap: 19, capV: '≈ 19 %', capNote: 'функциональный клиренс азота: 7,2 против 37,4 л/ч у здоровых', nh3: '—', flag: 'na', where: 'в работе измеряли синтез мочевины, а не аммиак', blood: '#E2B9B9', shunt: false,
      text: 'При алкогольном гепатите мощность синтеза мочевины падает в 5 раз и тем сильнее, чем выше MELD. У здоровых добровольцев этанол подавляет синтез мочевины уже после однократного приёма.',
      src: 'Glavind E. и соавт., 2016; Aagaard N.K. и соавт., 2004' },
    shunt: { cap: 100, capV: '100 %', capNote: 'цикл мочевины сохранён, но 65 % портальной крови минует печень', nh3: '≈ 107', flag: 'h', where: 'модель: шунт 65 % при норме ≈ 30 мкмоль/л', blood: '#C98787', shunt: true,
      text: 'Портосистемное шунтирование позволяет аммиаку из кишечника миновать печень даже при сохранённой её функции. Без цирроза так бывает при ранней портальной гипертензии, тромбозе воротной вены и врождённых шунтах — мальформации Абернети.',
      src: 'Levitt D.G., Levitt M.D., 2018 (модельный расчёт)' }
  };
  (function flow() {
    var seg = $('#flowSeg'); if (!seg) return;
    function set(key) {
      var f = FLOW[key];
      $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-s') === key)); });
      $$('[data-fl="cap"]').forEach(function (cap) { cap.setAttribute('width', (+cap.getAttribute('data-w') * f.cap / 100).toFixed(1)); cap.classList.toggle('low', f.cap < 50); });
      $('#flCapV').textContent = f.capV; $('#flCapNote').textContent = f.capNote;
      var bar = $('#flCapBar'); bar.style.width = f.cap + '%'; bar.classList.toggle('low', f.cap < 50);
      $('#flNh3').textContent = f.nh3;
      var flag = $('#flFlag'); flag.className = 'flag flag-' + f.flag; flag.textContent = f.flag === 'h' ? '↑' : (f.flag === 'n' ? 'N' : '—');
      $('#flWhere').textContent = f.where;
      $$('[data-fl="blood"]').forEach(function (x) { x.setAttribute('fill', f.blood); });
      $$('[data-fl="shunt"]').forEach(function (x) { x.classList.toggle('on', f.shunt); });
      $$('[data-fl="shuntT"]').forEach(function (x) { x.style.opacity = f.shunt ? 1 : 0; });
      $$('[data-fl="portal"]').forEach(function (x) { x.setAttribute('stroke-width', f.shunt ? 3 : 7); });
      $('#flText').textContent = f.text; $('#flSrc').textContent = f.src;
    }
    seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-s]'); if (b) set(b.getAttribute('data-s')); });
  })();

  /* ------------------------------------------------------------ chapter 1: predict, then reveal */
  var COHORTS = [
    { label: 'НАЖБП', sub: 'Кизова, 2019 · n = 103', v: 88.3 },
    { label: 'ХЗП, фиброз F0–F3', sub: 'Ильченко, 2018 · n = 78', v: 78.1 },
    { label: 'Стеатоз + ИБС', sub: 'Зыкина, 2023 · n = 43', v: 69.8 },
    { label: 'МАЖБП', sub: 'Гаранина, 2021 · n = 45', v: 58 },
    { label: 'Ожирение ± СД 2', sub: 'Шавкута, 2019 · n = 154', v: 53.9, c: 'gold' },
    { label: 'Контроль без МАЖБП', sub: 'Гаранина, 2021 · n = 45', v: 7, c: 'slate' }
  ];
  (function predict() {
    var r = $('#guess'), out = $('#guessOut'), btn = $('#guessBtn'); if (!r) return;
    var drawn = false;
    function upd() { out.textContent = r.value + ' %'; }
    r.addEventListener('input', function () { upd(); if (drawn) reveal(true); });
    function reveal(silent) {
      var g = +r.value;
      $('#predictResult').hidden = false;
      var el = $('#cohortChart');
      if (!drawn) { drawn = true; hbar(el, { title: 'Доля пациентов с гипераммониемией, %', rows: COHORTS, max: 100, unit: ' %', get guide() { return +r.value; } }); }
      else redrawCharts(el.parentNode);
      var msg;
      if (g < 50) msg = '<h4>Реальность выше вашей оценки</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
      else if (g <= 90) msg = '<h4>Близко к реальности</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
      else msg = '<h4>Чуть выше реальности</h4><p>Вы предположили ' + g + ' %. В российских когортах пациентов с НАЖБП и хроническими гепатитами без цирроза аммиак повышен у 58–88 %, а в контроле без болезни печени — у 7 %.</p>';
      msg += '<p>Это амбулаторные пациенты без явной энцефалопатии: гипераммониемию у них находят, только если её ищут.</p>';
      var fb = $('#predictFb'); fb.innerHTML = msg; fb.className = 'result ' + (g < 50 ? 'is-strong' : 'is-ok');
      state.guess = g; save();
      if (!silent) unlock(1);
    }
    btn.addEventListener('click', function () { reveal(false); });
    if (state.guess != null) { r.value = state.guess; upd(); reveal(true); } else upd();
  })();

  /* ------------------------------------------------------------ chapter 2: vicious cycle */
  var CYCLE = [
    { t: 'Стеатоз, стеатогепатит', d: 'Свободные жирные кислоты индуцируют гиперметилирование промоторов генов ОТК и карбамоилфосфатсинтетазы-1 — ферменты цикла мочевины «выключаются» эпигенетически. У крыс изменения обратимы при возврате к обычному питанию.', s: 'De Chiara F. и соавт., 2018', b: 'Снижение массы тела на 7–10 %, отказ от алкоголя: убирают причину подавления цикла мочевины.' },
    { t: '↓ Ферментов цикла мочевины', d: 'Экспрессия карбамоилфосфатсинтетазы-1 снижена в 3,5 раза, функциональный печёночный клиренс азота — на 30 % уже при простом стеатозе (23,3 против 33,1 л/ч). Носители аллеля A полиморфизма CPS1 rs1047891 реже имеют фиброз (ОШ 0,62).', s: 'Eriksen P.L. и соавт., 2019; Gallego-Durán R. и соавт., 2022', b: 'L-орнитин — субстрат и активатор цикла мочевины.' },
    { t: 'Гипераммониемия', d: 'Аммиак накапливается в ткани печени: в 5 раз больше нормы при стеатозе и ещё вдвое больше при НАСГ. В модели НАЖБП у крыс плазменный аммиак достигал 188 против 66 мкмоль/л у контроля уже к 10-й неделе.', s: 'De Chiara F. и соавт., 2018, 2020', b: 'L-аспартат — синтез глутамина в печени и мышцах; рифаксимин и лактулоза уменьшают поступление аммиака из кишечника.' },
    { t: 'Активация звёздчатых клеток', d: 'Аммиак в концентрациях 50–300 мкмоль/л за 24–72 часа обратимо активирует звёздчатые клетки печени человека: пролиферация, маркёры активации, перестройка цитоскелета, оксидативный стресс.', s: 'Jalan R. и соавт., 2016' },
    { t: 'Фиброз, ↑ портального давления', d: 'Связывание аммиака у крыс с фиброзом снижало портальное давление с 14 до 11 мм рт. ст.; в модели НАЖБП «ловушка» аммиака восстанавливала активность ОТК и предотвращала прогрессирование фиброза. У пациентов с МАЖБП без цирроза после 8 недель L-орнитин-L-аспартата жёсткость печени снизилась у 85 %.', s: 'Jalan R. и соавт., 2016; De Chiara F. и соавт., 2020; Гаранина Е.В., 2021', b: 'Курс L-орнитин-L-аспартата: снижение жёсткости печени у 85 % пациентов с МАЖБП (открытое исследование).' },
    { t: '↑ Липогенеза, оксидативный стресс', d: 'Аммиак активирует липогенез de novo в гепатоцитах и вместе с этанолом усиливает накопление жира — круг замыкается на стеатозе.', s: 'Song Q. и соавт., 2024' }
  ];
  (function cycle() {
    var list = $('#cycleList'), detail = $('#cycleDetail'), brk = $('#breakBtn'); if (!list) return;
    var ring = $('#cycleRing'), cx = 235, r = 176, sel = -1, seen = {};
    var s = '<circle class="ring-line" cx="' + cx + '" cy="' + cx + '" r="' + r + '"/>';
    [-60, 0, 60, 120, 180, 240].forEach(function (a) {
      var rad = a * Math.PI / 180, x = cx + r * Math.cos(rad), y = cx + r * Math.sin(rad);
      s += '<path class="ring-arrow" d="M-7,-6 L7,0 L-7,6 z" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a + 90) + ')"/>';
    });
    s += '<text class="ring-center" x="' + cx + '" y="' + (cx - 4) + '">Порочный круг</text><text class="ring-center-s" x="' + cx + '" y="' + (cx + 16) + '">НАЖМИТЕ НА ЗВЕНО</text>';
    ring.innerHTML = s;

    function render() {
      var showBrk = brk.getAttribute('aria-pressed') === 'true';
      if (sel < 0) {
        if (showBrk) {
          detail.innerHTML = '<h4>Где можно разорвать круг</h4><ul>' + CYCLE.filter(function (c) { return c.b; }).map(function (c) { return '<li><b>' + esc(c.t) + ':</b> ' + esc(c.b) + '</li>'; }).join('') + '</ul>';
        } else {
          detail.innerHTML = '<h4>Выберите звено круга</h4><p class="empty">Каждое звено подкреплено исследованием. Откройте хотя бы три, чтобы увидеть, как они связаны.</p>';
        }
        return;
      }
      var c = CYCLE[sel];
      detail.innerHTML = '<p class="label">Звено ' + (sel + 1) + ' из 6</p><h4>' + esc(c.t) + '</h4><p>' + esc(c.d) + '</p><p class="src">' + esc(c.s) + '</p>' +
        (showBrk && c.b ? '<div class="brk"><b>Точка воздействия</b>' + esc(c.b) + '</div>' : '') +
        '<p style="margin:12px 0 0;font-size:.9rem;color:var(--ink-3)">Далее по кругу: ' + esc(CYCLE[(sel + 1) % 6].t) + '</p>';
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-n]'); if (!b) return;
      sel = +b.getAttribute('data-n'); seen[sel] = true;
      $$('button[data-n]', list).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      b.closest('.cycle-node').classList.add('is-seen');
      render();
      if (Object.keys(seen).length >= 3) unlock(2);
    });
    brk.addEventListener('click', function () {
      var on = brk.getAttribute('aria-pressed') !== 'true';
      brk.setAttribute('aria-pressed', String(on));
      brk.textContent = on ? 'Скрыть точки воздействия' : 'Показать, где можно разорвать круг';
      list.classList.toggle('show-break', on);
      render();
    });
  })();

  /* ------------------------------------------------------------ chapter 3: who to test */
  (function who() {
    var bg = $('#bgChecks'), sym = $('#symChecks'), out = $('#whoResult'); if (!bg) return;
    function names(fs) { return $$('input:checked', fs).map(function (i) { return i.closest('label').querySelector('span').firstChild.textContent.trim(); }); }
    function render() {
      var b = names(bg), s = names(sym);
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
  })();

  /* ------------------------------------------------------------ chapter 4: ammonia interpreter */
  (function ammonia() {
    var val = $('#nh3Val'), uln = $('#nh3Uln'), out = $('#nh3Out'); if (!val) return;
    var unit = 'umol', sample = 'cap';
    function segSet(id, attr, cb) {
      var seg = $(id);
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        $$('button', seg).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        cb(b.getAttribute(attr)); render();
      });
    }
    segSet('#nh3Unit', 'data-v', function (v) { unit = v; });
    segSet('#nh3Sample', 'data-v', function (v) { sample = v; $('#ulnField').hidden = v !== 'ven'; });
    function num(s) { s = String(s || '').replace(',', '.').replace(/\s/g, ''); return s === '' ? null : (isFinite(+s) ? +s : NaN); }
    function pos(v) { if (v <= 60) return v / 60 * 24; if (v <= 100) return 24 + (v - 60) / 40 * 16; if (v <= 200) return 40 + (v - 100) / 100 * 40; return Math.min(99, 80 + (v - 200) / 50 * 20); }
    function render() {
      var raw = num(val.value);
      if (raw === null) { out.innerHTML = '<div class="result"><h4>Введите результат анализа</h4><p class="empty">Расшифровка появится здесь: степень гипераммониемии по Российскому консенсусу или отношение к норме вашей лаборатории.</p></div>'; return; }
      if (isNaN(raw) || raw < 0 || raw > 2000) { out.innerHTML = '<div class="result is-warn"><h4>Не получается прочитать число</h4><p>Введите результат цифрами, например 86 или 52,5.</p></div>'; return; }
      var v = unit === 'ugdl' ? raw * 0.587 : raw;
      var conv = unit === 'ugdl' ? '<p class="lab-note">' + fmt(raw) + ' мкг/дл × 0,587 = ' + fmt(v, 1) + ' мкмоль/л</p>' : '';
      var PROBLEM = { fast: 'забор не натощак, после нагрузки или стресса', smoke: 'курение перед забором', fist: 'жгут или «работа кулаком»', ice: 'образец не охлаждён или плазма отделена позже 15 минут' };
      var unmet = $$('#preChecks input').filter(function (i) { return !i.checked && (i.value !== 'ice' || sample === 'ven'); })
        .map(function (i) { return PROBLEM[i.value]; });
      var html = '', head, text, flag, ref;
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
        var u = num(uln.value);
        if (!u || isNaN(u) || u <= 0) { out.innerHTML = '<div class="result is-warn"><h4>Укажите норму лаборатории</h4><p>Для венозной плазмы степень оценивают относительно верхней границы нормы конкретной лаборатории — обычно 11–50 мкмоль/л.</p></div>'; return; }
        var ratio = v / u; flag = ratio > 1 ? 'h' : 'n';
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
  })();

  /* ------------------------------------------------------------ chapter 4: number connection test */
  (function tsch() {
    var board = $('#board'), svg = $('#boardLines'), cover = $('#boardCover'); if (!board) return;
    var pos = {}, next = 1, errors = 0, t0 = 0, raf = 0, running = false, last = null;
    var timeEl = $('#tschTime'), nextEl = $('#tschNext'), errEl = $('#tschErr'), res = $('#tschResult');
    function clock(ms) { return fmt(ms / 1000, 1) + ' с'; }
    function layout() {
      $$('.tc', board).forEach(function (b) { b.remove(); }); svg.innerHTML = '';
      var cells = shuffle(Array.from({ length: 25 }, function (_, i) { return i; }));
      var pad = 7, cell = (100 - 2 * pad) / 5, byCell = [];
      for (var n = 1; n <= 25; n++) {
        var c = cells[n - 1], r = Math.floor(c / 5), k = c % 5;
        var x = pad + k * cell + cell / 2 + (Math.random() - .5) * cell * .24;
        var y = pad + r * cell + cell / 2 + (Math.random() - .5) * cell * .24;
        pos[n] = { x: x, y: y }; byCell[c] = n;
      }
      byCell.forEach(function (n) {
        var b = document.createElement('button');
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
      $$('#tschBands tr').forEach(function (tr) { tr.classList.remove('hit'); });
      cover.hidden = true; running = true; t0 = performance.now(); tick();
      var first = $('.tc', board); if (first) first.focus({ preventScroll: true });
    }
    function finish() {
      running = false; cancelAnimationFrame(raf);
      var ms = performance.now() - t0, sec = ms / 1000;
      timeEl.textContent = clock(ms);
      var rows = $$('#tschBands tbody tr'), hit = null;
      rows.some(function (tr) { if (sec <= +tr.getAttribute('data-max')) { hit = tr; return true; } return false; });
      if (hit) hit.classList.add('hit');
      var best = state.tsch && state.tsch.best ? Math.min(state.tsch.best, sec) : sec;
      state.tsch = { last: sec, best: best, errors: errors }; save();
      var ok = sec <= 40;
      res.innerHTML = '<div class="result ' + (ok ? 'is-ok' : 'is-strong') + '"><h4>' + fmt(sec, 1) + ' с, ошибок: ' + errors + '</h4><p>' +
        (ok ? 'Быстрее 40 секунд — на бумажном бланке это соответствовало бы норме.' : 'На бумажном бланке такое время соответствовало бы строке, выделенной в таблице. На экране результат зависит от устройства — это демонстрация, а не диагноз.') +
        '</p><p style="margin:0">Лучшее время в этом браузере: ' + fmt(best, 1) + ' с.</p></div>' +
        '<button class="btn btn-ghost" type="button" id="tschAgain" style="margin-top:12px">' + icon('restart') + 'Ещё раз, новый бланк</button>';
      $('#tschAgain').addEventListener('click', start);
      unlock(4);
    }
    board.addEventListener('click', function (e) {
      var b = e.target.closest('.tc'); if (!b || !running) return;
      var n = +b.getAttribute('data-n');
      if (n === next) {
        b.classList.add('done');
        if (last) {
          var p = pos[last], q = pos[n];
          svg.insertAdjacentHTML('beforeend', '<line class="board-line" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '"/>');
          var prevBtn = $('.tc[data-n="' + last + '"]', board); if (prevBtn) prevBtn.classList.remove('last');
        }
        b.classList.add('last'); last = n; next++;
        nextEl.textContent = next > 25 ? '—' : String(next);
        if (next > 25) finish();
      } else if (!b.classList.contains('done')) {
        errors++; errEl.textContent = String(errors);
        b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss');
      }
    });
    $('#tschStart').addEventListener('click', start);
  })();

  /* ------------------------------------------------------------ chapter 4: animal naming test */
  (function ant() {
    var startB = $('#antStart'), tap = $('#antTap'); if (!startB) return;
    var count = 0, t0 = 0, raf = 0, running = false, C = 326.73, DUR = 60000;
    var prog = $('#antProg'), cnt = $('#antCount'), left = $('#antLeft'), res = $('#antResult');
    function frame() {
      if (!running) return;
      var el = performance.now() - t0, rem = Math.max(0, DUR - el);
      prog.setAttribute('stroke-dashoffset', (C * el / DUR).toFixed(2));
      left.textContent = Math.ceil(rem / 1000) + ' с';
      if (rem <= 0) return end();
      raf = requestAnimationFrame(frame);
    }
    function end() {
      running = false; cancelAnimationFrame(raf); tap.disabled = true;
      startB.innerHTML = icon('restart') + 'Ещё раз'; left.textContent = 'время вышло';
      var cls, head, txt;
      if (count >= 15) { cls = 'is-ok'; head = count + ' — в пределах нормы'; txt = '15 и больше животных за минуту не характерно для скрытой энцефалопатии.'; }
      else if (count >= 10) { cls = 'is-strong'; head = count + ' — характерно для скрытой энцефалопатии'; txt = 'У пациентов с циррозом 10–14 животных за минуту соответствовали минимальной энцефалопатии или I стадии.'; }
      else { cls = 'is-strong'; head = count + ' — характерно для явной энцефалопатии'; txt = 'Меньше 10 животных у пациентов с циррозом соответствовало энцефалопатии II стадии и выше. Учтите возраст, образование и усталость.'; }
      res.innerHTML = '<div class="result ' + cls + '"><h4>' + head + '</h4><p>' + txt + ' Экранная версия — демонстрация методики.</p></div>';
      unlock(4);
    }
    startB.addEventListener('click', function () {
      count = 0; cnt.textContent = '0'; res.innerHTML = ''; prog.setAttribute('stroke-dashoffset', '0');
      running = true; tap.disabled = false; t0 = performance.now(); startB.innerHTML = icon('restart') + 'Заново'; tap.focus(); frame();
    });
    tap.addEventListener('click', function () { if (!running) return; count++; cnt.textContent = String(count); });
  })();

  /* ------------------------------------------------------------ chapter 5: evidence explorer */
  var STUDIES = [
    { id: 'ageeva', tags: ['pre', 'nafld', 'hcv'], name: 'Хронические заболевания печени до цирроза', who: 'Агеева Е.А., Алексеенко С.А., 2015/2017',
      pop: '37 пациентов (42,5 ± 6,8 года), фиброз F1–F2: 21 с жировой болезнью печени, 16 с хроническим гепатитом С; 17 здоровых для сравнения',
      design: 'Открытое исследование; L-орнитин-L-аспартат 3 г 3 раза в сутки внутрь, 4 недели; аммиак венозной крови, тест связи чисел',
      result: 'Аммиак снизился на 38 %, время теста связи чисел — на 34 %, почти до уровня здоровых (p < 0,001). Через 6 месяцев гипераммониемия вернулась у 32,4 %; повторный курс снова её нормализовал.',
      charts: [{ cats: ['Аммиак, мкмоль/л', 'Тест связи чисел, с'], series: [{ name: 'Здоровые (n = 17)', c: 'slate', v: [24.0, 35.1] }, { name: 'До лечения', c: 'bordo', v: [56.0, 59.1] }, { name: 'После 4 недель', c: 'navy', v: [34.7, 39.2] }] }],
      src: 'Клин. перспективы гастроэнтерологии, гепатологии. 2015;(6):24–26; Эффективная фармакотерапия. 2017;(16):6–9' },
    { id: 'garanina', tags: ['pre', 'nafld'], name: 'МАЖБП: аммиак, жёсткость и стеатоз печени', who: 'Гаранина Е.В., 2021',
      pop: '45 пациентов с МАЖБП (стеатоз S2–S3, фиброз F1) и 45 здоровых; гипераммониемия у 26 (58 %) против 3 (7 %)',
      design: 'Открытое исследование; L-орнитин-L-аспартат 9 г в сутки 8 недель + изменение образа жизни; эластометрия FibroScan с CAP',
      result: 'Гипераммониемия исчезла у всех 26 пациентов. Жёсткость печени снизилась у 85 % (у 6 — до значений F0), степень стеатоза — у 69 %; С-реактивный белок 4,1 → 2,6 мг/л.',
      charts: [{ cats: ['Аммиак, мкмоль/л', 'АСТ, Ед/л'], series: [{ name: 'До лечения', c: 'bordo', v: [93, 45] }, { name: 'После 8 недель', c: 'navy', v: [53, 30] }] }],
      src: 'РЖГГК. 2021;31(4):31–36' },
    { id: 'kizova', tags: ['pre', 'nafld'], name: 'НАЖБП: аммиак и тест связи чисел', who: 'Кизова Е.А., Потехина Ю.П., 2019',
      pop: '103 пациента с НАЖБП 18–60 лет, фиброз F0–F2; повторно обследованы 53',
      design: 'L-орнитин-L-аспартат 3 г 3 раза в сутки 4 недели; аммиак экспресс-методом (норма до 54 мкмоль/л)',
      result: 'Исходно гипераммониемия у 88,3 %, нормальные и аммиак, и тест связи чисел — лишь у 5,8 %. После курса оба показателя значимо снизились (p < 0,001).',
      stats: [{ v: '88,3 %', l: 'пациентов с гипераммониемией исходно' }, { v: '98 мкмоль/л', l: 'медиана аммиака (68–120)' }, { v: '45 с', l: 'медиана теста связи чисел (36–60)' }],
      src: 'Экспериментальная и клиническая гастроэнтерология. 2019;169(9):80–84' },
    { id: 'burkov', tags: ['pre', 'nafld'], name: 'НАЖБП: печёночные пробы', who: 'Бурков С.Г. и соавт., 2010',
      pop: '48 пациентов с НАЖБП (49,5 ± 6,8 года)', design: 'Открытое проспективное исследование; L-орнитин-L-аспартат 3 г 3 раза в сутки, 4 недели',
      result: 'АЛТ, АСТ и ГГТП снизились почти вдвое (p < 0,01). Незначительная тошнота — у 3 пациентов, курс завершили все.',
      charts: [{ cats: ['АЛТ, Ед/л', 'АСТ, Ед/л', 'ГГТП, Ед/л'], series: [{ name: 'До лечения', c: 'bordo', v: [70.1, 60.7, 78.8] }, { name: 'Через 4 недели', c: 'navy', v: [36.2, 32.7, 41.1] }] }],
      src: 'Consilium Medicum. 2010;12(8):43–47' },
    { id: 'petrova', tags: ['pre', 'nafld'], name: 'НАЖБП и гепатогенная слабость', who: 'Петрова Э.М. и соавт., 2020',
      pop: '41 пациент с НАЖБП (46 ± 10 лет) с жалобами на слабость', design: 'L-орнитин-L-аспартат 15 г в сутки внутрь 4 недели в составе комплексной терапии; аммиак экспресс-методом; слабость по 10-балльной шкале',
      result: 'Аммиак снизился на 30 % (p = 0,0001), слабость — с 5,6 до 4,1 балла. Слабость коррелировала с аммиаком (r = 0,36), ГГТП — тоже (r = 0,42).',
      charts: [{ title: 'Аммиак, мкмоль/л', cats: ['До', 'После'], series: [{ name: 'Аммиак', c: 'bordo', v: [141.5, 98.5] }] }, { title: 'Слабость, баллы', cats: ['До', 'После'], decimals: 2, series: [{ name: 'Слабость', c: 'navy', v: [5.64, 4.14] }] }],
      src: 'Лечащий врач. 2020;(8):48–53' },
    { id: 'tian', tags: ['pre', 'nafld'], name: 'НАСГ: сравнение двух доз', who: 'Tian L.Y. и соавт., 2013',
      pop: '72 пациента с НАСГ', design: 'Рандомизированное, 12 недель: 6 г 2 раза в сутки (n = 38) против 3 г 2 раза в сутки (n = 34)',
      result: 'Эффект дозозависимый: улучшение АЛТ у 79 % против 53 % (p < 0,05), общая эффективность 52,6 % против 38,2 %; нежелательные явления 4,8 % и 4,4 %.',
      charts: [{ cats: ['Улучшение АЛТ, %', 'Общая эффективность, %'], max: 100, series: [{ name: '6 г × 2 в сутки', c: 'navy', v: [79, 52.6] }, { name: '3 г × 2 в сутки', c: 'sky', v: [53, 38.2] }] }],
      src: 'Zhonghua Gan Zang Bing Za Zhi. 2013;21(7):528–532' },
    { id: 'lira', tags: ['pre', 'nafld'], name: 'ЛИРА-COVID: постковидная астения и НАЖБП', who: 'Лазебник Л.Б. и соавт., 2022–2023',
      pop: '83 пациента (51,7 ± 12,8 года) с постковидным синдромом, гипераммониемией, повышением АЛТ/АСТ и астенией; 23 — с НАЖБП',
      design: 'Многоцентровое проспективное наблюдательное исследование; L-орнитин-L-аспартат 3 г 3 раза в сутки 4 недели',
      result: 'Аммиак снизился у 97,6 %; доля пациентов без признаков энцефалопатии выросла с 6 до 41 %; нежелательных явлений не было. При НАЖБП аммиак исходно выше и снижается медленнее — эффект к 4-й неделе.',
      charts: [{ title: 'Вся когорта, n = 83', cats: ['ТСЧ, с', 'АЛТ, Ед/л', 'АСТ, Ед/л', 'Астения,\nбаллы'], series: [{ name: 'До лечения', c: 'bordo', v: [64.67, 95.75, 78.51, 64.71] }, { name: 'Через 28 дней', c: 'navy', v: [49.43, 47.83, 40.10, 46.27] }] },
        { title: 'Аммиак при НАЖБП, мкмоль/л (n = 23)', cats: ['Исходно', '14 дней', '28 дней'], series: [{ name: 'Аммиак', c: 'bordo', v: [102.13, 90.35, 59.65] }] }],
      src: 'Экспериментальная и клиническая гастроэнтерология. 2022;207(11):5–16; 2023;220(12):140–147' },
    { id: 'bueverov', tags: ['pre', 'hcv'], name: 'Гепатит С, F1: водители с минимальной энцефалопатией', who: 'Буеверов А.О. и соавт., 2019 (СМАРТ РАДАР)',
      pop: '60 мужчин-водителей (34,2 ± 5,3 года) с хроническим гепатитом С генотипа 1, фиброз F1, минимальная энцефалопатия',
      design: 'L-орнитин-L-аспартат 12–15 г в сутки курсами по 2 месяца с 2-месячными перерывами, 12 месяцев',
      result: 'Аммиак снизился через 5 месяцев (p = 0,002); критическая частота мельканий улучшилась к концу 1-го месяца, тест связи чисел — к 5-му; доля нарушителей ПДД снизилась с 60 до 40 % (p = 0,03).',
      charts: [{ title: 'Аммиак, мкмоль/л', cats: ['Исходно', '5 месяцев'], series: [{ name: 'Аммиак', c: 'bordo', v: [135.53, 82.9] }] }, { title: 'Нарушения ПДД, % водителей', cats: ['Исходно', '12 месяцев'], max: 100, series: [{ name: 'Нарушения ПДД', c: 'navy', v: [60, 40] }] }],
      src: 'Терапевтический архив. 2019;91(2):52–58' },
    { id: 'tsyg', tags: ['pre', 'ald'], name: 'Алкогольный стеатоз и стеатогепатит', who: 'Цыганков Б.Д., Кручинская Ю.Н., 2011',
      pop: '91 пациент с алкогольным абстинентным синдромом и стеатозом или стеатогепатитом', design: 'Основная группа (n = 61): стандартная терапия + L-орнитин-L-аспартат 20 г в сутки внутривенно 5 дней, затем 9 г в сутки внутрь до 21-го дня; контроль (n = 30): стандартная терапия',
      result: 'В основной группе быстрее регрессировали цитолиз и холестаз: p < 0,01 для АСТ и ГГТП.',
      charts: [{ cats: ['АЛТ, Ед/л', 'АСТ, Ед/л', 'ГГТП, Ед/л'], series: [{ name: 'Основная, день 0', c: 'bordo', v: [66.95, 80.25, 235.89] }, { name: 'Основная, день 21', c: 'rose', v: [43.15, 40.12, 113.38] }, { name: 'Контроль, день 0', c: 'navy', v: [50.53, 54.33, 78.03] }, { name: 'Контроль, день 21', c: 'sky', v: [38.77, 33.27, 73.93] }] }],
      src: 'Наркология. 2011;10(9):52–58' },
    { id: 'bw2018', tags: ['cirr'], name: 'Цирроз: мета-анализ 10 РКИ', who: 'Butterworth R.F. и соавт., 2018',
      pop: '884 пациента с циррозом и печёночной энцефалопатией', design: 'Систематический обзор и мета-анализ рандомизированных исследований',
      result: 'Психическое состояние улучшалось чаще, особенно при минимальной энцефалопатии; аммиак снижался в среднем на 17,5 мкмоль/л. Пероральная форма особенно эффективна при минимальной энцефалопатии.',
      stats: [{ v: 'ОР 2,15', l: 'улучшение при минимальной энцефалопатии (1,48–3,14)' }, { v: 'ОР 1,36', l: 'улучшение психического состояния в целом' }, { v: '−17,5', l: 'мкмоль/л — средняя разница аммиака' }],
      src: 'J Clin Exp Hepatol. 2018;8(3):301–313' },
    { id: 'goh', tags: ['cirr'], name: 'Цирроз: Кокрейновский обзор', who: 'Goh E.T. и соавт., 2018',
      pop: '36 РКИ, 2377 пациентов с циррозом', design: 'Систематический обзор: профилактика и лечение печёночной энцефалопатии',
      result: 'По сравнению с плацебо или отсутствием вмешательства — меньше смертность и случаев энцефалопатии, но качество доказательств очень низкое: нужны крупные РКИ.',
      stats: [{ v: 'ОР 0,42', l: 'смертность (0,24–0,72)' }, { v: 'ОР 0,70', l: 'печёночная энцефалопатия (0,59–0,83)' }, { v: 'очень низкое', l: 'качество доказательств по GRADE' }],
      src: 'Cochrane Database Syst Rev. 2018;5:CD012410' }
  ];
  var TAGNAME = { pre: 'доцирротическая стадия', nafld: 'НАЖБП', ald: 'алкогольная болезнь', hcv: 'гепатит С', cirr: 'цирроз' };
  (function evidence() {
    var list = $('#evList'), det = $('#evDetail'), filt = $('#evFilter'); if (!list) return;
    var f = 'all', sel = null;
    function renderList() {
      var items = STUDIES.filter(function (s) { return f === 'all' || s.tags.indexOf(f) >= 0; });
      if (!sel || items.indexOf(sel) < 0) sel = items[0];
      list.innerHTML = items.map(function (s) { return '<li><button type="button" data-id="' + s.id + '" aria-pressed="' + (s === sel) + '"><span class="ev-name">' + esc(s.name) + '</span><span class="ev-who">' + esc(s.who) + '</span></button></li>'; }).join('');
      renderDetail(false);
    }
    function renderDetail(user) {
      var s = sel; if (!s) return;
      var h = '<div class="ev-tags">' + s.tags.map(function (t) { return '<span class="tag">' + TAGNAME[t] + '</span>'; }).join('') + '</div>' +
        '<h4>' + esc(s.name) + '</h4><p style="color:var(--ink-3);margin:0 0 .4rem">' + esc(s.who) + '</p>' +
        '<dl class="kv"><dt>Пациенты</dt><dd>' + esc(s.pop) + '</dd><dt>Дизайн</dt><dd>' + esc(s.design) + '</dd><dt>Результат</dt><dd>' + esc(s.result) + '</dd></dl>';
      if (s.stats) h += '<div class="stats" style="margin-top:6px">' + s.stats.map(function (x) { return '<div class="stat"><b>' + esc(x.v) + '</b><p>' + esc(x.l) + '</p></div>'; }).join('') + '</div>';
      if (s.charts) h += '<div class="grid-2 ' + (s.charts.length > 1 ? 'even' : '') + '" style="margin-top:6px">' + s.charts.map(function (_, i) { return '<div class="chart" id="evc' + i + '"' + (s.charts.length === 1 ? ' style="grid-column:1/-1"' : '') + '></div>'; }).join('') + '</div>';
      h += '<p class="src">' + esc(s.who) + '. ' + esc(s.src) + '</p>';
      det.innerHTML = h;
      charts = charts.filter(function (c) { return document.body.contains(c.el); });
      if (s.charts) s.charts.forEach(function (c, i) { vbar($('#evc' + i), c); });
      if (user) {
        state.ev[s.id] = true; save();
        if (Object.keys(state.ev).length >= 2) unlock(5);
      }
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-id]'); if (!b) return;
      sel = STUDIES.filter(function (s) { return s.id === b.getAttribute('data-id'); })[0];
      $$('button', list).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderDetail(true);
    });
    filt.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return;
      f = b.getAttribute('data-f');
      $$('button', filt).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderList();
    });
    renderList();
  })();

  /* ------------------------------------------------------------ chapter 5: regimens */
  (function regimens() {
    var seg = $('#regSeg'), tbl = $('#regTable'); if (!seg) return;
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-r]'); if (!b) return;
      var on = b.getAttribute('aria-pressed') !== 'true', key = b.getAttribute('data-r');
      $$('button', seg).forEach(function (x) { x.setAttribute('aria-pressed', String(on && x === b)); });
      tbl.classList.toggle('has-pick', on);
      $$('tbody tr', tbl).forEach(function (tr) { tr.classList.toggle('pick', on && tr.getAttribute('data-r') === key); });
    });
  })();

  /* ------------------------------------------------------------ chapter 6: case */
  var CASE_Q = [
    { correct: 1, opts: [
      ['Продолжу ноотропы и понаблюдаю 3 месяца', 'Ноотропы уже не помогли, а причина астении так и не найдена. У пациента МАЖБП и когнитивные жалобы — это показание измерить аммиак.'],
      ['Определю аммиак крови и выполню тест связи чисел', 'Верно. МАЖБП, астения и когнитивные жалобы — показание по НОГР-2025. Оба исследования занимают несколько минут на приёме.'],
      ['Направлю на МРТ головного мозга', 'Невролог органической патологии не нашёл. МРТ не ответит на вопрос о метаболической причине симптомов.'],
      ['Назначу биопсию печени', 'Фиброз уже оценён неинвазивно: FIB-4 и эластометрия. Биопсия не объяснит астению и не изменит ближайшую тактику.']] },
    { correct: 2, opts: [
      ['Норма: жалобы функциональные, связаны со стрессом', 'Аммиак 86 мкмоль/л выше порога 60, тест связи чисел 57 с — дольше 40. Это объективные отклонения.'],
      ['Явная печёночная энцефалопатия II стадии — нужна госпитализация', 'Для II стадии характерны дезориентация во времени, апатия, астериксис. У пациента их нет: он работает и водит машину.'],
      ['Гипераммониемия I степени и латентная (минимальная) энцефалопатия', 'Верно. 60–100 мкмоль/л — лёгкая гипераммониемия по Российскому консенсусу; тест связи чисел 40–60 с и 10–14 животных за минуту соответствуют латентной энцефалопатии.'],
      ['Раз аммиак повышен, у пациента цирроз — нужна биопсия', 'Гипераммониемия бывает и без цирроза: эластометрия 7,4 кПа и FIB-4 1,1 говорят о фиброзе F1–F2.']] },
    { correct: 0, opts: [
      ['Питание с белком 1,3 г/кг и дефицитом 500 ккал, отказ от алкоголя, ходьба и силовые нагрузки + L-орнитин-L-аспартат 3 г 3 раза в сутки 4 недели; контроль через 4 недели', 'Верно. Лечение основного заболевания и образ жизни — базис; L-орнитин-L-аспартат 9 г в сутки 4 недели — режим НОГР-2025 для НАЖБП с гипераммониемией.'],
      ['Ограничу белок до 0,5 г/кг в сутки', 'Чрезмерное ограничение белка усиливает распад мышц и повышает аммиак. Рекомендуется 1,2–1,5 г/кг в сутки.'],
      ['Только L-орнитин-L-аспартат, образ жизни обсуждать не буду', 'Гипоаммониемическая терапия дополняет лечение основного заболевания, но не заменяет его: без снижения веса и отказа от алкоголя стеатоз продолжит подавлять цикл мочевины.'],
      ['Лактулоза в высоких дозах постоянно', 'Высокие дозы лактулозы — инструмент при явной энцефалопатии. На доцирротической стадии без запоров это не первая линия, а избыточные дозы дают осложнения.']] }
  ];
  (function caseStudy() {
    var box = $('#case'); if (!box) return;
    var step = 0, solved = {}, KEYS = ['А', 'Б', 'В', 'Г'];
    var steps = $$('.case-step', box), bars = $$('.steps-bar span', box);
    var back = $('#caseBack'), nxt = $('#caseNext'), again = $('#caseRestart');
    CASE_Q.forEach(function (q, qi) {
      var host = $('.opts[data-q="' + qi + '"]', box);
      host.innerHTML = q.opts.map(function (o, i) { return '<button type="button" class="opt" data-i="' + i + '"><span class="key">' + KEYS[i] + '</span><span>' + esc(o[0]) + '</span></button>'; }).join('');
      host.addEventListener('click', function (e) {
        var b = e.target.closest('.opt'); if (!b) return;
        var i = +b.getAttribute('data-i'), right = i === q.correct;
        b.classList.remove('right', 'wrong'); b.classList.add(right ? 'right' : 'wrong');
        var fb = host.nextElementSibling; fb.hidden = false; fb.className = 'fb ' + (right ? 'right' : 'wrong'); fb.textContent = q.opts[i][1];
        if (right) { solved[qi] = true; nav(); nxt.focus({ preventScroll: true }); }
      });
    });
    function nav() {
      steps.forEach(function (s, i) { s.hidden = i !== step; });
      bars.forEach(function (b, i) { b.classList.toggle('on', i <= step); });
      back.hidden = step === 0;
      nxt.hidden = step >= 3 || !solved[step];
      again.hidden = step < 3;
    }
    function go(n) {
      step = n; nav();
      box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (step === 3) {
        if (!$('#caseChart').innerHTML) vbar($('#caseChart'), { title: 'Динамика (условные данные)', cats: ['Аммиак,\nмкмоль/л', 'ТСЧ, с', 'АЛТ, Ед/л', 'ГГТП, Ед/л'], series: [{ name: 'Исходно', c: 'bordo', v: [86, 57, 68, 92] }, { name: '4 недели', c: 'gold', v: [52, 41, 49, 70] }, { name: '6 месяцев', c: 'navy', v: [44, 36, 34, 48] }] });
        else redrawCharts(box);
        if (!state.caseDone) { state.caseDone = true; save(); updateTrail(); toast('Клинический пример пройден'); }
      }
    }
    back.addEventListener('click', function () { go(Math.max(0, step - 1)); });
    nxt.addEventListener('click', function () { go(Math.min(3, step + 1)); });
    again.addEventListener('click', function () {
      solved = {};
      $$('.opt', box).forEach(function (o) { o.classList.remove('right', 'wrong'); });
      $$('.fb', box).forEach(function (f) { f.hidden = true; });
      go(0);
    });
    nav();
  })();

  /* ------------------------------------------------------------ final: quiz, conclusions, share */
  var QUIZ = [
    { q: 'С какой стадии при НАЖБП снижается активность ферментов цикла мочевины?', o: ['Только при циррозе', 'Уже при простом стеатозе', 'Только при фиброзе F3', 'Только при печёночной недостаточности'], a: 1, e: 'В биоптатах человека активность орнитинтранскарбамилазы при стеатозе снижена примерно в 6 раз (De Chiara, 2018).' },
    { q: 'Как аммиак действует на звёздчатые клетки печени человека?', o: ['Не влияет на них', 'Вызывает регресс фиброза', 'Обратимо активирует: пролиферация, маркёры активации, оксидативный стресс', 'Действует только в концентрациях выше 1000 мкмоль/л'], a: 2, e: 'Эффект показан уже при 50–300 мкмоль/л за 24–72 часа (Jalan, 2016).' },
    { q: 'Пациентка 52 лет с МАЖБП жалуется на утомляемость и рассеянность, неврологический статус в норме. Первый шаг?', o: ['Аммиак крови и тест связи чисел', 'Ноотропы на 3 месяца', 'МРТ головного мозга', 'Биопсия печени'], a: 0, e: 'Заболевание печени плюс жалоба со стороны ЦНС — показание измерить аммиак по НОГР-2025.' },
    { q: 'Каков критерий гипераммониемии при экспресс-анализе капиллярной крови по НОГР-2025?', o: ['Больше 40 мкмоль/л', 'Больше 100 мкмоль/л', 'Больше 60 мкмоль/л', 'Больше 200 мкмоль/л'], a: 2, e: 'Норма — до 60 мкмоль/л; 60–100 — лёгкая, 100–200 — средняя, более 200 — тяжёлая гипераммониемия.' },
    { q: 'Какой режим L-орнитин-L-аспартата рекомендован при НАЖБП с гипераммониемией по НОГР-2025?', o: ['3 г однократно', '9 г в сутки внутрь не менее 4 недель', '40 г в сутки внутривенно 6 месяцев', 'Препарат показан только при циррозе'], a: 1, e: 'Купирование цитолиза и нормализация когнитивного статуса; контроль аммиака и теста связи чисел по окончании курса.' }
  ];
  (function quiz() {
    var box = $('#quizBox'); if (!box) return;
    var KEYS = ['А', 'Б', 'В', 'Г'];
    box.innerHTML = QUIZ.map(function (q, qi) {
      return '<div class="q" data-qi="' + qi + '"><p class="q-title">' + (qi + 1) + '. ' + esc(q.q) + '</p><div class="opts">' +
        q.o.map(function (o, i) { return '<button type="button" class="opt" data-i="' + i + '"><span class="key">' + KEYS[i] + '</span><span>' + esc(o) + '</span></button>'; }).join('') +
        '</div><div class="fb" hidden></div></div>';
    }).join('');
    function paint(qi) {
      var q = QUIZ[qi], wrap = $('.q[data-qi="' + qi + '"]', box), ans = state.quiz[qi];
      if (ans == null) return;
      $$('.opt', wrap).forEach(function (b) {
        var i = +b.getAttribute('data-i');
        b.classList.toggle('right', i === q.a); b.classList.toggle('wrong', i === ans && ans !== q.a);
        b.disabled = true;
      });
      var fb = $('.fb', wrap); fb.hidden = false; fb.className = 'fb ' + (ans === q.a ? 'right' : 'wrong');
      fb.textContent = (ans === q.a ? 'Верно. ' : 'Правильный ответ — ' + KEYS[q.a] + '. ') + q.e;
    }
    function score() {
      var n = Object.keys(state.quiz).length, ok = QUIZ.filter(function (q, i) { return state.quiz[i] === q.a; }).length;
      $('#quizScore').textContent = n ? 'Правильных ответов: ' + ok + ' из ' + QUIZ.length + (n < QUIZ.length ? ' · отвечено ' + n + ' из ' + QUIZ.length : '') : '';
      if (n === QUIZ.length && !state.quizDone) { state.quizDone = true; save(); updateTrail(); toast('Самопроверка завершена'); }
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b || b.disabled) return;
      var qi = +b.closest('.q').getAttribute('data-qi');
      state.quiz[qi] = +b.getAttribute('data-i'); save(); paint(qi); score();
    });
    QUIZ.forEach(function (_, i) { paint(i); }); score();
  })();

  function renderFinal() {
    var got = 0;
    $$('#conclusions .conclusion').forEach(function (li) { var on = !!state.t[li.getAttribute('data-c')]; li.classList.toggle('got', on); if (on) got++; });
    $('#finalLead').textContent = got === 5
      ? 'Вы открыли все пять выводов по ходу доклада. Ниже — итоги, самопроверка и литература.'
      : 'По ходу доклада вы открыли ' + got + ' из 5 выводов. Здесь все пять — с переходом к главе, где каждый обоснован.';
  }

  (function share() {
    var btn = $('#copyLink'); if (!btn) return;
    var url = 'https://denisyudin.com/liver', label = btn.querySelector('span');
    if (navigator.share) label.textContent = 'Поделиться ссылкой';
    btn.addEventListener('click', function () {
      if (navigator.share) { navigator.share({ title: 'Гипераммониемия на доцирротической стадии — интерактивный доклад', url: url }).catch(function () {}); return; }
      var done = function () { label.textContent = 'Ссылка скопирована'; setTimeout(function () { label.textContent = 'Скопировать ссылку'; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallback(); });
      else fallback();
      function fallback() { var i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); done(); } catch (e) { label.textContent = url; } i.remove(); }
    });
    $('#resetAll').addEventListener('click', function () {
      if (!window.confirm('Сбросить прогресс и пройти доклад заново?')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
      location.hash = '#start'; location.reload();
    });
  })();

  /* ------------------------------------------------------------ boot */
  renderTakeaways();
  route(false);
})();
