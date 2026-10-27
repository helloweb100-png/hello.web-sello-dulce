'use strict';

/* ════════════════════════════════════════════════════════════
   SELLO DULCE | Impresiones que se comen
   Arquitectura de movimiento:
   - Un solo bucle rAF ("motor") lee el scroll una vez por cuadro y lo suaviza
     con un lerp independiente del framerate. Todos los módulos consumen ese valor,
     así el movimiento se siente lento y continuo en toda la página.
   - Los módulos solo escriben transform / opacity / variables CSS.
   - Todo respeta prefers-reduced-motion (las secciones fijadas pasan a diseño estático).
   ════════════════════════════════════════════════════════════ */
(() => {

/* ───────── CONFIGURACION (EDITAR AQUI) ───────── */
const SELLO = {
  nombre: 'Sello Dulce',
  /* Numero de WhatsApp en formato internacional sin "+" ni espacios. Ej. Mexico: '5213312345678'.
     PENDIENTE: colocar el numero real del cliente. Vacio = WhatsApp deja elegir el contacto. */
  whatsapp: '',
  /* Tramo del video que se reproduce en bucle (segundos) y sus subtitulos */
  video: { start: 62, end: 90.6 },
  captions: [
    [62, 'Colocamos la pieza en la bandeja'],
    [79, 'Cargamos tu imagen'],
    [84, 'La impresora la dibuja con tinta comestible'],
    [88, 'Lista para sorprender']
  ]
};

/* ───────── UTILIDADES ───────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIO  = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const absTop = el => el.getBoundingClientRect().top + window.scrollY;
const watch = (el, cb, opts) => {
  if (!el) return;
  new IntersectionObserver(([e]) => cb(e.isIntersecting, e), opts || {}).observe(el);
};
if (reduce) html.classList.add('reduce');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ───────── MOTOR DE SCROLL ───────── */
const E = { y: 0, sy: 0, vy: 0, dir: 1, vw: innerWidth, vh: innerHeight };
const frameFns = [];
const modules = [];           // { apply?, read? } para medir layout
let lastY = window.scrollY, lastT = performance.now();
E.y = E.sy = lastY;

function loop(now) {
  const dt = Math.min(64, now - lastT); lastT = now;
  E.y = window.scrollY;
  const prev = E.sy;
  E.sy += (E.y - E.sy) * (reduce ? 1 : 1 - Math.exp(-dt / 115));
  if (Math.abs(E.y - E.sy) < .05) E.sy = E.y;
  E.vy = E.sy - prev;
  if (Math.abs(E.y - lastY) > .5) { E.dir = E.y > lastY ? 1 : -1; lastY = E.y; }
  for (let i = 0; i < frameFns.length; i++) frameFns[i](E, dt, now);
  requestAnimationFrame(loop);
}

let measureQueued = false, lastBodyH = 0, lastVW = innerWidth;
function measure() {
  E.vw = innerWidth; E.vh = innerHeight;
  modules.forEach(m => m.apply && m.apply());
  void document.body.offsetHeight;            // fuerza reflow tras activar los modos "pinned"
  modules.forEach(m => m.read && m.read());
}
function queueMeasure() {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(() => { measureQueued = false; measure(); lastBodyH = document.body.offsetHeight; });
}
addEventListener('resize', () => {
  const dw = Math.abs(innerWidth - lastVW);
  lastVW = innerWidth;
  /* En movil, la barra del navegador cambia solo el alto: no re-medimos por eso */
  if (!fine && dw < 2) { E.vh = innerHeight; return; }
  queueMeasure();
}, { passive: true });
if ('ResizeObserver' in window) {
  new ResizeObserver(() => { if (Math.abs(document.body.offsetHeight - lastBodyH) > 2) queueMeasure(); }).observe(document.body);
}

/* ───────── WHATSAPP ───────── */
const waURL = txt => 'https://wa.me/' + SELLO.whatsapp + '?text=' + encodeURIComponent(txt);
function initWhatsApp() {
  $$('[data-wa]').forEach(a => {
    a.href = waURL(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  if (!SELLO.whatsapp) console.warn('[Sello Dulce] Falta el numero de WhatsApp: edita SELLO.whatsapp en script.js');
}

/* ───────── TEXTO: dividir en palabras ───────── */
function transformWords(el, make) {
  let n = 0, lastWord = null;
  const walk = (node, ctx) => {
    const frag = document.createDocumentFragment();
    node.childNodes.forEach(c => {
      if (c.nodeType === 3) {
        c.textContent.split(/(\s+)/).forEach((tok, k) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          /* puntuacion pegada al final de un elemento previo (ej. "</em>.") se une a su palabra */
          if (k === 0 && lastWord && /^[.,;:!?)]/.test(tok)) { (lastWord.querySelector('.wi') || lastWord).textContent += tok; return; }
          lastWord = make(tok, n++, ctx);
          frag.appendChild(lastWord);
        });
      } else if (c.nodeType === 1) {
        const clone = c.cloneNode(false);
        clone.appendChild(walk(c, { hl: ctx.hl || c.tagName === 'EM' }));
        frag.appendChild(clone);
      }
    });
    return frag;
  };
  const f = walk(el, { hl: false });
  el.textContent = '';
  el.appendChild(f);
  return n;
}
function initSplit() {
  $$('[data-split]').forEach(el => {
    transformWords(el, (word, i) => {
      const w = document.createElement('span'); w.className = 'w';
      const wi = document.createElement('span'); wi.className = 'wi';
      wi.style.setProperty('--wi', i); wi.textContent = word;
      w.appendChild(wi); return w;
    });
  });
  const big = $('[data-letters]');
  if (big) {
    const txt = big.textContent; big.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch' + (i > 5 ? ' b' : ''); s.style.setProperty('--ci', i);
      s.textContent = ch === ' ' ? ' ' : ch; s.setAttribute('aria-hidden', 'true');
      big.appendChild(s);
    });
  }
}

/* ───────── REVEAL por scroll ───────── */
function initReveal() {
  const targets = $$('.rv, [data-split], [data-letters]');
  if (!('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(t => io.observe(t));
}

/* ───────── LOADER ───────── */
function initLoader() {
  const ld = $('#loader');
  const done = () => { html.classList.remove('is-loading'); html.classList.add('is-ready'); queueMeasure(); };
  if (!ld) { done(); return; }
  window.scrollTo(0, 0);
  const num = $('#loaderNum'), seal = $('.seal', ld), bars = $$('.loader__bar i', ld);
  const MIN = reduce ? 500 : 2500, MAX = 7000, t0 = performance.now();
  let ok = false, p = 0, finishing = false;
  const pageReady = new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  Promise.all([pageReady, fontsReady]).then(() => { ok = true; });

  (function step(now) {
    const el = now - t0;
    const target = ((ok && el >= MIN) || el > MAX) ? 1 : Math.min(.92, (el / MIN) * .92);
    p += (target - p) * (target === 1 ? .14 : .07);
    if (target === 1 && p > .996) p = 1;
    ld.style.setProperty('--p', p.toFixed(4));
    num.textContent = Math.round(p * 100);
    bars.forEach((b, i) => b.style.setProperty('--k', clamp(p * 4 - i).toFixed(3)));
    if (p < 1) { requestAnimationFrame(step); return; }
    if (finishing) return; finishing = true;
    seal.classList.add('is-stamp');                 // el sello "estampa" al llegar a 100
    setTimeout(() => {
      ld.classList.add('is-out');                   // cortina que se abre
      window.scrollTo(0, 0);
      done();
      setTimeout(() => ld.remove(), 1500);
    }, 720);
  })(performance.now());
}

/* ───────── NAV + PROGRESO + MENU ───────── */
function initNav() {
  const nav = $('#nav'), bar = $('#progress');
  let stuck = false, docH = 1;
  modules.push({ read() { docH = Math.max(1, document.documentElement.scrollHeight - E.vh); } });
  frameFns.push(() => {
    const s = E.y > 40;
    if (s !== stuck) { stuck = s; nav.classList.toggle('is-stuck', s); }
    bar.style.transform = 'scaleX(' + clamp(E.y / docH).toFixed(4) + ')';
  });

  /* enlace activo segun la seccion visible */
  const map = {};
  $$('.nav__links a').forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
  Object.keys(map).forEach(id => {
    watch($('#' + id), on => {
      if (on) { Object.values(map).forEach(a => a.removeAttribute('aria-current')); map[id].setAttribute('aria-current', 'true'); }
      else map[id].removeAttribute('aria-current');
    }, { rootMargin: '-45% 0px -45% 0px' });
  });

  const burger = $('#burger'), menu = $('#menu');
  const setMenu = open => {
    html.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', !open);
    if (menu.toggleAttribute) menu.toggleAttribute('inert', !open);
  };
  setMenu(false);
  burger.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* scroll suave a anclas internas */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' || id === '#' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    const y = target === document.body ? 0 : absTop(target);
    setTimeout(() => window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }), html.classList.contains('menu-open') ? 400 : 0);
  });
}

