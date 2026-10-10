(() => {
  const details = document.querySelector('.toc');
  const mobile = matchMedia('(max-width: 760px)');
  const syncMenu = () => { details.open = !mobile.matches; };
  syncMenu();
  mobile.addEventListener('change', syncMenu);
  const links = [...document.querySelectorAll('.toc li a')];
  const sections = links.map(a => document.getElementById(a.hash.slice(1)));
  let scheduled = false;
  function update() {
    let current = 0;
    sections.forEach((section, i) => {
      if (section.getBoundingClientRect().top <= 145) current = i;
    });
    links.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  links.forEach(link => link.addEventListener('click', () => {
    if (mobile.matches) details.open = false;
  }));
  const input = document.getElementById('hero-search');
  const count = document.getElementById('search-count');
  const empty = document.getElementById('search-empty');
  const people = [...document.querySelectorAll('.people-index li')];
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const index = people.map(el => normalize(el.dataset.search));
  function filter() {
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    let visible = 0;
    people.forEach((el, i) => {
      el.hidden = !words.every(word => {
        if (/^\d{1,3}$/.test(word)) return index[i].startsWith(word.padStart(3, '0') + ' ');
        if (word.length <= 2) return index[i].split(/[^\p{L}\p{N}]+/u).includes(word);
        return index[i].includes(word);
      });
      if (!el.hidden) visible++;
    });
    count.textContent = `Показано ${visible} из 55`;
    empty.hidden = visible > 0;
  }
  document.querySelector('.search-tools').hidden = false;
  input.addEventListener('input', filter);
  document.getElementById('clear-search').addEventListener('click', () => {
    input.value = ''; filter(); input.focus();
  });
  update();
})();
