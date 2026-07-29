import { useMemo, useState } from 'react';
import { Modal, Field } from '../../components/ui';

export const TYPES = [
  { value: 'lease', label: 'Lease' },
  { value: 'service', label: 'Service' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'membership', label: 'Membership' },
];
export const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

const req = (v) => !String(v ?? '').trim();

// Add / edit a contract. Picking a linked client auto-fills the counterparty,
// but counterparty stays editable for landlords/vendors/sponsors who aren't
// clients.
export default function ContractForm({
  initial, orgs, clients, lockedOrgId, onSave, onDelete, onClose,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const orgClients = useMemo(
    () => clients.filter((c) => c.org_id === form.org_id),
    [clients, form.org_id]
  );

  function onClientChange(e) {
    const client_id = e.target.value;
    const client = clients.find((c) => c.id === client_id);
    setForm((f) => ({
      ...f,
      client_id: client_id || null,
      counterparty: client ? client.name : f.counterparty,
    }));
    setErrors((prev) => ({ ...prev, counterparty: undefined }));
  }

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.title)) e.title = 'Give the contract a title';
    if (req(f.counterparty)) e.counterparty = 'Who is it with?';
    if (f.start_date && f.end_date && f.end_date < f.start_date)
      e.end_date = 'End must be on or after start';
    if (f.value !== '' && f.value != null && Number(f.value) < 0)
      e.value = 'Value cannot be negative';
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
        counterparty: form.counterparty.trim(),
        client_id: form.client_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        value: form.value === '' || form.value == null ? 0 : Number(form.value),
        notes: form.notes?.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit contract' : 'Add contract'}
      subtitle="A lease, service agreement, sponsorship, or membership."
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
          <button type="submit" form="contract-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Add contract'}
          </button>
        </>
      }
    >
      <form id="contract-form" onSubmit={submit} className="formgrid">
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
          <Field label="Title" required error={errors.title}>
            <input
              value={form.title}
              onChange={set('title')}
              className={errors.title ? 'is-invalid' : ''}
              placeholder="Venue Lease — Sector 56"
            />
          </Field>
        </div>

        <Field label="Linked client" hint="Optional — fills the counterparty.">
          <select value={form.client_id ?? ''} onChange={onClientChange}>
            <option value="">None</option>
            {orgClients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Counterparty" required error={errors.counterparty}>
          <input
            value={form.counterparty}
            onChange={set('counterparty')}
            className={errors.counterparty ? 'is-invalid' : ''}
            placeholder="Sector 56 Realty"
          />
        </Field>

        <Field label="Status">
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Value (₹)" error={errors.value}>
          <input
            type="number"
            min="0"
            step="any"
            value={form.value ?? ''}
            onChange={set('value')}
            className={errors.value ? 'is-invalid' : ''}
            placeholder="120000"
          />
        </Field>

        <Field label="Start date">
          <input type="date" value={form.start_date ?? ''} onChange={set('start_date')} />
        </Field>

        <Field label="End date" error={errors.end_date}>
          <input
            type="date"
            value={form.end_date ?? ''}
            onChange={set('end_date')}
            className={errors.end_date ? 'is-invalid' : ''}
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
