/* Ripen — all motion and interaction for the site. No framework; GSAP/ScrollTrigger/Lenis are optional upgrades. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ---------- the ripeness curve: 1x at buy, 12x at 21 days, fastest in the first week */
  const MAXD = 21, MAXM = 12, K = 6;
  const mult = d => 1 + (MAXM - 1) * (1 - Math.exp(-Math.min(Math.max(d, 0), MAXD) / K)) / (1 - Math.exp(-MAXD / K));
  const frac = m => (m - 1) / (MAXM - 1);
  const fmtDays = d => d < 1 / 24 ? 'bought just now' : d < 1 ? `held ${Math.round(d * 24)} h` : `held ${d < 10 ? d.toFixed(1) : Math.round(d)} days`;

  /* ---------- toast */
  const toastEl = $('[data-toast]');
  const toast = msg => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2600); };
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => toast('The contract address goes live with the first launch.')));
  $$('[data-soon]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('Socials open at launch.'); }));

  /* ---------- smooth scroll */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href'); if (id.length < 2) return;
      const t = $(id); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: -10, duration: 1.4 });
    }));
  }

  /* ---------- split headings into words that rise */
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="w"><span style="transition-delay:${(i * .06).toFixed(2)}s">${w}</span></span>`).join(' ');
    el.classList.add('split');
  });

  /* ---------- reveal on view; elements also get a 'reveal' event the first time they show */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); e.target.dispatchEvent(new Event('reveal')); io.unobserve(e.target);
  }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  $$('.rv,.split').forEach(el => io.observe(el));

  /* ---------- hero headline: lines rise from below the mask */
  const hl = $$('[data-hl]');
  if (hl.length) {
    if (window.gsap && !reduced) gsap.fromTo(hl, { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: .12, delay: .25 });
  }

  /* ---------- dock: highlight the section in view */
  const navs = $$('.dock a.nav');
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    navs.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { threshold: .35 });
  navs.forEach(a => { const t = $(a.getAttribute('href')); if (t) secIO.observe(t); });

  /* visibility helper so loops only run when seen */
  const visible = new Set();
  const vio = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
  const on = el => visible.has(el) && !document.hidden;

  /* =================================================================
     HERO: a row of tiles streaming round the inside of a cylinder.
     Each tile is cut into vertical strips, each strip a flat facet of
     the arc; one rotateY carries the whole tile along the curve.
     ================================================================= */
  (() => {
    const host = $('[data-curve]');
    if (!host) return;
    const IMAGES = Array.from({ length: 8 }, (_, i) => `/art/tile-${i + 1}.svg`);
    IMAGES.forEach(s => { new Image().src = s; });
    const SLICES = 14, CAMERA = 1.6; let MAX_W = 55;
    const tileHeight = 62, aspect = 16 / 9, gap = 7, axis = 50, bendDeg = 72, fade = 10, speed = 3.6;
    const bend = bendDeg * Math.PI / 180;
    const arc = b => (CAMERA - 1 + Math.cos(b)) / (2 * CAMERA * Math.sin(b));
    const id = 'c' + Math.random().toString(36).slice(2, 7);
    const style = document.createElement('style'); document.head.appendChild(style);
    const band = document.createElement('div'); band.className = 'band'; band.style.opacity = 0; host.appendChild(band);
    let last = '';

    function measure(width, height) {
      const h = Math.min(tileHeight / 100 * height, MAX_W / 100 * width / aspect);
      const radius = width * arc(bend);
      const deg = r => r * 180 / Math.PI;
      const unit = deg(h / radius);
      const pitch = (aspect + gap / 100) * unit;
      const limit = deg(bend) + aspect * unit / 2;
      const columns = Math.min(40, Math.max(2, Math.ceil(2 * limit / pitch)));
      const sweep = +(columns * pitch / 2).toFixed(4);
      return { columns, sweep, unit: +unit.toFixed(4), limit: +Math.min(sweep, limit).toFixed(4) };
    }

    function build() {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      MAX_W = width < 700 ? 84 : 55;
      const L = measure(width, height);
      const key = `${L.columns}|${L.sweep}|${L.unit}`;
      if (key === last) return; last = key;
      const u = n => `calc(${+n.toFixed(4)} * min(${tileHeight}cqh, ${+(MAX_W / aspect).toFixed(4)}cqw))`;
      const r = 100 * arc(bend), radius = `${+r.toFixed(3)}cqw`;
      const turn = d => `translateZ(${radius}) rotateY(${+d.toFixed(4)}deg) translateZ(-${radius})`;
      const hide = +((L.sweep - L.limit) / (2 * L.sweep || 1) * 100).toFixed(4);
      style.textContent = `@keyframes ${id}{from{transform:${turn(-L.sweep)}}to{transform:${turn(L.sweep)}}` +
        `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}${hide + .001}%,${100 - hide - .001}%{visibility:visible}}` +
        `@media(prefers-reduced-motion:reduce){.${id}{animation-play-state:paused}}`;
      const share = aspect / SLICES, duration = L.columns * speed;
      const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${100 - fade}%,transparent)`;
      Object.assign(band.style, { perspective: `${+(r * CAMERA).toFixed(3)}cqw`, perspectiveOrigin: `50% ${axis}%`, maskImage: mask, webkitMaskImage: mask });
      band.innerHTML = '';
      for (let t = 0; t < L.columns; t++) {
        const first = L.columns - 1 - t;
        const tile = document.createElement('div');
        tile.className = id;
        Object.assign(tile.style, {
          position: 'absolute', left: `calc(50% - ${u(aspect / 2)})`, top: `calc(${axis}% - ${u(.5)})`,
          width: u(aspect), height: u(1), transformStyle: 'preserve-3d',
          animation: `${id} ${duration}s linear ${-t * speed}s infinite`
        });
        const imgs = [];
        for (let k = 0; k < SLICES; k++) {
          const s = document.createElement('div'); s.className = 'strip';
          if (k === 0) s.style.borderRadius = '14px 0 0 14px';
          if (k === SLICES - 1) s.style.borderRadius = '0 14px 14px 0';
          Object.assign(s.style, { left: u((aspect - share) / 2), width: k === SLICES - 1 ? u(share) : `calc(${u(share)} + 1px)`, height: u(1), transform: turn((aspect / 2 - (k + .5) * share) * L.unit) });
          const img = document.createElement('img'); img.alt = ''; img.draggable = false; img.decoding = 'async';
          Object.assign(img.style, { left: u(-k * share), width: u(aspect), height: u(1) });
          img.src = IMAGES[first % IMAGES.length];
          s.appendChild(img); tile.appendChild(s); imgs.push(img);
        }
        // hand the tile its next image each lap, while it is out of sight
        tile.addEventListener('animationiteration', e => {
          const lap = Math.round(e.elapsedTime / duration);
          const src = IMAGES[(lap * L.columns + first) % IMAGES.length];
          imgs.forEach(i => { i.src = src; });
        });
        band.appendChild(tile);
      }
      requestAnimationFrame(() => { band.style.opacity = 1; });
    }
    const ro = new ResizeObserver(() => { clearTimeout(build.t); build.t = setTimeout(build, 80); });
    ro.observe(host);
    build();
    // the row drifts up a little as the page scrolls away
    if (window.gsap && window.ScrollTrigger && !reduced) {
      gsap.to(host, { yPercent: -12, scale: .94, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
  })();

  /* =================================================================
     PRESS AND HOLD DIAL
     ================================================================= */
  (() => {
    const box = $('[data-dial]'), svg = $('[data-dialsvg]'), core = $('[data-core]');
    if (!box) return;
    const dm = $('[data-dm]'), ds = $('[data-ds]');
    const C = 235, R = 196, CIRC = 2 * Math.PI * R, N = 84;
    let ticks = '';
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 - Math.PI / 2, big = i % 7 === 0;
      const r1 = 212, r2 = big ? 228 : 221;
      ticks += `<line class="tk${big ? ' big' : ''}" x1="${(C + Math.cos(a) * r1).toFixed(1)}" y1="${(C + Math.sin(a) * r1).toFixed(1)}" x2="${(C + Math.cos(a) * r2).toFixed(1)}" y2="${(C + Math.sin(a) * r2).toFixed(1)}"/>`;
    }
    const lbl = [[1, '1 day'], [7, '1 week'], [21, 'ripe']].map(([d, t]) => {
      const f = Math.min(.985, frac(mult(d))), a = f * Math.PI * 2 - Math.PI / 2, r = 248;
      return `<text class="lbl" x="${(C + Math.cos(a) * r).toFixed(1)}" y="${(C + Math.sin(a) * r + 4).toFixed(1)}" text-anchor="${Math.cos(a) > .2 ? 'start' : Math.cos(a) < -.2 ? 'end' : 'middle'}">${t}</text>`;
    }).join('');
    svg.innerHTML = `<g>${ticks}</g>${lbl}
      <circle class="arc-bg" cx="${C}" cy="${C}" r="${R}" fill="none" stroke-width="12"/>
      <circle class="arc" cx="${C}" cy="${C}" r="${R}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}" transform="rotate(-90 ${C} ${C})" data-arc/>
      <circle r="11" fill="#FBF8F2" stroke="#2C1C30" stroke-width="4" data-knob/>`;
    const arcEl = $('[data-arc]', svg), knob = $('[data-knob]', svg), tks = $$('.tk', svg);
    let d = 0, down = false, last = 0, soldAt = 0, lit = -1, mile = 0;
    const RATE = 2;
    const press = () => { if (down) return; down = true; box.classList.add('down'); mile = 0; };
    const release = () => { if (!down) return; down = false; box.classList.remove('down'); if (d > .3) soldAt = performance.now(); };
    core.addEventListener('pointerdown', e => { e.preventDefault(); core.setPointerCapture && core.setPointerCapture(e.pointerId); press(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(k => core.addEventListener(k, release));
    core.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
    core.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') release(); });
    core.addEventListener('contextmenu', e => e.preventDefault());
    function paint() {
      const m = mult(d), f = frac(m);
      arcEl.style.strokeDashoffset = (CIRC * (1 - f)).toFixed(1);
      const a = f * Math.PI * 2 - Math.PI / 2;
      knob.setAttribute('cx', (C + Math.cos(a) * R).toFixed(1)); knob.setAttribute('cy', (C + Math.sin(a) * R).toFixed(1));
      const l = Math.round(f * N);
      if (l !== lit) { tks.forEach((t, i) => t.classList.toggle('lit', i < l)); lit = l; }
      dm.textContent = m.toFixed(2);
      core.style.setProperty('--g', f.toFixed(3));
    }
    function tick(t) {
      requestAnimationFrame(tick);
      const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
      if (down) {
        d = Math.min(30, d + dt * RATE * (reduced ? 4 : 1));
        ds.textContent = d >= MAXD ? 'fully ripe' : fmtDays(d);
        for (const [k, day] of [[1, 1], [2, 7], [3, 21]]) if (d >= day && mile < k) { mile = k; navigator.vibrate && navigator.vibrate(8); }
        paint();
      } else if (d > 0) {
        d = Math.max(0, d - dt * Math.max(6, d * 3));
        ds.textContent = 'sold: the clock starts over';
        paint();
      } else if (soldAt && t - soldAt > 2200) { soldAt = 0; ds.textContent = 'bought just now'; }
    }
    paint(); requestAnimationFrame(tick);
  })();

  /* =================================================================
     RIPENESS CHART
     ================================================================= */
  (() => {
    const box = $('[data-chart]'), svg = $('[data-csvg]');
    if (!box) return;
    vio.observe(box);
    let W = 0, H = 0, path, drawn = false, hover = null;
    const X = d => 34 + (W - 68) * (d / MAXD);
    const B = () => H - 56;
    const Y = m => B() - (B() - 150) * frac(m);
    function build() {
      W = box.clientWidth; H = box.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const pts = [];
      for (let i = 0; i <= 220; i++) { const d = MAXD * i / 220; pts.push([X(d), Y(mult(d))]); }
      const line = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
      const area = line + ` L${X(MAXD).toFixed(1)} ${B()} L${X(0)} ${B()} Z`;
      const marks = [[1, '1 day'], [7, '1 week'], [14, '2 weeks'], [21, '21 days']];
      svg.innerHTML = `<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8782A" stop-opacity=".32"/><stop offset="1" stop-color="#E8782A" stop-opacity="0"/></linearGradient></defs>
        <line x1="34" x2="${W - 34}" y1="${B()}" y2="${B()}" stroke="#2C1C30" stroke-opacity=".35" stroke-width="1.2"/>
        ${[3, 6, 9, 12].map(m => `<line class="gl" x1="34" x2="${W - 34}" y1="${Y(m)}" y2="${Y(m)}"/><text class="gt" x="${W - 36}" y="${Y(m) - 8}" text-anchor="end">${m}x</text>`).join('')}
        ${marks.map(([d, t]) => `<line x1="${X(d)}" x2="${X(d)}" y1="${B() - 6}" y2="${B() + 6}" stroke="#2C1C30" stroke-opacity=".35"/><text class="gt" x="${X(d)}" y="${B() + 26}" text-anchor="${d === 21 ? 'end' : 'middle'}">${t}</text>`).join('')}
        <path d="${area}" fill="url(#cg)" data-area opacity="${drawn ? 1 : 0}"/>
        <path d="${line}" fill="none" stroke="#2C1C30" stroke-width="3.4" stroke-linecap="round" data-line/>
        <line data-gx stroke="#2C1C30" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>
        <circle r="9" fill="#E8782A" stroke="#2C1C30" stroke-width="3.5" data-dot/>`;
      path = $('[data-line]', svg);
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = drawn ? 0 : len;
    }
    build();
    addEventListener('resize', () => { clearTimeout(build.t); build.t = setTimeout(build, 120); });
    const draw = () => {
      if (drawn) return; drawn = true;
      path.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(.16,1,.3,1) .2s';
      requestAnimationFrame(() => { path.style.strokeDashoffset = 0; const a = $('[data-area]', svg); a.style.transition = 'opacity 1.6s .9s'; a.setAttribute('opacity', 1); });
    };
    box.addEventListener('reveal', draw);
    setTimeout(() => { if (root.classList.contains('rv-all')) draw(); }, 4200);
    const toDays = x => Math.max(0, Math.min(MAXD, (x - 34) / (W - 68) * MAXD));
    box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); hover = toDays(e.clientX - r.left); });
    box.addEventListener('pointerleave', () => { hover = null; });
    const cm = $('[data-cm]'), ct = $('[data-ct]');
    const t0 = performance.now(), LOOP = 9000;
    let shown = 0;
    function tick(t) {
      requestAnimationFrame(tick);
      if (!on(box) || !drawn) return;
      let target;
      if (hover != null) target = hover;
      else { let k = ((t - t0 - 2400) % LOOP) / LOOP; if (k < 0) k = 0; const e = k < .86 ? k / .86 : 1; target = MAXD * (1 - Math.pow(1 - e, 2.2)) * (k < .97 ? 1 : 0); }
      shown += (target - shown) * (hover != null ? .25 : 1);
      const m = mult(shown), x = X(shown), y = Y(m);
      const dot = $('[data-dot]', svg); dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      const g = $('[data-gx]', svg); g.setAttribute('x1', x); g.setAttribute('x2', x); g.setAttribute('y1', y + 11); g.setAttribute('y2', B());
      cm.textContent = m.toFixed(2);
      ct.textContent = shown >= MAXD - .05 ? 'fully ripe' : fmtDays(shown);
    }
    requestAnimationFrame(tick);
  })();

  /* =================================================================
     PATIENCE BEATS SIZE
     ================================================================= */
  (() => {
    const box = $('[data-duel]');
    if (!box) return;
    vio.observe(box);
    const sa = $('[data-sa]'), sb = $('[data-sb]');
    const t0 = performance.now(), LOOP = 9000, MAX = 18, B = 6;
    let last = -1;
    function tick(t) {
      requestAnimationFrame(tick);
      if (!on(box)) return;
      const k = ((t - t0) % LOOP) / LOOP, e = k < .8 ? k / .8 : 1;
      const d = MAX * (e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2);
      if (Math.abs(d - last) < .01) return;
      last = d;
      const ma = mult(d), pa = ma / (ma + B);
      sa.style.width = (pa * 100).toFixed(2) + '%';
      sb.style.width = ((1 - pa) * 100).toFixed(2) + '%';
      $('[data-pa]').textContent = Math.round(pa * 100) + '%';
      $('[data-pb]').textContent = Math.round((1 - pa) * 100) + '%';
      $('[data-ma]').textContent = ma.toFixed(2) + 'x';
      $('[data-ha]').textContent = d < 1 / 24 ? 'held 0 days' : fmtDays(d);
      $('[data-sl]').textContent = `after A has held ${Math.round(d)} days`;
    }
    requestAnimationFrame(tick);
  })();

  /* =================================================================
     TILES: payout cadence + selling picks it early
     ================================================================= */
  (() => {
    const tile = $('[data-tile="round"]'); if (!tile) return;
    vio.observe(tile);
    const bar = $('[data-rbar]');
    // no live engine yet: show the cadence as a filling bar, never a fake countdown
    let k = 0, last = 0;
    (function tick(t) {
      requestAnimationFrame(tick);
      if (!on(tile)) { last = 0; return; }
      const dt = last ? (t - last) / 1000 : 0; last = t;
      k = (k + dt / 6) % 1;
      bar.style.width = (k * 100).toFixed(1) + '%';
    })(0);
  })();
  (() => {
    const tile = $('[data-tile="sell"]'); if (!tile) return;
    vio.observe(tile);
    const basket = $('[data-basket]');
    basket.innerHTML = '<i></i>'.repeat(10);
    const fruit = $$('i', basket);
    const sc = $('[data-sc]'), sm = $('[data-sm]'), sn = $('[data-sn]');
    const show = d => { sc.textContent = d < 1 ? Math.round(d * 24) + ' h' : (d < 10 ? d.toFixed(1) : Math.round(d)) + ' days'; sm.textContent = mult(d).toFixed(2) + 'x'; };
    let phase = 0, d = 0, t0 = 0;
    function tick(t) {
      requestAnimationFrame(tick);
      if (!on(tile)) { t0 = 0; return; }
      if (!t0) t0 = t;
      const el = t - t0;
      if (phase === 0) { d = 14 * Math.min(1, el / 3200); show(d); sn.textContent = 'Holding the whole bag'; if (el > 3800) { phase = 1; t0 = t; fruit.slice(5).forEach((b, i) => setTimeout(() => b.classList.add('gone'), i * 70)); } }
      else if (phase === 1) { const q = Math.min(1, el / 900); d = 14 - 7 * (1 - Math.pow(1 - q, 3)); show(d); sn.textContent = 'Sold half: half the ripeness leaves with it'; if (el > 2600) { phase = 2; t0 = t; } }
      else if (phase === 2) { d = 7 + 3 * Math.min(1, el / 1600); show(d); sn.textContent = 'The rest keeps ripening'; if (el > 2200) { phase = 3; t0 = t; fruit.slice(0, 5).forEach((b, i) => setTimeout(() => b.classList.add('gone'), i * 70)); } }
      else if (phase === 3) { const q = Math.min(1, el / 900); d = 10 * Math.pow(1 - q, 3); show(d); sn.textContent = 'Sold everything: the clock starts over'; if (el > 2600) { phase = 4; t0 = t; } }
      else if (el > 400) { fruit.forEach((b, i) => setTimeout(() => b.classList.remove('gone'), i * 60)); phase = 0; t0 = t + 700; d = 0; show(0); }
    }
    show(0); requestAnimationFrame(tick);
  })();

  /* =================================================================
     THE STORY, SCROLLED SIDEWAYS
     ================================================================= */
  (() => {
    const box = $('[data-hs]'); if (!box) return;
    const track = $('[data-track]'), prog = $('[data-prog]'), hm = $('[data-hm]'), hd = $('[data-hd]');
    const marks = $$('.rail .m', box);
    const lerp = (a, b, k) => a + (b - a) * k, sm = k => k * k * (3 - 2 * k);
    function daysAt(p) {
      if (p < .08) return 0;
      if (p < .25) return lerp(0, 1, sm((p - .08) / .17));
      if (p < .5) return lerp(1, 21, sm((p - .25) / .25));
      if (p < .62) return 21;
      if (p < .75) return lerp(21, 0, sm((p - .62) / .13));
      if (p < .82) return 0;
      return lerp(0, 10, sm(Math.min(1, (p - .82) / .18)));
    }
    function apply(p) {
      const wide = innerWidth > 900;
      track.style.transform = wide ? `translate3d(${(-p * Math.max(0, track.scrollWidth - innerWidth)).toFixed(1)}px,0,0)` : '';
      const d = daysAt(p);
      hm.textContent = mult(d).toFixed(2);
      hd.textContent = p >= .66 && p < .82 ? 'sold: the clock starts over' : d >= 20.9 ? 'fully ripe' : fmtDays(d);
      prog.style.transform = `scaleX(${p.toFixed(4)})`;
      marks.forEach((m, i) => m.classList.toggle('on', p >= i / 4 - .02));
    }
    apply(0);
    if (window.ScrollTrigger && !reduced) {
      ScrollTrigger.create({ trigger: box, start: 'top top', end: 'bottom bottom', scrub: .5, onUpdate: s => apply(s.progress) });
      addEventListener('resize', () => ScrollTrigger.refresh());
    } else {
      const upd = () => { const r = box.getBoundingClientRect(); apply(Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)))); };
      addEventListener('scroll', upd, { passive: true }); upd();
    }
  })();

  /* ---------- sort chips (list is empty until launch, but the control works) */
  $$('[data-sort]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('.chip', g).forEach(c => c.classList.toggle('on', c === b));
  }));

  /* =================================================================
     LAUNCH PAGE: live preview of the coin card
     ================================================================= */
  (() => {
    const form = $('[data-launch]'); if (!form) return;
    const pv = { name: $('[data-pv-name]'), sym: $('[data-pv-sym]'), desc: $('[data-pv-desc]'), pic: $('[data-pv-pic]') };
    const upd = () => {
      const f = new FormData(form);
      pv.name.textContent = (f.get('name') || '').trim() || 'Your coin';
      pv.sym.textContent = '$' + ((f.get('symbol') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TICKER');
      pv.desc.textContent = (f.get('desc') || '').trim() || 'A line about what it is. Holders start ripening from the first buy.';
    };
    form.addEventListener('input', upd); upd();
    const file = $('input[type=file]', form);
    file && file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f || !f.type.startsWith('image/')) return;
      const url = URL.createObjectURL(f);
      pv.pic.innerHTML = `<img src="${url}" alt="">`;
    });
    form.addEventListener('submit', e => { e.preventDefault(); toast('Wallet connection opens with the first launch.'); });
  })();

  /* whatever is already on screen at load shows at once, without waiting for the observer */
  requestAnimationFrame(() => $$('.rv:not(.in),.split:not(.in)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * .95 && r.bottom > 0) { el.classList.add('in'); el.dispatchEvent(new Event('reveal')); io.unobserve(el); }
  }));
})();
