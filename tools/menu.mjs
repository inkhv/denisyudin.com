import {tools} from './catalog.mjs';

class ToolMenu extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:'open'});
    const current = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    // Gear: eight teeth on a ring, hub in the middle.
    const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="7.2"/></svg>';
    // The list uses Inter; load it once when the host page has not.
    if (!document.querySelector('link[href*="family=Inter"]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap';
      document.head.append(link);
    }
    root.innerHTML = `<link rel="stylesheet" href="/tools/menu.css">
      <details><summary aria-label="Tools menu" title="Tools">${icon}</summary>
      <nav popover="manual" aria-label="Site tools"><a class="catalog" href="/tools/" ${current === '/tools' ? 'aria-current="page"' : ''}>All tools <span>${tools.length}</span></a>
      <div class="tool-links">${tools.map(tool => `<a href="${tool.href}" ${current === tool.href.replace(/\/$/, '') ? 'aria-current="page"' : ''}>${tool.name}</a>`).join('')}</div>
      <div class="site-links"><a href="/">Home</a><a href="/portfolio.html">Works</a><a href="/cv/">CV</a></div></nav></details>`;
    const details = root.querySelector('details'), summary = root.querySelector('summary'), nav = root.querySelector('nav');
    const position = () => {
      const r = summary.getBoundingClientRect();
      const width = Math.min(224, innerWidth - 24);
      nav.style.width = `${width}px`;
      nav.style.left = `${Math.max(12, Math.min(r.right - width, innerWidth - width - 12))}px`;
      // Keep the full menu reachable even when its trigger sits low in a mobile panel.
      const top = Math.max(12, Math.min(r.bottom + 10, innerHeight - Math.min(480, innerHeight - 24) - 12));
      nav.style.top = `${top}px`;
      nav.style.maxHeight = `${innerHeight - top - 12}px`;
    };
    details.addEventListener('toggle', () => {
      if (details.open) { position(); nav.showPopover?.(); }
      else nav.hidePopover?.();
    });
    this.abort = new AbortController();
    const options = {signal:this.abort.signal};
    document.addEventListener('pointerdown', event => {
      if (details.open && !event.composedPath().includes(this)) details.open = false;
    }, options);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && details.open) { details.open = false; summary.focus(); event.preventDefault(); event.stopPropagation(); }
    }, options);
    root.addEventListener('focusout', event => {
      // Safari may blur a summary without focusing a pointer-clicked link.
      // Do not remove that link before its click can navigate.
      if (details.open && event.relatedTarget && !root.contains(event.relatedTarget)) details.open = false;
    });
    root.addEventListener('keydown', event => {
      if (!details.open || event.key !== 'Tab') return;
      const links = [...nav.querySelectorAll('a')];
      const active = root.activeElement;
      if (active === summary && !event.shiftKey) {
        event.preventDefault(); links[0].focus();
      } else if (links.includes(active)) {
        const next = links.indexOf(active) + (event.shiftKey ? -1 : 1);
        if (next >= 0 && next < links.length) {
          event.preventDefault(); links[next].focus();
        } else {
          details.open = false; summary.focus();
          // Shift-Tab returns to the trigger. Forward Tab continues into the page.
          if (event.shiftKey) event.preventDefault();
        }
      }
    });
    window.addEventListener('resize', () => { if (details.open) position(); }, options);
    window.addEventListener('scroll', () => { if (details.open) position(); }, {...options, capture:true});
  }
  disconnectedCallback() { this.abort?.abort(); }
}
customElements.define('dy-tool-menu', ToolMenu);
