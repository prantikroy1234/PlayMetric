(function () {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const submitBtn = form.querySelector('.admin-auth__submit');
    submitBtn.disabled = true;

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        errorEl.textContent = data.error || 'Sign in failed. Please try again.';
        errorEl.hidden = false;
        submitBtn.disabled = false;
        return;
      }

      window.location.href = 'dashboard.html';
    } catch (err) {
      errorEl.textContent = 'Network error — please check your connection and try again.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });
})();
