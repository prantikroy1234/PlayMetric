(function () {
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  const video = document.getElementById('heroVideo');
  const burger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('mobileMenu');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav background toggles once the page scrolls past the hero start.
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeMobileMenu() {
    mobileMenu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-menu-open');
  }

  // Mobile menu toggle.
  burger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(isOpen));
    nav.classList.toggle('is-menu-open', isOpen);
  });

  mobileMenu.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', closeMobileMenu);
  });

  // Hero video plays only while the hero is in view; paused (and never
  // autoplayed) if the user has requested reduced motion.
  if (video && !prefersReducedMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(hero);
  }

  // Footer year.
  const footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // Scroll-reveal for cards/media below the fold.
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    } else {
      const revealIo = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      );
      revealEls.forEach((el) => revealIo.observe(el));
    }
  }

  // ---------- 3D rotating node network (spotlight section) ----------
  (function () {
    const svg = document.getElementById('networkSvg');
    if (!svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    const linesGroup = document.getElementById('networkLines');
    const nodesGroup = document.getElementById('networkNodes');
    const centerX = 200;
    const centerY = 170;
    const focal = 340; // perspective focal length — smaller = stronger depth effect
    const orbitRadius = 128;
    const tilt = 0.36; // fixed viewing tilt so the orbit reads as an ellipse, not a flat line

    // Distribute satellite nodes evenly on a sphere (golden-angle spiral) so they read as
    // "many nodes around a principal node" rather than a flat ring.
    const satelliteCount = 9;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const satellites = [];
    for (let i = 0; i < satelliteCount; i++) {
      const yFrac = satelliteCount === 1 ? 0 : 1 - (i / (satelliteCount - 1)) * 2; // 1..-1
      const ringR = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
      const theta = goldenAngle * i;
      satellites.push({
        x: Math.cos(theta) * ringR * orbitRadius,
        y: yFrac * orbitRadius * 0.72,
        z: Math.sin(theta) * ringR * orbitRadius,
      });
    }

    // A few secondary connections between satellites, purely decorative, to read as a mesh
    // rather than a strict hub-and-spoke star.
    const secondaryLinks = [
      [0, 3], [2, 5], [4, 7], [6, 8], [1, 6],
    ].filter(([a, b]) => a < satelliteCount && b < satelliteCount);

    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    function project(x, y, z) {
      const scale = focal / (focal + z);
      return { sx: centerX + x * scale, sy: centerY + y * scale, scale };
    }

    function makeEl(tag, attrs) {
      const el = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
      return el;
    }

    function render(angle, pulse) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const projected = satellites.map((n) => {
        // Rotate around the Y axis.
        const x = n.x * cosA - n.z * sinA;
        const zRot = n.x * sinA + n.z * cosA;
        // Apply the fixed viewing tilt around the X axis.
        const y = n.y * cosT - zRot * sinT;
        const z = n.y * sinT + zRot * cosT;
        return { ...project(x, y, z), z };
      });

      const backToFront = projected.map((_, i) => i).sort((a, b) => projected[a].z - projected[b].z);

      linesGroup.textContent = '';
      backToFront.forEach((i) => {
        const p = projected[i];
        linesGroup.appendChild(
          makeEl('line', {
            x1: centerX,
            y1: centerY,
            x2: p.sx.toFixed(2),
            y2: p.sy.toFixed(2),
            stroke: 'url(#netLine)',
            'stroke-width': Math.max(0.5, 1.5 * p.scale).toFixed(2),
            opacity: Math.min(0.85, Math.max(0.12, p.scale - 0.32)).toFixed(2),
          })
        );
      });
      secondaryLinks.forEach(([a, b]) => {
        const pa = projected[a];
        const pb = projected[b];
        linesGroup.appendChild(
          makeEl('line', {
            x1: pa.sx.toFixed(2),
            y1: pa.sy.toFixed(2),
            x2: pb.sx.toFixed(2),
            y2: pb.sy.toFixed(2),
            stroke: 'url(#netLine)',
            'stroke-width': 0.6,
            opacity: 0.18,
          })
        );
      });

      nodesGroup.textContent = '';
      backToFront.forEach((i) => {
        const p = projected[i];
        nodesGroup.appendChild(
          makeEl('circle', {
            cx: p.sx.toFixed(2),
            cy: p.sy.toFixed(2),
            r: Math.max(2.5, 6.5 * p.scale).toFixed(2),
            fill: i % 2 === 0 ? '#5CE1FF' : '#7C6CFF',
            opacity: Math.min(1, Math.max(0.35, p.scale - 0.05)).toFixed(2),
          })
        );
      });

      // Principal node stays fixed at the center, always on top, with a slow pulse.
      nodesGroup.appendChild(
        makeEl('circle', {
          cx: centerX,
          cy: centerY,
          r: (15 + pulse * 1.5).toFixed(2),
          fill: 'url(#netCore)',
        })
      );
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      render(0.6, 0);
      return;
    }

    let start = null;
    function tick(t) {
      if (start === null) start = t;
      const elapsed = (t - start) / 1000;
      const angle = elapsed * 0.25; // slow, continuous rotation
      const pulse = Math.sin(elapsed * 1.1);
      render(angle, pulse);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // ---------- Platform card flip ----------
  document.querySelectorAll('[data-flip-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.platform-card');
      if (!card) return;
      const flipping = !card.classList.contains('is-flipped');
      card.classList.toggle('is-flipped', flipping);
      btn.closest('.platform-card__face').setAttribute('aria-hidden', 'true');
      const otherFace = flipping
        ? card.querySelector('.platform-card__face--back')
        : card.querySelector('.platform-card__face--front');
      if (otherFace) otherFace.removeAttribute('aria-hidden');
    });
  });

  // ---------- Pricing period toggle ----------
  const periodBtns = document.querySelectorAll('.pricing-toggle__btn');
  if (periodBtns.length) {
    periodBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        periodBtns.forEach((b) => b.classList.toggle('is-active', b === btn));

        document.querySelectorAll('.pricing-card__amount[data-monthly]').forEach((el) => {
          el.textContent = period === 'annual' ? el.dataset.annual : el.dataset.monthly;
        });
        document.querySelectorAll('[data-annual-note]').forEach((el) => {
          el.hidden = period !== 'annual';
        });
      });
    });
  }

  // ---------- Demo request modal ----------
  const modal = document.getElementById('demoModal');
  const modalBody = document.getElementById('demoModalBody');
  const form = document.getElementById('demoForm');
  const formError = document.getElementById('demoFormError');
  let lastFocusedEl = null;

  function getFocusable() {
    return Array.from(
      modal.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
  }

  function openModal() {
    lastFocusedEl = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = getFocusable();
    if (focusable.length) focusable[0].focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.querySelectorAll('[data-open-demo-modal]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });
  });

  modal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  function setFieldErrors(details) {
    if (!details) return;
    details.forEach(({ field, message }) => {
      const input = form.elements.namedItem(field);
      if (input) input.setCustomValidity(message);
    });
  }

  function clearFieldErrors() {
    Array.from(form.elements).forEach((el) => {
      if (el.setCustomValidity) el.setCustomValidity('');
    });
  }

  function showSuccess() {
    modalBody.innerHTML =
      '<div class="modal__success">' +
      '<div class="modal__success-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11.5L9 16.5L18 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h2 class="modal__title">Request sent</h2>' +
      '<p class="modal__subtitle">Thanks — someone from the PlayMetric team will reach out shortly.</p>' +
      '</div>';
  }

  if (form) {
    // Only flag a field as invalid after the visitor has actually left it (or
    // tried to submit) — never on a pristine, untouched field.
    Array.from(form.elements).forEach((el) => {
      if (!('checkValidity' in el)) return;
      el.addEventListener('blur', () => {
        el.classList.toggle('is-invalid', !el.checkValidity());
      });
      el.addEventListener('input', () => {
        if (el.classList.contains('is-invalid')) {
          el.classList.toggle('is-invalid', !el.checkValidity());
        }
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors();
      formError.hidden = true;

      if (!form.checkValidity()) {
        Array.from(form.elements).forEach((el) => {
          if ('checkValidity' in el) el.classList.toggle('is-invalid', !el.checkValidity());
        });
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('.demo-form__submit');
      submitBtn.disabled = true;
      submitBtn.dataset.loading = 'true';

      const payload = Object.fromEntries(new FormData(form).entries());

      // Honeypot: real visitors never fill this hidden field. If a bot did,
      // fake success and skip the insert entirely — don't tip it off.
      if (payload.website) {
        showSuccess();
        return;
      }

      try {
        const { error } = await window.pmSupabase.from('leads').insert({
          name: (payload.name || '').trim(),
          email: (payload.email || '').trim(),
          academy_name: (payload.academyName || '').trim(),
          phone: (payload.phone || '').trim(),
          message: (payload.message || '').trim(),
          source: 'hero-book-demo',
        });

        if (error) {
          formError.textContent = 'Something went wrong. Please try again.';
          formError.hidden = false;
          submitBtn.disabled = false;
          submitBtn.dataset.loading = 'false';
          return;
        }

        showSuccess();
      } catch (err) {
        formError.textContent = 'Network error — please check your connection and try again.';
        formError.hidden = false;
        submitBtn.disabled = false;
        submitBtn.dataset.loading = 'false';
      }
    });
  }
})();
