(function () {
  'use strict';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     2. Sports-equipment loading cycle
     ============================================================ */
  const loader = document.getElementById('loader');
  const loaderLabel = document.getElementById('loaderLabel');
  (function loaderCycle() {
    if (!loader) return;
    const icons = Array.from(loader.querySelectorAll('.loader__icon'));
    if (!icons.length) return;
    let idx = 0;
    setInterval(() => {
      if (loader.classList.contains('is-hidden')) return;
      icons[idx].classList.remove('is-active');
      idx = (idx + 1) % icons.length;
      icons[idx].classList.add('is-active');
      if (loaderLabel) loaderLabel.textContent = icons[idx].dataset.sport;
    }, prefersReducedMotion ? 900 : 460);
  })();

  function showLoader(label) {
    if (!loader) return;
    if (label && loaderLabel) loaderLabel.textContent = label;
    loader.classList.remove('is-hidden');
  }
  function hideLoader() {
    if (loader) loader.classList.add('is-hidden');
  }

  // Initial page loader.
  window.addEventListener('load', () => {
    setTimeout(hideLoader, prefersReducedMotion ? 300 : 1500);
  });

  /* ============================================================
     3. Tab toggle
     ============================================================ */
  const tabs = document.querySelector('.auth-tabs');
  const tabSignin = document.getElementById('tabSignin');
  const tabSignup = document.getElementById('tabSignup');
  const signinForm = document.getElementById('signinForm');
  const signupForm = document.getElementById('signupForm');
  const subtitle = document.getElementById('authSubtitle');

  function activate(which) {
    const signin = which === 'signin';
    tabs.dataset.active = which;
    tabSignin.classList.toggle('is-active', signin);
    tabSignup.classList.toggle('is-active', !signin);
    tabSignin.setAttribute('aria-selected', String(signin));
    tabSignup.setAttribute('aria-selected', String(!signin));
    signinForm.classList.toggle('is-hidden', !signin);
    signupForm.classList.toggle('is-hidden', signin);
    subtitle.textContent = signin
      ? 'Sign in to your academy, or create a new account.'
      : 'Create your PlayMetric account to get started.';
  }
  tabSignin.addEventListener('click', () => activate('signin'));
  tabSignup.addEventListener('click', () => activate('signup'));

  /* ============================================================
     4. Show / hide password
     ============================================================ */
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.field__wrap').querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  /* ============================================================
     5. Validation helpers
     ============================================================ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, message) {
    const field = input.closest('.field');
    const err = field && field.querySelector('.field__error');
    if (err) err.textContent = message || '';
    input.classList.toggle('is-invalid', Boolean(message));
    input.classList.toggle('is-valid', !message && input.value.trim() !== '');
  }

  function validateField(input) {
    const name = input.name;
    const val = input.value.trim();
    if (name === 'academyName') {
      if (val.length < 2) return 'Enter your academy name';
    }
    if (name === 'fullName') {
      if (val.length < 2) return 'Enter your name';
    }
    if (name === 'email') {
      if (!EMAIL_RE.test(val)) return 'Enter a valid email';
    }
    if (name === 'password' && input.closest('#signupForm')) {
      if (val.length < 10) return 'At least 10 characters';
    }
    if (name === 'password' && input.closest('#signinForm')) {
      if (val.length < 1) return 'Enter your password';
    }
    if (name === 'confirmPassword') {
      const pw = input.closest('form').querySelector('input[name="password"]').value;
      if (val !== pw) return 'Passwords do not match';
    }
    return '';
  }

  [signinForm, signupForm].forEach((form) => {
    form.querySelectorAll('input').forEach((input) => {
      if (input.name === 'website' || input.name === 'remember') return;
      input.addEventListener('blur', () => setError(input, validateField(input)));
      input.addEventListener('input', () => {
        if (input.classList.contains('is-invalid')) setError(input, validateField(input));
      });
    });
  });

  /* ============================================================
     6. Password strength meter (signup)
     ============================================================ */
  const strengthEl = signupForm.querySelector('[data-strength]');
  const signupPassword = signupForm.querySelector('input[name="password"]');
  signupPassword.addEventListener('input', () => {
    const v = signupPassword.value;
    if (!v) { strengthEl.hidden = true; return; }
    strengthEl.hidden = false;
    let score = 0;
    if (v.length >= 10) score++;
    if (v.length >= 14) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;
    const level = score <= 2 ? 'weak' : score === 3 ? 'fair' : 'strong';
    strengthEl.dataset.level = level;
    strengthEl.querySelector('.strength__label').textContent =
      level.charAt(0).toUpperCase() + level.slice(1);
  });

  /* ============================================================
     7. Submit — talks directly to Supabase Auth
     ============================================================ */
  const sb = window.pmSupabase;

  function showSuccess(title, text) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successText').textContent = text;
    document.getElementById('authSuccess').hidden = false;
  }

  // Validate the visible fields, then hand the actual auth call to `run`.
  // `run` returns a { title, text } to celebrate with, or throws an Error
  // whose message is shown in the form-level error banner.
  async function handleSubmit(form, run) {
    const inputs = Array.from(form.querySelectorAll('input')).filter(
      (i) => i.name !== 'website' && i.name !== 'remember'
    );
    let firstBad = null;
    inputs.forEach((input) => {
      const msg = validateField(input);
      setError(input, msg);
      if (msg && !firstBad) firstBad = input;
    });
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const formError = form.querySelector('[data-form-error]');
    formError.hidden = true;
    const submitBtn = form.querySelector('.auth-submit');
    submitBtn.dataset.loading = 'true';
    showLoader('Kicking off…');

    const startedAt = Date.now();
    try {
      const result = await run();
      // Let the loading animation breathe so it's actually seen.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed));
      hideLoader();
      submitBtn.dataset.loading = 'false';
      showSuccess(result.title, result.text);
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed));
      hideLoader();
      submitBtn.dataset.loading = 'false';
      formError.textContent = err.message || 'Something went wrong. Please try again.';
      formError.hidden = false;
    }
  }

  // Sign in
  signinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(signinForm, async () => {
      const email = signinForm.email.value.trim();
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: signinForm.password.value,
      });
      if (error) throw new Error(mapAuthError(error.message));
      const name = data.user?.user_metadata?.full_name || data.user?.email || 'there';
      return { title: "You're in", text: `Signed in as ${name}. Good to see you back.` };
    });
  });

  // Create account
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(signupForm, async () => {
      const academyName = signupForm.academyName.value.trim();
      const fullName = signupForm.fullName.value.trim();
      const email = signupForm.email.value.trim();
      // These metadata keys are read by the handle_new_academy_signup() trigger,
      // which provisions the org + owner staff row. Keep the key names in sync.
      const { data, error } = await sb.auth.signUp({
        email,
        password: signupForm.password.value,
        options: { data: { academy_name: academyName, full_name: fullName } },
      });
      if (error) throw new Error(mapAuthError(error.message));

      // Supabase returns a user with no identities when the email is already
      // registered — surfaced this way to avoid account enumeration.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Try signing in instead.');
      }
      // With email confirmation on, there's a user but no session yet.
      if (!data.session) {
        return {
          title: 'Almost there',
          text: `We've sent a confirmation link to ${email}. Click it to finish setting up ${academyName}.`,
        };
      }
      return { title: "You're in", text: `${academyName} is ready. Welcome to PlayMetric.` };
    });
  });

  // Friendlier copy for the handful of Supabase auth errors visitors actually hit.
  function mapAuthError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Invalid email or password.';
    if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.';
    if (m.includes('password should be at least')) return 'Password is too short.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
    return msg || 'Something went wrong. Please try again.';
  }

  // Placeholder links that aren't wired yet.
  document.querySelectorAll('[data-noop]').forEach((el) =>
    el.addEventListener('click', (e) => e.preventDefault())
  );
})();
