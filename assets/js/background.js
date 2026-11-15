/*
  Living background.

  A fragment shader draws a slowly flowing Perlin-style noise field, cuts it
  into brightness bands and renders the bands as a dithered dot pattern.

  Nothing here is controlled by hand. Three things change the picture:
    1. Scrolling: every section has its own look (PRESETS below) and the
       background morphs from one to the next as the page scrolls.
    2. Slow drift: each setting wanders a little on its own long cycle, so
       the pattern never sits still and never repeats.
    3. A new random seed on every visit.
    4. The cursor: a soft lamp follows it, brightening the page, calming the
       pattern underneath (easier reading) and bending the pattern around it.

  To restyle the background, edit PRESETS. Keys match the data-bg attribute
  on each <section> in index.html.
*/
(() => {
  'use strict';

  // freq     size of the shapes (higher = smaller, busier)
  // warp     how much the field folds over itself (higher = more swirl)
  // levels   number of brightness bands (whole number, 2 or more)
  // cell     dot size in CSS pixels (whole number, 1 or more)
  // contrast how strongly the pattern shows against the page
  // lines    0 = filled bands, 1 = contour lines only
  // speed    how fast the field flows
  // page     colour of the page in that section
  // tint     colour of the pattern (a deeper shade of the page colour works best)
  const PRESETS = {
    about:      { freq: 0.70, warp: 1.30, levels: 5, cell: 2, contrast: 0.95, lines: 0.00, speed: 0.300, page: '#f3dfbf', tint: '#d18d42' },
    experience: { freq: 1.00, warp: 0.85, levels: 4, cell: 3, contrast: 0.90, lines: 0.00, speed: 0.300, page: '#d6e7cf', tint: '#5d9a5a' },
    blog:       { freq: 0.85, warp: 1.25, levels: 8, cell: 2, contrast: 1.00, lines: 1.00, speed: 0.026, page: '#cfe1f1', tint: '#4c80b8' },
    projects:   { freq: 1.25, warp: 0.60, levels: 4, cell: 6, contrast: 0.90, lines: 0.00, speed: 0.022, page: '#e1d7f3', tint: '#8163c4' },
    resume:     { freq: 0.45, warp: 0.50, levels: 3, cell: 3, contrast: 0.75, lines: 0.00, speed: 0.016, page: '#f6dad0', tint: '#d47258' },
  };

  // The lamp that follows the cursor.
  const LAMP = {
    size: 0.20,   // radius, as a share of the window height
    glow: 0.55,   // how much the page brightens under it (0 to 1)
    calm: 0.60,   // how much the pattern fades under it (0 to 1)
    bend: 0.80,   // how strongly the pattern bulges around it
  };

  const TEXT_VEIL = 0.55;          // pattern strength behind the text column (0 to 1)
  const MAX_DPR = 1.5;             // caps resolution to keep laptops and phones cool
  const FRAME_MS = 1000 / 30;      // the motion is slow, 30 fps is plenty
  const STORE_KEY = 'bg-paused';

  const canvas = document.getElementById('bg');
  const toggle = document.getElementById('bg-toggle');
  const column = document.querySelector('main');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const sections = [...document.querySelectorAll('[data-bg]')].filter((el) => PRESETS[el.dataset.bg]);
  if (!canvas || !sections.length) return;

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  /* ───────────── Shader ───────────── */

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uSeed;
    uniform float uFreq;
    uniform float uWarp;
    uniform float uContrast;
    uniform float uLines;
    uniform vec3  uBg;
    uniform vec3  uFg;
    uniform vec2  uLight;
    uniform vec2  uColumn;    // centre x and half width of the text column, in pixels
    uniform float uVeil;
    uniform vec2  uStepA;     // cell size (pixels), levels
    uniform vec2  uStepB;
    uniform float uMix;
    uniform vec3  uLamp;      // cursor lamp: x, y in pixels, and strength 0 to 1
    uniform vec4  uLampCfg;   // size, glow, calm, bend

    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
               dot(p, vec3(269.5, 183.3, 246.1)),
               dot(p, vec3(113.5, 271.9, 124.6)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    // Gradient (Perlin) noise in three dimensions: x, y and time.
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      return mix(
        mix(mix(dot(hash3(i),                      f),
                dot(hash3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
            mix(dot(hash3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                dot(hash3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(dot(hash3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                dot(hash3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
            mix(dot(hash3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                dot(hash3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
    }

    // The field: noise, folded over itself by two more noise lookups.
    float field(vec2 p) {
      vec3 q = vec3(p * uFreq + uSeed, uTime);
      vec2 w = vec2(noise(q + vec3(0.0, 0.0, 3.1)), noise(q + vec3(5.2, 1.3, 7.7)));
      q.xy += w * uWarp * 1.6;
      float n = noise(q) * 0.62
              + noise(vec3(q.xy * 2.03 + 11.0, q.z * 1.4)) * 0.27
              + noise(vec3(q.xy * 4.01 + 23.0, q.z * 1.9)) * 0.11;
      return clamp(n * 1.75 + 0.5, 0.0, 1.0);
    }

    // Ordered dithering thresholds (8 x 8 Bayer matrix, computed on the fly).
    float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

    // How strongly the cursor lamp reaches a pixel, 0 to 1.
    float lampAt(vec2 px) {
      vec2 d = (px - uLamp.xy) / uRes.y;
      return uLamp.z * exp(-dot(d, d) / (uLampCfg.x * uLampCfg.x));
    }

    float shade(float cell, float levels) {
      vec2 id = floor(gl_FragCoord.xy / cell);
      vec2 centre = (id + 0.5) * cell;
      // Under the lamp the pattern is pulled toward the cursor, like a lens.
      vec2 pull = (centre - uLamp.xy) / uRes.y * lampAt(centre) * uLampCfg.w;
      float v = field((centre / uRes.y - pull) * 3.0);

      float val = v * (levels - 1.0);
      float fr = fract(val);
      float th = bayer8(id) + 0.0078;

      float bands = (floor(val) + step(th, fr)) / (levels - 1.0);
      float edge = min(fr, 1.0 - fr);
      float contour = 1.0 - step(0.035 + 0.075 * th, edge);
      float i = mix(bands, contour, uLines);

      // Round the cells into dots once they are big enough to see.
      vec2 f = fract(gl_FragCoord.xy / cell) - 0.5;
      float dotMask = cell < 3.0 ? 1.0 : smoothstep(0.5, 0.32, length(f));
      return i * dotMask;
    }

    void main() {
      float i = shade(uStepA.x, uStepA.y);
      if (uMix > 0.001) i = mix(i, shade(uStepB.x, uStepB.y), uMix);

      // A soft pool of light that wanders across the page.
      float d = distance(gl_FragCoord.xy, uLight * uRes) / uRes.y;
      float light = 0.5 + 0.5 * exp(-d * d / 0.5);

      // Quieter behind the text column so reading stays easy.
      float dx = abs(gl_FragCoord.x - uColumn.x);
      float veil = mix(uVeil, 1.0, smoothstep(uColumn.y * 0.95, uColumn.y * 1.3, dx));

      // The cursor lamp: brighter page, quieter pattern.
      float lamp = lampAt(gl_FragCoord.xy);
      vec3 page = mix(uBg, vec3(1.0), lamp * uLampCfg.y);

      float a = clamp(i * uContrast * light * veil * (1.0 - lamp * uLampCfg.z), 0.0, 1.0);
      gl_FragColor = vec4(mix(page, uFg, a), 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    document.documentElement.classList.add('no-webgl');
    return;
  }
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const name of ['uRes', 'uTime', 'uSeed', 'uFreq', 'uWarp', 'uContrast', 'uLines', 'uBg', 'uFg',
    'uLight', 'uColumn', 'uVeil', 'uStepA', 'uStepB', 'uMix', 'uLamp', 'uLampCfg']) {
    U[name] = gl.getUniformLocation(program, name);
  }

  /* ───────────── Helpers ───────────── */

  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  const SMOOTH_KEYS = ['freq', 'warp', 'contrast', 'lines', 'speed'];
  const presets = sections.map((el) => {
    const p = PRESETS[el.dataset.bg];
    return { ...p, pageHex: p.page, page: hex(p.page), tint: hex(p.tint), cell: Math.max(1, Math.round(p.cell)), levels: Math.max(2, Math.round(p.levels)) };
  });

  /* ───────────── State ───────────── */

  const seed = [Math.random() * 100, Math.random() * 100];
  const phase = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);

  let dpr = 1;
  let tops = [];
  let colX = 0;
  let colHalf = 0;

  let cur = null;                  // smoothly changing settings
  let stepA = null;                // stepped settings (dot size, band count) cross-fade
  let stepB = null;
  let fade = 0;
  let fading = false;

  let flow = Math.random() * 50;   // time fed to the noise field
  let clock = 0;                   // time fed to the slow drift
  let light = [0.5, 0.6];
  let pointer = null;              // where the cursor is, in CSS pixels from the top left
  let pointerInside = false;
  let lamp = [0, 0, 0];            // eased x, y (CSS pixels) and strength

  let pageRgb = '';                // page colour last handed to the stylesheet
  let section = -1;                // index of the section whose look is showing
  let paused = false;
  let raf = 0;
  let last = 0;

  /* ───────────── Layout ───────────── */

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    tops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
    const r = column.getBoundingClientRect();
    colX = (r.left + r.width / 2) * dpr;
    colHalf = (r.width / 2) * dpr;
  }

  // Where the page is scrolled to decides the look. The reference line slides
  // from the top of the window (page top) to the bottom (page end), so the
  // first and last sections always get their own look.
  function target() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const y = window.scrollY + vh * clamp01(window.scrollY / max);
    const half = vh * 0.3;

    const out = { ...presets[0], tint: [...presets[0].tint], page: [...presets[0].page] };
    let index = 0;
    for (let i = 1; i < presets.length; i++) {
      const t = smooth((y - (tops[i] - half)) / (2 * half));
      if (t <= 0) break;
      for (const k of SMOOTH_KEYS) out[k] = lerp(out[k], presets[i][k], t);
      out.tint = out.tint.map((c, j) => lerp(c, presets[i].tint[j], t));
      out.page = out.page.map((c, j) => lerp(c, presets[i].page[j], t));
      if (t >= 0.5) index = i;
    }
    return { out, index };
  }

  /* ───────────── Animation ───────────── */

  function advance(dt) {
    const { out, index } = target();

    if (!cur) {
      cur = out;
      stepA = { cell: presets[index].cell, levels: presets[index].levels };
      stepB = stepA;
    } else {
      // Ease toward the target so fast scrolling never makes the pattern jump.
      const k = 1 - Math.exp(-dt / 0.7);
      for (const key of SMOOTH_KEYS) cur[key] = lerp(cur[key], out[key], k);
      cur.tint = cur.tint.map((c, j) => lerp(c, out.tint[j], k));
      cur.page = cur.page.map((c, j) => lerp(c, out.page[j], k));
    }

    // Keep the browser's own chrome colour in step with the section.
    if (index !== section) {
      section = index;
      if (themeMeta) themeMeta.setAttribute('content', presets[index].pageHex);
    }

    // Dot size and band count cannot change smoothly, so two patterns cross-fade.
    const want = presets[index];
    if (!fading && (want.cell !== stepA.cell || want.levels !== stepA.levels)) {
      stepB = { cell: want.cell, levels: want.levels };
      fading = true;
      fade = 0;
    }
    if (fading) {
      fade += dt / 1.6;
      if (fade >= 1) {
        stepA = stepB;
        fading = false;
        fade = 0;
      }
    }

    clock += dt;
    flow += dt * cur.speed;

    // A soft pool of stronger pattern wanders on its own.
    const wanderX = 0.5 + 0.34 * Math.sin(clock / 37 + phase[3]);
    const wanderY = 0.55 + 0.28 * Math.cos(clock / 53 + phase[4]);
    const lk = 1 - Math.exp(-dt / 1.2);
    light = [lerp(light[0], wanderX, lk), lerp(light[1], wanderY, lk)];

    // The lamp trails the cursor slightly and fades when the cursor leaves.
    if (pointer) {
      if (lamp[2] < 0.01) { lamp[0] = pointer[0]; lamp[1] = pointer[1]; }
      const pk = 1 - Math.exp(-dt / 0.09);
      lamp[0] = lerp(lamp[0], pointer[0], pk);
      lamp[1] = lerp(lamp[1], pointer[1], pk);
    }
    lamp[2] = lerp(lamp[2], pointerInside ? 1 : 0, 1 - Math.exp(-dt / 0.3));
  }

  function draw() {
    if (!cur) return;
    // Slow drift, each setting on its own cycle so the mix never repeats.
    const freq = cur.freq * (1 + 0.10 * Math.sin(clock / 47 + phase[0]));
    const warp = cur.warp * (1 + 0.18 * Math.sin(clock / 71 + phase[1]));
    const contrast = cur.contrast * (1 + 0.10 * Math.sin(clock / 59 + phase[2]));

    // Hand the page's current colour to the stylesheet, so the top bar matches it.
    const rgb = cur.page.map((c) => Math.round(c * 255)).join(', ');
    if (rgb !== pageRgb) {
      pageRgb = rgb;
      document.documentElement.style.setProperty('--bg-rgb', rgb);
      document.documentElement.style.setProperty('--bg', `rgb(${rgb})`);
    }

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, flow);
    gl.uniform2f(U.uSeed, seed[0], seed[1]);
    gl.uniform1f(U.uFreq, freq);
    gl.uniform1f(U.uWarp, warp);
    gl.uniform1f(U.uContrast, contrast);
    gl.uniform1f(U.uLines, cur.lines);
    gl.uniform3fv(U.uBg, cur.page);
    gl.uniform3fv(U.uFg, cur.tint);
    gl.uniform2f(U.uLight, light[0], light[1]);
    gl.uniform3f(U.uLamp, lamp[0] * dpr, (canvas.clientHeight - lamp[1]) * dpr, lamp[2]);
    gl.uniform4f(U.uLampCfg, LAMP.size, LAMP.glow, LAMP.calm, LAMP.bend);
    gl.uniform2f(U.uColumn, colX, colHalf);
    gl.uniform1f(U.uVeil, TEXT_VEIL);
    gl.uniform2f(U.uStepA, Math.max(1, Math.round(stepA.cell * dpr)), stepA.levels);
    gl.uniform2f(U.uStepB, Math.max(1, Math.round(stepB.cell * dpr)), stepB.levels);
    gl.uniform1f(U.uMix, fading ? smooth(fade) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const elapsed = now - last;
    if (elapsed < FRAME_MS - 1) return;
    last = now;
    advance(Math.min(0.1, elapsed / 1000));
    draw();
  }

  function start() {
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ───────────── Pause, visibility, resize ───────────── */

  function setPaused(value, remember) {
    paused = value;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(paused));
      const text = paused ? 'Play background animation' : 'Pause background animation';
      toggle.setAttribute('aria-label', text);
      toggle.title = paused ? 'Play background' : 'Pause background';
    }
    if (remember) {
      try { localStorage.setItem(STORE_KEY, paused ? '1' : '0'); } catch (e) { /* private mode */ }
    }
    if (paused || document.hidden) { stop(); draw(); } else start();
  }

  let stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  measure();
  advance(0);
  draw();
  setPaused(stored === null ? reduced : stored === '1', false);

  if (toggle) toggle.addEventListener('click', () => setPaused(!paused, true));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (!paused) start();
  });

  const relayout = () => { measure(); if (paused) draw(); };
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.body);

  // While paused nothing is animating, so the lamp is redrawn directly.
  let lampQueued = false;
  function redrawPausedLamp() {
    if (!paused || lampQueued) return;
    lampQueued = true;
    requestAnimationFrame(() => {
      lampQueued = false;
      if (!paused) return;
      if (pointer) { lamp[0] = pointer[0]; lamp[1] = pointer[1]; }
      lamp[2] = pointerInside ? 1 : 0;
      draw();
    });
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = [e.clientX, e.clientY];
    pointerInside = true;
    redrawPausedLamp();
  }, { passive: true });

  const pointerGone = () => { pointerInside = false; redrawPausedLamp(); };
  document.documentElement.addEventListener('pointerleave', pointerGone);
  window.addEventListener('blur', pointerGone);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
})();
