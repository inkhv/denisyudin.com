import {tools} from './catalog.mjs';
const buttons = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('[data-group]')];
const count = document.querySelector('#toolCount');
buttons.forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.filter;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  let visible = 0;
  cards.forEach(card => { card.hidden = category !== 'all' && card.dataset.group !== category; if (!card.hidden) visible++; });
  count.textContent = category === 'all' ? `${tools.length} инструментов` : `Показано ${visible} из ${tools.length}`;
}));
