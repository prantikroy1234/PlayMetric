import { useMemo, useState } from 'react';
import { Modal, Field } from '../../components/ui';

export const CATEGORIES = ['General', 'Maintenance', 'Billing', 'Facilities', 'Booking'];
export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
export const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const req = (v) => !String(v ?? '').trim();

export default function TicketForm({ initial, orgs, clients, lockedOrgId, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const orgClients = useMemo(() => clients.filter((c) => c.org_id === form.org_id), [clients, form.org_id]);

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.title)) e.title = 'Give the ticket a title';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        assignee: form.assignee?.trim() || null,
        client_id: form.client_id || null,
        due_date: form.due_date || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit ticket' : 'New ticket'}
      subtitle="Track an inquiry, issue, or maintenance request."
      onClose={onClose}
      footer={
        <>
          {initial.id && onDelete && (
            <button
              type="button"
              className="btn btn--danger btn--ghostdanger"
              onClick={() => onDelete(initial)}
              disabled={busy}
              style={{ marginRight: 'auto' }}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="ticket-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Create ticket'}
          </button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={submit} className="formgrid">
        <Field label="Organisation" required error={errors.org_id}>
          <select
            value={form.org_id}
            onChange={set('org_id')}
            disabled={Boolean(lockedOrgId)}
            className={errors.org_id ? 'is-invalid' : ''}
          >
            <option value="">Select one…</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>

        <Field label="Category">
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <div className="span-2">
          <Field label="Title" required error={errors.title}>
            <input
              value={form.title}
              onChange={set('title')}
              className={errors.title ? 'is-invalid' : ''}
              placeholder="Leaking roof over Court 3"
            />
          </Field>
        </div>

        <div className="span-2">
          <Field label="Description">
            <textarea rows={3} value={form.description ?? ''} onChange={set('description')} placeholder="Add any detail…" />
          </Field>
        </div>

        <Field label="Priority">
          <select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>

        <Field label="Assignee">
          <input value={form.assignee ?? ''} onChange={set('assignee')} placeholder="Ravi" />
        </Field>

        <Field label="Due date">
          <input type="date" value={form.due_date ?? ''} onChange={set('due_date')} />
        </Field>

        <div className="span-2">
          <Field label="Linked client" hint="Optional.">
            <select value={form.client_id ?? ''} onChange={set('client_id')}>
              <option value="">None</option>
              {orgClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
