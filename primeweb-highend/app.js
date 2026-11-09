/* PrimeWeb Design – Entwurf 11 „Obsidian Gallery“ – Interaktion
   Grundlage: app.js aus Entwurf 01 (Obsidian 3D), Navigation/Geräte/Zahlen aus Entwurf 03,
   Parallaxe/Paket-Links aus Entwurf 07. GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.18 (optional). */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const isNarrow = window.matchMedia('(max-width: 760px)').matches;
  const isSmall = window.matchMedia('(max-width: 900px)').matches;
  // Sehr hohe Fenster (Ganzseiten-Screenshots, Druck) bekommen keine Scroll-Inszenierung,
  // damit alle Inhalte im Endzustand sichtbar sind.
  const tallViewport = window.innerHeight > 2000;
  const noAnim = reduced || tallViewport;
  if (noAnim) root.classList.add('no-anim');
  // Ganzseiten-Ansicht/Druck: alle Bilder sofort laden, damit nichts leer bleibt
  if (tallViewport) document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });

  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Navigation: Burger (01) + Ausblenden beim Runterscrollen (03) ---------- */
  const nav = document.querySelector('.top-nav');
  const toggle = document.querySelector('.nav-toggle');
  let lastY = window.pageYOffset;
  let ticking = false;
  const onScroll = () => {
    const y = window.pageYOffset;
    nav.classList.toggle('is-scrolled', y > 20);
    if (!nav.classList.contains('nav-open')) {
      if (y > 140 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 140) nav.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menü öffnen');
    }));
  }

  /* ---------- Lenis Smooth-Scroll (optional) ---------- */
  let lenis = null;
  // Smooth-Scroll ist standardmäßig AUS (fühlte sich wie Hängen an); zum Testen mit ?smooth einschalten
  const smooth = /[?&]smooth/.test(location.search);
  if (!noAnim && !isTouch && smooth && typeof window.Lenis !== 'undefined' && hasGsap) {
    try {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
          const id = a.getAttribute('href');
          if (id.length < 2) return;
          const target = document.querySelector(id);
          if (!target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -70, duration: 1.4 });
          history.replaceState(null, '', id);
        });
      });
    } catch (err) { lenis = null; }
  }

  /* ---------- Headline buchstabenweise (01) ---------- */
  const title = document.querySelector('[data-split]');
  if (title) {
    const plain = title.textContent.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', plain);
    title.querySelectorAll('.line').forEach(line => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      words.forEach((w, wi) => {
        const ws = document.createElement('span');
        ws.className = 'word';
        [...w].forEach(ch => {
          const cs = document.createElement('span');
          cs.className = 'ch';
          cs.textContent = ch;
          ws.appendChild(cs);
        });
        line.appendChild(ws);
        if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    if (hasGsap && !noAnim) {
      const chars = title.querySelectorAll('.ch');
      gsap.set(chars, { opacity: 0, yPercent: 60, rotateX: -40, transformOrigin: '50% 100%' });
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.to(chars, { opacity: 1, yPercent: 0, rotateX: 0, duration: 1.1, stagger: { each: 0.022, from: 'start' } }, 0.25)
        .from('.hero-top', { opacity: 0, y: -14, duration: 0.9 }, 0.1)
        .from('.hero-sub, .hero-actions, .hero-trust', { opacity: 0, y: 24, duration: 1, stagger: 0.12 }, 0.9)
        .from('.top-nav', { opacity: 0, y: -16, duration: 0.9, clearProps: 'all' }, 0.2);
    }
  }

  /* ---------- Reveal per IntersectionObserver (01) + Goldlinien (07) ---------- */
  const revealEls = document.querySelectorAll('.rv, [data-step], .rule');
  if (noAnim || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(el => io.observe(el));
    // Sicherheitsnetz: alles, was nach 2,5 s noch im Sichtfeld und unsichtbar ist, einblenden
    const showVisible = () => {
      revealEls.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.05 && r.bottom > 0) el.classList.add('is-in');
      });
    };
    setTimeout(showVisible, 2500);
    document.addEventListener('visibilitychange', showVisible);
  }

  /* ---------- Zahlen hochzählen (03) ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if (!noAnim && 'IntersectionObserver' in window && counters.length) {
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        const el = e.target, end = parseInt(el.getAttribute('data-count'), 10) || 0;
        const dur = 900;
        let t0 = null;
        const frame = ts => {
          if (t0 === null) t0 = ts;
          const p = Math.min(1, (ts - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased);
          if (p < 1) window.requestAnimationFrame(frame); else el.textContent = end;
        };
        el.textContent = '0';
        window.requestAnimationFrame(frame);
        setTimeout(() => { el.textContent = end; }, dur + 100);
      });
    }, { threshold: 0.5 });
    counters.forEach(c => cio.observe(c));
  }

  /* ---------- 3D-Tilt + Lichtkante (01) / Goldkante auf Preiszeilen ---------- */
  if (!isTouch && !reduced) {
    const follow = (el, withTilt) => {
      let raf = 0;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
          el.style.setProperty('--my', (py * 100).toFixed(2) + '%');
          if (withTilt) {
            el.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
            el.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
          }
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        if (withTilt) {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        }
      });
    };
    document.querySelectorAll('[data-tilt]').forEach(el => follow(el, true));
    document.querySelectorAll('[data-glow]').forEach(el => follow(el, false));
  }

  /* ---------- Laptop kippt schnell ins Bild (kein Pinning, kurzer Scrollweg) ---------- */
  const stage = document.getElementById('laptop-stage');
  if (stage) {
    const setOpen = (p) => { // p: 0 → 1
      const start = isSmall ? 12 : 14;
      stage.style.setProperty('--open', (start * (1 - p)).toFixed(2) + 'deg');
      stage.style.setProperty('--rise', p.toFixed(3));
      stage.classList.toggle('is-set', p > 0.98);
    };
    if (noAnim || !hasGsap) {
      setOpen(1);
    } else {
      const state = { p: 0 };
      setOpen(0);
      gsap.to(state, {
        p: 1, ease: 'none', onUpdate: () => setOpen(state.p),
        scrollTrigger: { trigger: stage, start: 'top 92%', end: 'top 45%', scrub: 0.4 }
      });
      // Leichtes Schweben, sobald der Laptop steht
      gsap.to(stage.querySelector('.open-laptop'), { y: -6, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }
  }

  /* ---------- Geräte kippen beim Scrollen (03) ---------- */
  if (hasGsap && !noAnim) {
    const amp = isSmall ? 4 : 8;
    document.querySelectorAll('.tilt').forEach(el => {
      const dir = parseFloat(el.getAttribute('data-dir')) || 1;
      const trigger = el.closest('.persp') || el;
      gsap.fromTo(el,
        { rotateY: dir * amp, rotateX: amp * 0.5, y: isSmall ? 10 : 24 },
        {
          rotateY: -dir * amp, rotateX: -amp * 0.5, y: isSmall ? -10 : -24, ease: 'none',
          scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
    });
    const photo = document.querySelector('.stage__photo');
    if (photo && !isSmall) {
      gsap.fromTo(photo, { scale: 1 }, {
        scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: '.stage', start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    }
    // Goldene Linie im Ablauf zeichnet sich beim Scrollen
    const line = document.querySelector('.process-line');
    if (line) {
      gsap.fromTo(line, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.steps', start: 'top 80%', end: 'bottom 55%', scrub: 0.6 }
      });
    }
  }

  /* ---------- Parallaxe der Bildstudien (07) ---------- */
  const parallaxFrames = [...document.querySelectorAll('[data-parallax]')];
  if (!noAnim && parallaxFrames.length) {
    let frameRequested = false;
    const paint = () => {
      frameRequested = false;
      const vh = window.innerHeight;
      parallaxFrames.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -60 || rect.top > vh + 60) return;
        const distance = (vh / 2 - rect.top - rect.height / 2) / (vh + rect.height);
        const limit = Math.min(26, rect.height * 0.045);
        const shift = Math.max(-limit, Math.min(limit, distance * rect.height * 0.14));
        el.style.setProperty('--shift', shift.toFixed(2) + 'px');
      });
    };
    const request = () => { if (!frameRequested) { frameRequested = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    window.addEventListener('load', request);
    request();
  }

  /* ---------- Paket-Links setzen die Projektart vor (07) ---------- */
  const projectType = document.getElementById('f-type');
  if (projectType) {
    document.querySelectorAll('[data-package]').forEach(link => {
      link.addEventListener('click', () => {
        const wanted = link.dataset.package;
        const opt = [...projectType.options].find(o => o.value === wanted || o.textContent.trim().startsWith(wanted));
        if (opt) { projectType.value = opt.value; projectType.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
  }


  /* ---------- Cookie-Banner: Google Analytics 4 nur nach Einwilligung ---------- */
  const CONSENT_KEY = 'pw_consent'; // "ja" | "nein"
  const GA_ID = 'G-5DE70SK8NX';
  const banner = document.getElementById('cookieBanner');
  const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } };
  const writeConsent = (v) => { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} };
  function loadAnalytics() {
    if (window.pwGaLoaded) return;
    window.pwGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
    requestAnimationFrame(() => banner.classList.add('is-visible'));
  }
  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('is-visible');
    setTimeout(() => { banner.hidden = true; }, 450);
  }
  if (banner) {
    const vorher = readConsent();
    if (vorher === 'ja') loadAnalytics();
    else if (vorher !== 'nein') setTimeout(showBanner, 900);
    document.getElementById('cookieAccept').addEventListener('click', () => { writeConsent('ja'); hideBanner(); loadAnalytics(); });
    document.getElementById('cookieDecline').addEventListener('click', () => {
      const warJa = readConsent() === 'ja';
      writeConsent('nein'); hideBanner();
      if (warJa) location.reload(); // bereits geladene Google-Skripte beenden
    });
    const settings = document.getElementById('cookieSettings');
    if (settings) settings.addEventListener('click', (e) => { e.preventDefault(); showBanner(); });
  }

  /* ---------- Rechtstexte: Links auf #impressum / #datenschutz klappen den Text auf und scrollen hin ---------- */
  function openLegal(id, scroll) {
    const d = document.getElementById(id);
    if (!d || !('open' in d)) return false;
    d.open = true;
    if (scroll) d.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    return true;
  }
  document.querySelectorAll('a[href="#impressum"], a[href="#datenschutz"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (openLegal(id, true)) { e.preventDefault(); history.replaceState(null, '', '#' + id); }
    });
  });
  if (location.hash === '#impressum' || location.hash === '#datenschutz') openLegal(location.hash.slice(1), true);

  /* ---------- Formular (01) ---------- */
  const form = document.getElementById('lead-form');
  const status = document.getElementById('form-status');
  const submit = document.getElementById('form-submit');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const fd = new FormData(form);
      const body = {
        source: 'formular',
        name: fd.get('name') || '',
        company: fd.get('company') || '',
        email: fd.get('email') || '',
        phone: fd.get('phone') || '',
        package: fd.get('projectType') || '',
        website: fd.get('website') || '',
        message: fd.get('message') || ''
      };
      submit.disabled = true;
      const label = submit.innerHTML;
      submit.textContent = 'Wird gesendet …';
      try {
        const res = await fetch('https://prime-web-design-github-io.vercel.app/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        status.className = 'form-status ok';
        status.textContent = 'Danke! Marc meldet sich persönlich – meist innerhalb von 24 Stunden.';
        form.reset();
      } catch (err) {
        status.className = 'form-status err';
        status.textContent = 'Das hat leider nicht geklappt. Bitte versuch es noch einmal oder schreib direkt an marc@primeweb-design.de.';
      } finally {
        submit.disabled = false;
        submit.innerHTML = label;
      }
    });
  }
})();
