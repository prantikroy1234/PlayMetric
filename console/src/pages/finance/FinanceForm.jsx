import { useState } from 'react';
import { Modal, Field } from '../../components/ui';

export const CATEGORIES = {
  inflow: ['Bookings', 'Membership', 'Coaching', 'Events', 'Other'],
  outflow: ['Rent', 'Salaries', 'Utilities', 'Equipment', 'Maintenance', 'Marketing', 'Other'],
};
const METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const req = (v) => !String(v ?? '').trim();

// Add / edit a manual finance entry. The direction toggle re-scopes the
// category list (and resets category if it no longer belongs).
export default function FinanceForm({ initial, orgs, lockedOrgId, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function setDirection(dir) {
    setForm((f) => {
      const cats = CATEGORIES[dir];
      return { ...f, direction: dir, category: cats.includes(f.category) ? f.category : cats[0] };
    });
  }

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.category)) e.category = 'Pick a category';
    if (req(f.label)) e.label = 'Add a description';
    if (req(f.entry_date)) e.entry_date = 'Pick a date';
    if (f.amount === '' || f.amount == null) e.amount = 'Enter an amount';
    else if (Number.isNaN(Number(f.amount)) || Number(f.amount) < 0) e.amount = 'Must be a positive number';
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
        label: form.label.trim(),
        amount: Number(form.amount),
        method: form.method || null,
        notes: form.notes?.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  const cats = CATEGORIES[form.direction] || CATEGORIES.outflow;

  return (
    <Modal
      title={initial.id ? 'Edit entry' : 'Add entry'}
      subtitle="Record money in or out for this academy."
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
          <button type="submit" form="finance-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Add entry'}
          </button>
        </>
      }
    >
      <form id="finance-form" onSubmit={submit} className="formgrid">
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

        <Field label="Direction">
          <div className="segmented segmented--full">
            <button
              type="button"
              className={`segmented__btn${form.direction === 'inflow' ? ' is-active' : ''}`}
              onClick={() => setDirection('inflow')}
            >
              Inflow
            </button>
            <button
              type="button"
              className={`segmented__btn${form.direction === 'outflow' ? ' is-active' : ''}`}
              onClick={() => setDirection('outflow')}
            >
              Outflow
            </button>
          </div>
        </Field>

        <Field label="Category" required error={errors.category}>
          <select value={form.category} onChange={set('category')} className={errors.category ? 'is-invalid' : ''}>
            {cats.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Amount (₹)" required error={errors.amount}>
          <input
            type="number"
            min="0"
            step="any"
            value={form.amount ?? ''}
            onChange={set('amount')}
            className={errors.amount ? 'is-invalid' : ''}
            placeholder="5000"
          />
        </Field>

        <div className="span-2">
          <Field label="Description" required error={errors.label}>
            <input
              value={form.label}
              onChange={set('label')}
              className={errors.label ? 'is-invalid' : ''}
              placeholder="Venue rent — Sector 56"
            />
          </Field>
        </div>

        <Field label="Date" required error={errors.entry_date}>
          <input
            type="date"
            value={form.entry_date}
            onChange={set('entry_date')}
            className={errors.entry_date ? 'is-invalid' : ''}
          />
        </Field>

        <Field label="Method">
          <select value={form.method ?? ''} onChange={set('method')}>
            <option value="">Not set</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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
