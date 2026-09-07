(() => {
  const gallery = document.querySelector('.gallery');
  const switches = [...document.querySelectorAll('[data-view]')];
  const links = [...document.querySelectorAll('[data-gallery]')];
  const dialog = document.querySelector('.viewer');
  const image = document.querySelector('#viewer-image');
  const title = document.querySelector('#viewer-title');
  const type = document.querySelector('#viewer-type');
  const counter = document.querySelector('#viewer-counter');
  const download = document.querySelector('#viewer-download');
  let current = 0;
  let openedFrom = null;
  let sequence = links;

  document.querySelector('.view-switch').hidden = false;
  for (const button of switches) {
    button.addEventListener('click', () => {
      gallery.dataset.view = button.dataset.view;
      switches.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const sizes = button.dataset.view === 'all'
        ? '(max-width: 720px) calc(100vw - 32px), (max-width: 1600px) calc((100vw - 100px) / 2), 750px'
        : '(max-width: 720px) calc(100vw - 32px), (max-width: 1200px) calc(100vw - 80px), 1100px';
      links.forEach(link => { link.querySelector('img').sizes = sizes; });
    });
  }

  if (typeof dialog.showModal !== 'function') return;
  function render() {
    const link = sequence[current];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    title.textContent = link.dataset.title;
    type.textContent = link.dataset.typeLabel;
    counter.textContent = (current + 1) + ' / ' + sequence.length;
    download.href = link.href;
    download.download = link.href.split('/').pop();
  }
  function step(delta) {
    current = (current + delta + sequence.length) % sequence.length;
    render();
  }
  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const view = gallery.dataset.view || 'all';
      sequence = links.filter(item => view === 'all' || item.closest('.variant').dataset.type === view);
      current = sequence.indexOf(link);
      openedFrom = link;
      render();
      dialog.showModal();
      document.body.classList.add('viewer-open');
      dialog.querySelector('[data-close]').focus();
    });
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  dialog.querySelector('[data-next]').addEventListener('click', () => step(1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('viewer-open');
    image.removeAttribute('src');
    openedFrom?.focus({preventScroll:true});
  });
})();
