(function () {
  const state = { page: 1, limit: 25, status: '', total: 0, csrfToken: null };

  const tableEl = document.getElementById('leadsTable');
  const bodyEl = document.getElementById('leadsBody');
  const loadingEl = document.getElementById('leadsLoading');
  const emptyEl = document.getElementById('leadsEmpty');
  const paginationEl = document.getElementById('pagination');
  const pageInfoEl = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const statusFilter = document.getElementById('statusFilter');
  const adminEmailEl = document.getElementById('adminEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return iso;
    }
  }

  function buildRow(lead) {
    const tr = document.createElement('tr');

    const leadCell = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'admin-table__lead';

    const avatar = document.createElement('img');
    avatar.className = 'admin-table__avatar';
    avatar.alt = '';
    avatar.loading = 'lazy';
    avatar.src = 'https://i.pravatar.cc/64?u=' + encodeURIComponent(lead.email);
    wrap.appendChild(avatar);

    const nameBlock = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'admin-table__name';
    nameEl.textContent = lead.name; // textContent — never innerHTML — for anything lead-supplied
    const emailEl = document.createElement('div');
    emailEl.className = 'admin-table__email';
    emailEl.textContent = lead.email;
    nameBlock.appendChild(nameEl);
    nameBlock.appendChild(emailEl);
    wrap.appendChild(nameBlock);

    leadCell.appendChild(wrap);
    tr.appendChild(leadCell);

    const academyCell = document.createElement('td');
    academyCell.textContent = lead.academyName || '—';
    tr.appendChild(academyCell);

    const phoneCell = document.createElement('td');
    phoneCell.textContent = lead.phone || '—';
    tr.appendChild(phoneCell);

    const messageCell = document.createElement('td');
    messageCell.textContent = lead.message ? (lead.message.length > 80 ? lead.message.slice(0, 80) + '…' : lead.message) : '—';
    messageCell.title = lead.message || '';
    tr.appendChild(messageCell);

    const statusCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'status-select';
    ['new', 'contacted', 'qualified', 'closed'].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      if (s === lead.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => updateStatus(lead._id, select.value, select));
    statusCell.appendChild(select);
    tr.appendChild(statusCell);

    const dateCell = document.createElement('td');
    dateCell.textContent = fmtDate(lead.createdAt);
    tr.appendChild(dateCell);

    return tr;
  }

  async function updateStatus(id, status, selectEl) {
    selectEl.disabled = true;
    try {
      const res = await fetch('/api/admin/leads/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': state.csrfToken,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('update failed');
    } catch (err) {
      alert('Could not update status. Please try again.');
    } finally {
      selectEl.disabled = false;
    }
  }

  async function loadLeads() {
    loadingEl.hidden = false;
    tableEl.hidden = true;
    emptyEl.hidden = true;
    paginationEl.hidden = true;

    const params = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.status) params.set('status', state.status);

    const res = await fetch('/api/admin/leads?' + params.toString(), { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();

    loadingEl.hidden = true;
    bodyEl.innerHTML = '';

    if (!data.leads.length) {
      emptyEl.hidden = false;
      return;
    }

    data.leads.forEach((lead) => bodyEl.appendChild(buildRow(lead)));
    tableEl.hidden = false;

    state.total = data.total;
    const totalPages = Math.max(1, Math.ceil(data.total / state.limit));
    pageInfoEl.textContent = `Page ${state.page} of ${totalPages} · ${data.total} total`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;
    paginationEl.hidden = false;
  }

  async function init() {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = 'login.html';
      return;
    }
    const session = await res.json();
    state.csrfToken = session.csrfToken;
    adminEmailEl.textContent = session.email;

    await loadLeads();
  }

  statusFilter.addEventListener('change', () => {
    state.status = statusFilter.value;
    state.page = 1;
    loadLeads();
  });

  prevBtn.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadLeads();
    }
  });

  nextBtn.addEventListener('click', () => {
    state.page += 1;
    loadLeads();
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': state.csrfToken },
      credentials: 'same-origin',
    });
    window.location.href = 'login.html';
  });

  init();
})();