/* ───────── HERO: palabra que cambia ───────── */
function initCycle() {
  const el = $('#cycle');
  if (!el || reduce) return;
  const words = ['galletas', 'donas', 'malvaviscos', 'cupcakes', 'paletas'];
  let i = 0;
  setInterval(() => {
    if (document.hidden || !html.classList.contains('is-ready')) return;
    i = (i + 1) % words.length;
    el.style.transform = 'translateY(-55%)'; el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = words[i];
      el.style.transition = 'none'; el.style.transform = 'translateY(55%)';
      void el.offsetHeight;
      el.style.transition = ''; el.style.transform = 'none'; el.style.opacity = '1';
    }, 420);
  }, 2600);
}

/* ───────── HERO: grageas (canvas) ───────── */
function initSprinkles() {
  const cv = $('#sprinkles'), hero = $('#top');
  if (!cv || reduce) return;
  const ctx = cv.getContext('2d');
  const COL = ['#D8196D', '#FF8DBB', '#4CC3F0', '#FFD43B', '#FFB3D1', '#7BD8F5'];
  let W = 0, H = 0, list = [], vis = true, px = -999, py = -999;
  const make = (initial) => ({
    x: Math.random() * W, y: initial ? Math.random() * H : -24,
    l: 10 + Math.random() * 14, th: 4 + Math.random() * 2.6,
    r: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * .0016,
    vy: .014 + Math.random() * .034, ph: Math.random() * 6.28,
    c: COL[(Math.random() * COL.length) | 0], a: .5 + Math.random() * .45
  });
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(clamp(W * H / 17000, 16, W < 700 ? 26 : 62));
    list = Array.from({ length: n }, () => make(true));
  }
  modules.push({ read: size });
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; }, { passive: true });
  hero.addEventListener('pointerleave', () => { px = py = -999; });
  watch(hero, on => { vis = on; });

  frameFns.push((_, dt, t) => {
    if (!vis || document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const s of list) {
      s.y += s.vy * dt;
      s.x += Math.sin(t / 1900 + s.ph) * .012 * dt;
      s.r += s.vr * dt;
      const dx = s.x - px, dy = s.y - py, d2 = dx * dx + dy * dy;
      if (d2 < 16900) {                           // repulsion suave del cursor (130px)
        const d = Math.sqrt(d2) || 1, f = (1 - d / 130) * 3.2;
        s.x += dx / d * f; s.y += dy / d * f;
      }
      if (s.y > H + 24) { Object.assign(s, make(false), { x: Math.random() * W }); }
      const hx = Math.cos(s.r) * (s.l / 2 - s.th / 2), hy = Math.sin(s.r) * (s.l / 2 - s.th / 2);
      ctx.globalAlpha = s.a; ctx.strokeStyle = s.c; ctx.lineWidth = s.th;
      ctx.beginPath(); ctx.moveTo(s.x - hx, s.y - hy); ctx.lineTo(s.x + hx, s.y + hy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/* ───────── HERO: escenario 3D + anillo ───────── */
function initStage() {
  const stage = $('#stage'), hero = $('#top'), ring = $('#ringScroll');
  if (!stage || reduce) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, lastMove = -1e9, vis = true;
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2;
    lastMove = performance.now();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { lastMove = -1e9; });
  watch(hero, on => { vis = on; });
  frameFns.push((e, dt, t) => {
    if (!vis) return;
    const manual = fine && t - lastMove < 2500;
    const gx = manual ? tx : Math.sin(t / 2600) * .55;      // sin puntero, el escenario respira solo
    const gy = manual ? ty : Math.cos(t / 3300) * .45;
    cx += (gx - cx) * .06; cy += (gy - cy) * .06;
    stage.style.setProperty('--mx', cx.toFixed(3));
    stage.style.setProperty('--my', cy.toFixed(3));
    stage.style.setProperty('--rx', (-cy * 5).toFixed(2));
    stage.style.setProperty('--ry', (cx * 7).toFixed(2));
    ring.style.setProperty('--spin', (e.sy * .1).toFixed(2));  // el anillo gira con el scroll
  });
}

/* ───────── FRANJA CINETICA ───────── */
function initStrip() {
  const track = $('#stripTrack'), list = $('#stripList');
  if (!track || !list) return;
  const clone = list.cloneNode(true); clone.removeAttribute('id'); clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('img').forEach(i => { i.loading = 'lazy'; });
  track.appendChild(clone);
  if (reduce) return;
  let x = 0, w = 1, dir = -1, dirTarget = -1, vis = false;
  modules.push({ read() { w = list.getBoundingClientRect().width || 1; } });
  watch(track.parentElement, on => { vis = on; });
  frameFns.push((e, dt) => {
    if (!vis) return;
    if (Math.abs(e.vy) > .6) dirTarget = e.dir > 0 ? -1 : 1;   // al subir, la franja invierte su sentido
    dir += (dirTarget - dir) * .06;
    const speed = .045 * dt + Math.abs(e.vy) * .9;               // base lenta + empuje por velocidad de scroll
    x += speed * dir;
    if (x <= -w) x += w; else if (x > 0) x -= w;
    track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
  });
}

/* ───────── VIDEO que se abre con el scroll ───────── */
function initVideoReveal() {
  const sec = $('#proceso'), win = $('#rvWindow'), video = $('#procesoVideo');
  if (!sec || !win || !video) return;
  const titleEl = $('.rv-title', sec), tl = $('.rv-title__l', sec), tr = $('.rv-title__r', sec);
  const cap = $('#rvCap'), tog = $('#rvToggle');
  const { start, end } = SELLO.video;
  let pinned = false, top = 0, len = 1, vis = false, started = false, userPaused = false, label = '';
  let T0 = 0, B0 = 0, L0 = 0, lastP = -1;

  const play = () => { if (!userPaused) { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); } };
  video.addEventListener('loadedmetadata', () => { if (video.currentTime < start - .5) video.currentTime = start; });

  watch(sec, on => {
    vis = on;
    if (on) {
      if (!started && !reduce) { started = true; video.preload = 'auto'; video.load(); }
      if (!reduce) play();
    } else video.pause();
  }, { rootMargin: '300px 0px' });

  if (reduce) { video.setAttribute('controls', ''); video.removeAttribute('loop'); }

  modules.push({
    apply() { pinned = !reduce; sec.classList.toggle('is-pinned', pinned); if (!pinned) { win.style.removeProperty('--clip'); } },
    read() {
      if (!pinned) return;
      top = absTop(sec); len = Math.max(1, sec.offsetHeight - E.vh);
      const mobile = E.vw < 700;
      const w0 = mobile ? E.vw * .86 : clamp(E.vw * .36, 360, 600);
      const h0 = mobile ? E.vh * .34 : w0 * 9 / 16;
      L0 = (E.vw - w0) / 2;
      T0 = (E.vh - h0) / 2 + E.vh * .05;          // la ventana baja un poco para dejar aire al titular
      B0 = E.vh - T0 - h0;
      lastP = -1;
    }
  });

  frameFns.push(() => {
    /* bucle del tramo elegido */
    if (vis && !video.paused && video.readyState > 1) {
      if (video.currentTime >= end || video.currentTime < start - 1) video.currentTime = start;
      if (pinned) {
        const t = video.currentTime;
        let l = ''; for (const c of SELLO.captions) if (t >= c[0]) l = c[1];
        if (l !== label) { label = l; cap.textContent = l; }
      }
    }
    if (!pinned) return;
    const p = clamp((E.sy - top) / len);
    if (p === lastP) return; lastP = p;
    const t = easeIO(clamp(p / .42));                       // 0 a 42%: se abre; resto: se mantiene
    const L = lerp(L0, 0, t), Tp = lerp(T0, 0, t), Bp = lerp(B0, 0, t);
    const rad = lerp(28, 0, clamp((t - .7) / .3));
    win.style.setProperty('--clip', 'inset(' + Tp.toFixed(1) + 'px ' + L.toFixed(1) + 'px ' + Bp.toFixed(1) + 'px ' + L.toFixed(1) + 'px round ' + rad.toFixed(1) + 'px)');
    win.style.setProperty('--vs', lerp(1.28, 1, t).toFixed(3));
    tl.style.transform = 'translate3d(' + (-t * 62).toFixed(2) + 'vw,0,0)';
    tr.style.transform = 'translate3d(' + (t * 62).toFixed(2) + 'vw,0,0)';
    titleEl.style.opacity = clamp(1 - t * 1.5).toFixed(3);
    const co = clamp((t - .88) / .12);
    sec.style.setProperty('--capo', co.toFixed(3));
    win.style.setProperty('--shade', (co * .75).toFixed(3));
    cap.style.setProperty('--capo', co.toFixed(3));
    sec.classList.toggle('is-open', co > .5);
  });

  tog.addEventListener('click', () => {
    userPaused = !userPaused;
    if (userPaused) video.pause(); else play();
    tog.setAttribute('aria-label', userPaused ? 'Reproducir video' : 'Pausar video');
    tog.firstElementChild.className = userPaused ? 'ph-fill ph-play' : 'ph-fill ph-pause';
  });
}

/* ───────── MANIFIESTO + PARALLAX ───────── */
function initManifesto() {
  const block = $('.mani__text'), sec = $('#manifiesto');
  if (!block || !sec) return;
  const n = transformWords(block, (word, i, ctx) => {
    const s = document.createElement('span'); s.className = 'mw' + (ctx.hl ? ' hl' : ''); s.textContent = word; return s;
  });
  const words = $$('.mw', block);
  const pars = $$('[data-par]', sec);
  let bTop = 0, bH = 1, sTop = 0, sH = 1, vis = false;
  modules.push({ read() { bTop = absTop(block); bH = block.offsetHeight; sTop = absTop(sec); sH = sec.offsetHeight; } });
  watch(sec, on => { vis = on; }, { rootMargin: '100px 0px' });
  if (reduce) { words.forEach(w => w.style.setProperty('--a', 1)); return; }
  words.forEach(w => w.style.setProperty('--a', 0));
  const last = new Array(words.length).fill(-1);
  frameFns.push(e => {
    if (!vis) return;
    const p = clamp((e.sy + e.vh * .84 - bTop) / (bH + e.vh * .36));
    for (let i = 0; i < n; i++) {
      const a = clamp((p * (n + 6) - i) / 4);
      if (Math.abs(a - last[i]) > .01) { last[i] = a; words[i].style.setProperty('--a', a.toFixed(3)); }
    }
    const k = e.vw < 900 ? .35 : 1;               // en movil el parallax es mas corto para no pisar el texto
    pars.forEach(el => {
      const py = (e.sy + e.vh / 2 - (sTop + sH / 2)) * parseFloat(el.dataset.par) * k;
      el.style.setProperty('--py', py.toFixed(1) + 'px');
    });
  });
}

/* ───────── SUPERFICIES: scroll horizontal ───────── */
function initPan() {
  const sec = $('#superficies'), track = $('#panTrack');
  if (!sec || !track) return;
  let on = false, top = 0, dist = 1, lastP = -1;
  modules.push({
    apply() {
      on = !reduce && E.vw >= 960;
      sec.classList.toggle('is-pinned', on);
      track.style.transform = '';
      sec.style.height = '';
      if (on) { void sec.offsetHeight; dist = Math.max(1, track.scrollWidth - E.vw); sec.style.height = (dist + E.vh) + 'px'; }
    },
    read() { if (on) { top = absTop(sec); lastP = -1; } }
  });
  frameFns.push(e => {
    if (!on) return;
    const p = clamp((e.sy - top) / dist);
    if (p === lastP) return; lastP = p;
    track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
  });
}

/* ───────── BENTO: foco que sigue al cursor ───────── */
function initSpot() {
  if (!fine) return;
  $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true }));
}

