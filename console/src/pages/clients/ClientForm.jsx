import { useState } from 'react';
import { Modal, Field } from '../../components/ui';

export const TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'corporate', label: 'Corporate' },
];

const req = (v) => !String(v ?? '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Add / edit a client (person, team, or corporate account).
export default function ClientForm({ initial, orgs, lockedOrgId, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.name)) e.name = 'Client name is required';
    if (f.email && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email';
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
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit client' : 'Add client'}
      subtitle="A person, team, or company that books court time."
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
          <button type="submit" form="client-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Add client'}
          </button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="formgrid">
        <Field label="Organisation" required error={errors.org_id}>
          <select
            value={form.org_id}
            onChange={set('org_id')}
            disabled={Boolean(lockedOrgId)}
            className={errors.org_id ? 'is-invalid' : ''}
          >
            <option value="">Select one…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Type">
          <select value={form.type} onChange={set('type')}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <div className="span-2">
          <Field label="Name" required error={errors.name}>
            <input
              value={form.name}
              onChange={set('name')}
              className={errors.name ? 'is-invalid' : ''}
              placeholder="Rahul Sharma"
            />
          </Field>
        </div>

        <Field label="Phone">
          <input value={form.phone ?? ''} onChange={set('phone')} placeholder="98110 22001" />
        </Field>

        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={set('email')}
            className={errors.email ? 'is-invalid' : ''}
            placeholder="rahul@example.com"
          />
        </Field>

        <div className="span-2">
          <Field label="Notes">
            <input value={form.notes ?? ''} onChange={set('notes')} placeholder="Optional" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
