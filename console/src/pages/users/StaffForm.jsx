import { useState } from 'react';
import { Modal, Field } from '../../components/ui';

const req = (v) => !String(v ?? '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Add / edit a console user. Staff fields live on `staff`; the organisation +
// role pairing lives on `org_members`, so the parent saves both.
export default function StaffForm({
  initial, orgs, roles, lockedOrgId, canSetPlatformAdmin, isNew, onSave, onDelete, onClose,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function validate(f) {
    const e = {};
    if (req(f.full_name)) e.full_name = 'Name is required';
    if (req(f.email)) e.email = 'Email is required';
    else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email';
    if (!f.is_platform_admin && req(f.org_id)) e.org_id = 'Choose an organisation';
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
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || null,
        employee_code: form.employee_code?.trim() || null,
        department: form.department?.trim() || 'General',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'Add user' : 'Edit user'}
      subtitle="Console access for a member of your team."
      onClose={onClose}
      footer={
        <>
          {!isNew && onDelete && (
            <button
              type="button"
              className="btn btn--danger btn--ghostdanger"
              onClick={() => onDelete(initial)}
              disabled={busy}
              style={{ marginRight: 'auto' }}
            >
              Remove
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="staff-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add user' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="formgrid">
        <Field label="Full name" required error={errors.full_name}>
          <input
            value={form.full_name}
            onChange={set('full_name')}
            className={errors.full_name ? 'is-invalid' : ''}
            placeholder="Ravi Kumar"
          />
        </Field>

        <Field label="Email" required error={errors.email} hint={isNew ? undefined : 'Used to sign in.'}>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            className={errors.email ? 'is-invalid' : ''}
            placeholder="ravi@academy.in"
          />
        </Field>

        <Field label="Employee code">
          <input value={form.employee_code ?? ''} onChange={set('employee_code')} placeholder="SPZ-01" />
        </Field>

        <Field label="Department">
          <input value={form.department ?? ''} onChange={set('department')} placeholder="Operations" />
        </Field>

        <Field label="Phone">
          <input value={form.phone ?? ''} onChange={set('phone')} placeholder="98110 10002" />
        </Field>

        <Field label="Role" hint="What this user may open in the console.">
          <select value={form.role_key ?? ''} onChange={set('role_key')}>
            {roles.map((r) => (
              <option key={r.id} value={r.key}>{r.name}</option>
            ))}
          </select>
        </Field>

        <div className="span-2">
          <Field
            label="Organisation"
            required={!form.is_platform_admin}
            error={errors.org_id}
            hint={form.is_platform_admin ? 'Platform admins see every organisation.' : undefined}
          >
            <select
              value={form.org_id ?? ''}
              onChange={set('org_id')}
              disabled={Boolean(lockedOrgId) || form.is_platform_admin}
              className={errors.org_id ? 'is-invalid' : ''}
            >
              <option value="">Select one…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {canSetPlatformAdmin && (
          <div className="span-2">
            <label className="checkrow">
              <input
                type="checkbox"
                checked={Boolean(form.is_platform_admin)}
                onChange={set('is_platform_admin')}
              />
              <span>
                <strong>Platform admin</strong>
                <small>PlayMetric’s own team — sees and administers every academy.</small>
              </span>
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