/* ───────── PASOS: tarjetas que se apilan ───────── */
function initSteps() {
  const cards = $$('.step');
  if (cards.length < 2 || reduce) return;
  let vis = false;
  watch($('#stack'), on => { vis = on; }, { rootMargin: '200px 0px' });
  frameFns.push(e => {
    if (!vis) return;
    for (let i = 0; i < cards.length - 1; i++) {
      const nextTop = cards[i + 1].getBoundingClientRect().top;
      const stick = 74 + 14 + (i + 1) * 16;
      const q = clamp(1 - (nextTop - stick) / (e.vh - stick));
      cards[i].style.transform = 'translate3d(0,' + (-q * 10).toFixed(1) + 'px,0) scale(' + (1 - q * .06).toFixed(4) + ')';
    }
  });
}

/* ───────── GALERIA: zoom parallax ───────── */
function initZoom() {
  const sec = $('#galeria'), stage = $('#zoomStage');
  if (!sec || !stage) return;
  const items = $$('.zoom__item', stage), head = $('.zoom__head', sec);
  let on = false, top = 0, len = 1, lastP = -1;
  modules.push({
    apply() {
      on = !reduce;
      sec.classList.toggle('is-pinned', on);
      if (!on) items.forEach(i => { i.style.transform = ''; });
    },
    read() {
      if (!on) return;
      top = absTop(sec) + head.offsetHeight;
      len = Math.max(1, sec.offsetHeight - head.offsetHeight - E.vh);
      lastP = -1;
    }
  });
  frameFns.push(e => {
    if (!on) return;
    const p = clamp((e.sy - top) / len);
    if (p === lastP) return; lastP = p;
    const vr = 28 * (1 - clamp((p - .72) / .28));
    items.forEach(it => {
      const s = lerp(1, parseFloat(it.dataset.scale), p);
      it.style.transform = 'scale(' + s.toFixed(4) + ')';
      it.style.setProperty('--rad', (vr / s).toFixed(2) + 'px');
    });
    const eo = clamp((p - .8) / .16);
    stage.style.setProperty('--eo', eo.toFixed(3));
    sec.classList.toggle('is-end', eo > .5);
  });
}

