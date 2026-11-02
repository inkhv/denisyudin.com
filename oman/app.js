(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('oman-data').textContent);
  const hotels = config.hotels;
  const byId = new Map(hotels.map(h => [h.id, h]));
  const fx = document.getElementById('fx');
  const refundable = document.getElementById('refundable');
  const withinBudget = document.getElementById('within-budget');
  const sort = document.getElementById('sort');
  const table = document.getElementById('hotel-table');
  const rows = Array.from(table.rows);
  const originalIndex = new Map(rows.map((row, index) => [row.dataset.hotel, index]));
  const money = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0});
  const omani = new Intl.NumberFormat('ru-RU', {minimumFractionDigits: 3, maximumFractionDigits: 3});
  let lastValidFx = config.fxRubPerOmr;
  let fxTouched = false;

  function update() {
    const entered = fx.valueAsNumber;
    if (!fx.checkValidity() || !Number.isFinite(entered)) {
      fx.setAttribute('aria-invalid', 'true');
      document.getElementById('rate-announcement').textContent = 'Введите курс от 1 до 10 000 ₽ за OMR. Пока сохранён предыдущий расчёт.';
      return;
    }
    fx.removeAttribute('aria-invalid');
    lastValidFx = fxTouched ? entered : config.fxRubPerOmr;
    const total = hotel => refundable.checked ? hotel.flex : hotel.cheap;
    const asRub = value => money.format(value * lastValidFx) + ' ₽';
    for (const element of document.querySelectorAll('[data-price]')) {
      element.textContent = asRub(total(byId.get(element.dataset.price)));
    }
    for (const element of document.querySelectorAll('[data-omr]')) {
      const h = byId.get(element.dataset.omr);
      element.textContent = (h.exact ? '' : '≈ ') + omani.format(total(h)) + ' OMR';
    }
    for (const element of document.querySelectorAll('[data-budget]')) {
      const over = total(byId.get(element.dataset.budget)) * lastValidFx > config.budgetRub;
      element.textContent = over ? 'Выше бюджета' : 'В бюджете';
      element.classList.toggle('over', over);
    }
    for (const element of document.querySelectorAll('[data-rule]')) {
      const h = byId.get(element.dataset.rule);
      element.textContent = refundable.checked || h.id === 'kempinski'
        ? 'Без предоплаты · отмена до ' + h.cancel + ' по времени Омана'
        : 'Предоплата · без возврата';
    }
    for (const row of rows) {
      row.hidden = withinBudget.checked && total(byId.get(row.dataset.hotel)) * lastValidFx > config.budgetRub;
    }
    const sorted = [...rows].sort((a, b) => sort.value === 'price'
      ? total(byId.get(a.dataset.hotel)) - total(byId.get(b.dataset.hotel))
      : originalIndex.get(a.dataset.hotel) - originalIndex.get(b.dataset.hotel));
    for (const row of sorted) table.append(row);
    const visible = rows.filter(row => !row.hidden).length;
    document.getElementById('empty-state').hidden = visible !== 0;
    table.closest('.table-wrap').hidden = visible === 0;
    document.getElementById('rate-announcement').textContent = refundable.checked
      ? 'Показаны тарифы с завтраками и бесплатной отменой до указанного срока. После срока отмены возможен штраф за весь период. В сравнении: ' + visible + ' из ' + hotels.length + '.'
      : 'Показаны самые дешёвые найденные прямые тарифы с завтраками. Для них требуется участие в бесплатной программе отеля. В сравнении: ' + visible + ' из ' + hotels.length + '.';
    const husnRub = total(byId.get('husn')) * lastValidFx;
    const difference = config.budgetRub - husnRub;
    document.getElementById('choice-difference').textContent = difference >= 0
      ? 'Примерно на ' + money.format(difference) + ' ₽ ниже 170 992 ₽ на скриншоте.'
      : 'Примерно на ' + money.format(-difference) + ' ₽ выше лимита 170 992 ₽.';
    document.getElementById('choice-title').innerHTML = difference >= 0 ? 'Я бы оставил<br>Al Husn.' : 'Al Husn выше<br>лимита.';
    document.getElementById('recommendation-text').textContent = difference >= 0
      ? 'Сам отель со скриншота укладывается в бюджет при прямом бронировании через Hilton Honors. Можно сэкономить, сохранив выбранный отель и категорию King Deluxe.'
      : 'При выбранных условиях и курсе Al Husn выходит за бюджет. Если лимит строгий, посмотрите Al Bandar: он сохраняет бухту и пляжный формат, с более семейной атмосферой.';
    document.getElementById('hero-rule').textContent = refundable.checked
      ? 'Завтраки на двоих и налоги включены. Тариф Hilton Honors с оплатой при проживании и отменой до 16 ноября. В системе отеля выберите возвратный тариф отдельно.'
      : 'Завтраки на двоих и налоги включены. Нужен бесплатный Hilton Honors. Полная предоплата, отмена и изменения без возврата.';
  }

  document.getElementById('controls').hidden = false;
  for (const input of [refundable, withinBudget, sort]) input.addEventListener('change', update);
  fx.addEventListener('input', () => { fxTouched = true; update(); });
  update();

  const copy = document.getElementById('copy-request');
  const status = document.getElementById('copy-status');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(document.getElementById('hotel-request').value);
      status.textContent = 'Запрос скопирован. Его можно отправить в отдел бронирования выбранного отеля.';
    } catch {
      document.getElementById('request-details').open = true;
      const text = document.getElementById('hotel-request');
      text.focus();
      text.select();
      status.textContent = 'Автоматическое копирование недоступно. Текст выделен ниже; скопируйте его вручную.';
    } finally {
      copy.disabled = false;
    }
  });
})();
