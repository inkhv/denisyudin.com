// Filter for the typographic index: aside list items mute non-matching rows.
// Without JS all rows stay visible. Hash links (#works, #tools, #research,
// #articles) select a filter; rows carry no ids, so the page never jumps.
(() => {
  const list = document.querySelector('[data-filter-list]');
  if (!list) return;
  const key = list.dataset.filterKey || 'group';
  const items = [...list.querySelectorAll('[data-filter]')];
  const rows = [...document.querySelectorAll('.index__row, .cover')];
  const showAll = document.querySelector('[data-filter-all]');
  const valid = new Set(items.map(li => li.dataset.filter));
  let active = null;

  const apply = (value) => {
    active = valid.has(value) ? value : null;
    items.forEach(li => li.classList.toggle('is-selected', li.dataset.filter === active));
    rows.forEach(row => {
      const values = (row.dataset[key] || '').split('|');
      row.classList.toggle('is-muted', !!active && !values.includes(active));
    });
    if (showAll) showAll.classList.toggle('is-visible', !!active);
  };
  const setHash = () => history.replaceState(null, '', active ? '#' + active : location.pathname + location.search);

  items.forEach(li => {
    li.tabIndex = 0;
    const toggle = () => { apply(active === li.dataset.filter ? null : li.dataset.filter); setHash(); };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  if (showAll) {
    showAll.tabIndex = 0;
    const reset = () => { apply(null); setHash(); };
    showAll.addEventListener('click', reset);
    showAll.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reset(); } });
  }
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(a => {
    const target = a.getAttribute('href').replace(/^\/?#/, '');
    if (!valid.has(target)) return;
    if (a.getAttribute('href').startsWith('/#') && location.pathname !== '/' && location.pathname !== '/index.html') return;
    a.addEventListener('click', e => { e.preventDefault(); apply(target); setHash(); });
  });

  const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); if (valid.has(h)) apply(h); };
  fromHash();
  addEventListener('hashchange', fromHash);
})();