/* ───────── OCASIONES: acordeon ───────── */
function initOccasions() {
  const items = $$('#occList .occ__item');
  const open = it => items.forEach(o => {
    const on = o === it;
    o.classList.toggle('is-open', on);
    $('.occ__btn', o).setAttribute('aria-expanded', on);
  });
  items.forEach(it => {
    $('.occ__btn', it).addEventListener('click', () => open(it));
    if (fine) it.addEventListener('mouseenter', () => open(it));
  });
}

/* ───────── BOTONES MAGNETICOS ───────── */
function initMagnetic() {
  if (!fine || reduce) return;
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.transform = 'translate3d(' + ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .32).toFixed(1) + 'px,0)';
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ───────── FORMULARIO -> WHATSAPP ───────── */
function initForm() {
  const form = $('#cForm'); if (!form) return;
  const status = $('#formStatus'), toast = $('#toast');
  const fecha = $('#f-fecha');
  if (fecha) fecha.min = new Date().toISOString().slice(0, 10);

  const setErr = (field, id, msg) => {
    const box = field.closest('.field'); const out = $('#' + id);
    box.classList.toggle('has-error', !!msg); out.textContent = msg || '';
  };
  form.addEventListener('input', e => {
    const f = e.target.closest('.field'); if (!f) return;
    f.classList.remove('has-error'); const er = $('.field__err', f); if (er) er.textContent = '';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const nombre = (d.get('nombre') || '').trim(), sup = d.get('superficie'), idea = (d.get('idea') || '').trim();
    let first = null;
    const bad = (el, id, msg) => { setErr(el, id, msg); if (!first) first = el; };
    setErr($('#f-nombre'), 'e-nombre', ''); setErr($('#chips'), 'e-superficie', ''); setErr($('#f-idea'), 'e-idea', '');
    if (nombre.length < 2) bad($('#f-nombre'), 'e-nombre', 'Escribe tu nombre para saber con quién hablamos.');
    if (!sup) bad($('#chips'), 'e-superficie', 'Elige qué quieres imprimir.');
    if (idea.length < 8) bad($('#f-idea'), 'e-idea', 'Cuéntanos un poco más de tu idea (mínimo una frase corta).');
    if (first) { (first.id === 'chips' ? $('input[name="superficie"]', form) : first).focus(); status.textContent = ''; return; }

    const lines = [
      '*Solicitud de cotización | ' + SELLO.nombre + '*', '',
      'Nombre: ' + nombre,
      'Quiero imprimir en: ' + sup,
      'Cantidad aproximada: ' + (d.get('cantidad') || 'Por definir')
    ];
    if (d.get('fecha')) lines.push('Fecha del evento o entrega: ' + d.get('fecha'));
    lines.push('Mi idea: ' + idea, '', 'Te envío mi imagen en este chat.');
    const url = waURL(lines.join('\n'));
    const w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
    status.textContent = 'Listo, abrimos WhatsApp con tu mensaje.';
    toast.textContent = 'Abriendo WhatsApp con tu idea';
    toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3600);
    form.reset();
  });
}

/* ───────── WHATSAPP FLOTANTE: etiqueta temporal ───────── */
function initWaTip() {
  const wa = $('#wa'); if (!wa) return;
  setTimeout(() => { wa.classList.add('is-tip'); setTimeout(() => wa.classList.remove('is-tip'), 5200); }, 7000);
}

/* ───────── ARRANQUE ───────── */
function boot() {
  initWhatsApp();
  initSplit();
  initReveal();
  initNav();
  initCycle();
  initSprinkles();
  initStage();
  initStrip();
  initVideoReveal();
  initManifesto();
  initPan();
  initSpot();
  initSteps();
  initZoom();
  initOccasions();
  initMagnetic();
  initForm();
  initWaTip();
  measure(); lastBodyH = document.body.offsetHeight;
  addEventListener('load', queueMeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);
  requestAnimationFrame(loop);
  initLoader();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
