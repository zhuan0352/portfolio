// Highlights the navigation link for the section being read, and keeps the
// footer year current.
(() => {
  'use strict';

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const links = new Map();
  document.querySelectorAll('.nav nav a[href^="#"]').forEach((a) => {
    links.set(a.getAttribute('href').slice(1), a);
  });
  const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;

  function update() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    // Same sliding reference line the background uses: top of the window at
    // the top of the page, bottom of the window at the end.
    const line = vh * Math.min(1, Math.max(0, window.scrollY / max));
    let active = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line + 1) active = s;
    }
    links.forEach((a, id) => {
      if (id === active.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
