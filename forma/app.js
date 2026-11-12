(() => {
  'use strict';
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const agents = {
    branding: { name: 'Бренд-дизайнер', tools: ['Figma', 'Krea', 'Magnific'], skills: ['Брендинг', 'Айдентика', 'Система носителей'], art: 'art-violet' },
    illustration: { name: 'Иллюстратор', tools: ['Krea', 'Magnific'], skills: ['Иллюстрации', 'Визуальные серии', 'Сохранение стиля'], art: 'art-violet' },
    '3d': { name: '3D-художник', tools: ['Blender', 'Cinema 4D'], skills: ['3D', 'Материалы и свет', 'Предметные инсталляции'], art: 'art-chrome' },
    presentation: { name: 'Презентационный дизайнер', tools: ['Figma', 'Weave'], skills: ['Презентации', 'Сторителлинг', 'Макеты слайдов'], art: 'art-violet' },
    email: { name: 'Email-дизайнер', tools: ['Figma', 'GitHub'], skills: ['Рассылки', 'Цепочки писем', 'Email-макеты'], art: 'art-orange' },
    concept: { name: 'Концепт-директор', tools: ['Krea', 'Higgsfield', 'Seedance', 'Kling', 'MiniMax'], skills: ['Концептуальные макеты', 'Фотосюжет', 'Крафт', 'Предметная инсталляция', 'Сценарий', 'Образный борд'], art: 'art-orange' },
    architecture: { name: 'Архитектор формы', tools: ['Blender', 'Krea'], skills: ['Архитектурный минимализм', 'Пространственные концепции'], art: 'art-chrome' }
  };
  const styles = {
    minimal: { name: 'Минимализм', title: 'Less.\nBut better.', type: 'Чистая и точная', description: 'Воздух, точные пропорции, спокойная палитра.' },
    bold: { name: 'Смелый', title: 'Make\na mark.', type: 'Крупная и выразительная', description: 'Цветовой контраст, крупный масштаб, смелая форма.' },
    craft: { name: 'Крафт', title: 'Made\nto feel.', type: 'Живая и тактильная', description: 'Тёплые материалы, природные цвета, ручной характер.' },
    custom: { name: 'Свой гайд' }
  };
  let plan = 'Solo';
  let billing = 'month';
  let attachment = null;
  let profile = null;
  let fileGeneration = 0;
  const menu = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Открыть меню'); mobileNav.hidden = true; }
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню'); mobileNav.hidden = !open; });
  mobileNav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  $$('.filter').forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    $$('.filter').forEach((b) => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    let count = 0;
    $$('.agent-card').forEach((card) => { const visible = filter === 'all' || card.dataset.category.split(' ').includes(filter); card.hidden = !visible; if (visible) count++; });
    $('#filter-status').textContent = `Показано агентов: ${count}`;
  }));
  function currentStyle() { return $('input[name="style"]:checked').value; }
  function invalidateProfile() { profile = null; $('#profile-result').hidden = true; $('#preview-hint').hidden = false; }
  function updatePreview() {
    const agent = agents[$('#agent-select').value];
    $('#preview-name').textContent = agent.name;
    $('#preview-brand').textContent = $('#brand-name').value.trim() ? `Для бренда ${$('#brand-name').value.trim()}` : 'Готов познакомиться с вашим брендом';
    $('#preview-style').textContent = styles[currentStyle()].name;
    $('#preview-context').textContent = attachment ? attachment.name : $('#brand-context').value.trim() ? 'Добавлены правила бренда' : 'Ожидает вводных';
    $('#preview-tools').textContent = agent.tools.join(' · ');
    $('#preview-plan').textContent = plan;
    $('#preview-art').className = `preview-art art ${agent.art}`;
  }
  function setStyle(style) {
    const data = styles[style];
    if (style !== 'custom') {
      $('.brand-demo').dataset.style = style;
      $('#board-headline').replaceChildren(...data.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
      $('#type-name').textContent = data.type;
      $('#style-description').textContent = data.description;
      $$('.style-tabs button').forEach((b) => { b.classList.toggle('selected', b.dataset.style === style); b.setAttribute('aria-pressed', String(b.dataset.style === style)); });
    }
    const radio = $(`input[name="style"][value="${style}"]`);
    if (radio) radio.checked = true;
    invalidateProfile(); updatePreview();
  }
  $$('.style-tabs button').forEach((b) => b.addEventListener('click', () => setStyle(b.dataset.style)));
  $$('input[name="style"]').forEach((r) => r.addEventListener('change', () => setStyle(r.value)));
  $$('[data-pick]').forEach((a) => a.addEventListener('click', () => { $('#agent-select').value = a.dataset.pick; invalidateProfile(); updatePreview(); }));
  $$('[data-plan]').forEach((a) => a.addEventListener('click', () => { plan = a.dataset.plan; invalidateProfile(); updatePreview(); }));
  $$('.billing-toggle button').forEach((button) => button.addEventListener('click', () => {
    billing = button.dataset.billing;
    $$('.billing-toggle button').forEach((b) => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    $$('.price > span:first-child').forEach((price) => { const value = Number(price.dataset[billing]); price.textContent = new Intl.NumberFormat('ru-RU').format(value); price.closest('.price-card').querySelector('.billing-detail').textContent = billing === 'month' ? 'Оплата помесячно' : `${new Intl.NumberFormat('ru-RU').format(value * 12)} ₽ за год · пример`; });
    invalidateProfile();
  }));
  $('#agent-form').addEventListener('input', (event) => { if (event.target.type !== 'file') { invalidateProfile(); updatePreview(); } });
  $('#agent-select').addEventListener('change', () => { invalidateProfile(); updatePreview(); });
  function fileMessage(text, error = false) { $('#file-result').hidden = false; $('#file-status').textContent = text; $('#file-status').classList.toggle('error', error); $('#remove-file').hidden = !attachment; }
  async function acceptFile(file) {
    const generation = ++fileGeneration;
    $('.config-submit').disabled = false;
    attachment = null; invalidateProfile(); updatePreview();
    if (!file) { $('#file-result').hidden = true; return; }
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'md'].includes(extension)) { fileMessage('Этот формат не поддерживается. Выберите PDF, TXT или MD.', true); $('#guide-file').value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { fileMessage('Файл больше 10 МБ. Добавьте сокращённый гайд.', true); $('#guide-file').value = ''; return; }
    if (file.size === 0) { fileMessage('Файл пустой. Выберите файл с содержимым.', true); $('#guide-file').value = ''; return; }
    $('.config-submit').disabled = true;
    fileMessage('Читаем файл на вашем устройстве…');
    try {
      let text = null;
      if (extension !== 'pdf') { if (file.size > 1024 * 1024) throw new Error('Текстовый файл больше 1 МБ. Сократите его или выберите PDF до 10 МБ.'); text = await file.text(); }
      if (generation !== fileGeneration) return;
      attachment = { name: file.name, size: file.size, format: extension, text, handling: extension === 'pdf' ? 'metadata_only_attach_original_when_launching' : 'text_included' };
      fileMessage(extension === 'pdf' ? `${file.name} · имя файла добавлено. PDF не распознаётся в демо; приложите оригинал при запуске.` : `${file.name} · текст прочитан локально и войдёт в скачанный профиль.`);
      updatePreview();
    } catch (error) { if (generation === fileGeneration) { attachment = null; fileMessage(error.message || 'Не удалось прочитать файл. Попробуйте выбрать его снова.', true); $('#guide-file').value = ''; } }
    finally { if (generation === fileGeneration) $('.config-submit').disabled = false; }
  }
  $('#guide-file').addEventListener('change', (e) => acceptFile(e.target.files[0]));
  $('#remove-file').addEventListener('click', () => { fileGeneration++; attachment = null; $('#guide-file').value = ''; $('#file-result').hidden = true; $('.config-submit').disabled = false; invalidateProfile(); updatePreview(); });
  const drop = $('#drop-area');
  ['dragenter','dragover'].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave','drop'].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.remove('dragging'); }));
  drop.addEventListener('drop', (e) => { $('#guide-file').value = ''; if (e.dataTransfer.files.length > 1) { fileGeneration++; attachment = null; $('.config-submit').disabled = false; invalidateProfile(); updatePreview(); fileMessage('Добавьте один файл. Правила из остальных можно вставить в поле контекста.', true); return; } acceptFile(e.dataTransfer.files[0]); });
  $('#agent-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const key = $('#agent-select').value;
    const agent = agents[key];
    profile = { schema: 'forma-agent-profile/v1', mode: 'concept_demo', agent: { id: key, name: agent.name, skills: agent.skills }, core: { suggested: 'Claude Code', model: 'To be confirmed' }, tools_proposed: agent.tools, brand: { name: $('#brand-name').value.trim() || 'Без названия', style: currentStyle(), style_name: styles[currentStyle()].name, context: $('#brand-context').value.trim(), attachment }, subscription_example: { plan, billing }, note: 'Это конфигурация концепции FORMA. Агент не запущен, платёж не создан, интеграции не подключены. PDF передаётся отдельно.' };
    $('#profile-result').hidden = false; $('#preview-hint').hidden = true;
    $('#form-status').textContent = `Профиль «${agent.name}» собран. Можно скачать JSON.`;
    $('#download-profile').focus({preventScroll: true});
    $('#profile-result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  });
  $('#download-profile').addEventListener('click', () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `forma-${profile.agent.id}-profile.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('#form-status').textContent = 'Профиль подготовлен для скачивания.';
  });
  updatePreview();
})();
