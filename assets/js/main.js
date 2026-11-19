// Highlights the navigation link for the section being read, keeps the footer
// year current, runs the mood slider and wakes the project demos early.
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

// "How's your week going?" The slider has no labels on purpose: the visitor
// answers by feel, and the background and a short line respond.
(() => {
  'use strict';

  const slider = document.getElementById('mood');
  const reply = document.getElementById('mood-reply');
  if (!slider || !reply) return;

  const KEY = 'week-mood';
  // [up to this point on the slider, label for screen readers, reply]
  const REPLIES = [
    [0.2, 'rough week', 'Oof, sorry. Hope it gets better from here.'],
    [0.4, 'tough week', 'Hang in there, the weekend’s coming.'],
    [0.6, 'okay week', 'Not bad at all.'],
    [0.8, 'good week', 'Nice! Keep it going.'],
    [1.01, 'great week', 'Love to hear it!'],
  ];

  // The fill colour follows the answer, through the site's own section colours:
  // calm blue at the low end, sage in the middle, warm amber at the top.
  const box = slider.closest('.mood-slider');

  const STOPS = [[127, 163, 200], [143, 176, 138], [224, 154, 79]];

  function paint(v) {
    if (!box) return;
    const t = v * 2;
    const [a, b] = t < 1 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
    const f = t < 1 ? t : t - 1;
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * f));
    box.style.setProperty('--v', v.toFixed(4));
    box.style.setProperty('--mood-fill', `rgb(${c.join(', ')})`);
  }

  function respond(value, remember) {
    const v = Math.min(1, Math.max(0, value / 100));
    const [, label, text] = REPLIES.find(([upTo]) => v < upTo);
    paint(v);
    slider.setAttribute('aria-valuetext', label);
    reply.textContent = text;
    reply.classList.add('shown');
    if (window.livingBackground) window.livingBackground.setMood(v);
    if (remember) {
      try { localStorage.setItem(KEY, String(Math.round(value))); } catch (e) { /* private mode */ }
    }
  }

  slider.addEventListener('input', () => respond(Number(slider.value), true));
  // A pressed state for browsers without :has()
  slider.addEventListener('pointerdown', () => box && box.classList.add('dragging'));
  window.addEventListener('pointerup', () => box && box.classList.remove('dragging'));

  paint(Number(slider.value) / 100);
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved !== null && !Number.isNaN(Number(saved))) {
    slider.value = saved;
    respond(Number(saved), false);
  }
})();

// The project demos run on Render's free plan, which puts them to sleep after
// about 15 minutes without visitors and takes 15 to 30 seconds to wake them.
// Pinging them as soon as someone opens this page means they are usually
// awake by the time a visitor scrolls down and clicks.
(() => {
  'use strict';

  const urls = [...document.querySelectorAll('a[data-wake]')].map((a) => a.href);
  if (!urls.length) return;

  const KEY = 'demos-woken-at';
  const EVERY_MS = 10 * 60 * 1000;   // no need to ping more often than this

  function wake() {
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch (e) { /* private mode */ }
    if (Date.now() - last < EVERY_MS) return;
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { /* private mode */ }
    // no-cors: the response can't be read, but the request still wakes the server.
    urls.forEach((url) => {
      fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).catch(() => {});
    });
  }

  // Shortly after the page has loaded, so it never slows the page itself.
  window.addEventListener('load', () => setTimeout(wake, 800));
  // And again if the visitor comes back to the tab, or reaches for a card, after a long while.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  document.querySelectorAll('a[data-wake]').forEach((a) => {
    a.addEventListener('pointerenter', wake);
    a.addEventListener('focus', wake);
  });
})();
