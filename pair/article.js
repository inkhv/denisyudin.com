(() => {
  const progress = document.querySelector('.reading-progress span');
  const links = [...document.querySelectorAll('.toc li a')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  let scheduled = false;

  function updateReadingPosition() {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0;
    progress.style.transform = `scaleX(${ratio})`;
    let current = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= 160) current = index;
    });
    if (ratio >= 0.995) current = sections.length - 1;
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateReadingPosition);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  updateReadingPosition();
})();
