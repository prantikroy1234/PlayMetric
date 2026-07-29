import { useMemo, useState } from 'react';
import { Modal, Field } from '../../components/ui';

const STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const req = (v) => !String(v ?? '').trim();

// Create / edit a manual booking. Selecting a court auto-fills its venue and
// sport, but both stay editable in case the court was reconfigured later.
export default function BookingForm({
  initial, orgs, venues, courts, sports, lockedOrgId, onSave, onDelete, onClose,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const orgVenues = useMemo(
    () => venues.filter((v) => v.org_id === form.org_id),
    [venues, form.org_id]
  );
  const orgCourts = useMemo(
    () =>
      courts.filter(
        (c) => c.org_id === form.org_id && (!form.venue_id || c.venue_id === form.venue_id)
      ),
    [courts, form.org_id, form.venue_id]
  );
  const orgSports = useMemo(
    () => sports.filter((s) => s.org_id === form.org_id),
    [sports, form.org_id]
  );

  // Picking a court pulls its venue + sport across so the row is consistent.
  function onCourtChange(e) {
    const court_id = e.target.value;
    const court = courts.find((c) => c.id === court_id);
    setForm((f) => ({
      ...f,
      court_id,
      venue_id: court?.venue_id ?? f.venue_id,
      sport_id: court?.sport_id ?? f.sport_id,
    }));
    setErrors((prev) => ({ ...prev, court_id: undefined }));
  }

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.client_name)) e.client_name = 'Client name is required';
    if (req(f.booking_date)) e.booking_date = 'Pick a date';
    if (req(f.start_time)) e.start_time = 'Required';
    if (req(f.end_time)) e.end_time = 'Required';
    if (f.start_time && f.end_time && f.end_time <= f.start_time)
      e.end_time = 'End must be after start';
    if (f.amount !== '' && f.amount != null && Number(f.amount) < 0)
      e.amount = 'Amount cannot be negative';
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
        client_name: form.client_name.trim(),
        client_phone: form.client_phone?.trim() || null,
        venue_id: form.venue_id || null,
        court_id: form.court_id || null,
        sport_id: form.sport_id || null,
        amount: form.amount === '' || form.amount == null ? 0 : Number(form.amount),
        notes: form.notes?.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit booking' : 'New booking'}
      subtitle="Manually record a court reservation."
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
          <button type="submit" form="booking-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Create booking'}
          </button>
        </>
      }
    >
      <form id="booking-form" onSubmit={submit} className="formgrid">
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

        <Field label="Status">
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Venue">
          <select value={form.venue_id ?? ''} onChange={set('venue_id')}>
            <option value="">Any venue</option>
            {orgVenues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Court">
          <select value={form.court_id ?? ''} onChange={onCourtChange}>
            <option value="">Unassigned</option>
            {orgCourts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <div className="span-2">
          <Field label="Sport">
            <select value={form.sport_id ?? ''} onChange={set('sport_id')}>
              <option value="">Not set</option>
              {orgSports.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Date" required error={errors.booking_date}>
          <input
            type="date"
            value={form.booking_date}
            onChange={set('booking_date')}
            className={errors.booking_date ? 'is-invalid' : ''}
          />
        </Field>

        <Field label="Amount (₹)" error={errors.amount}>
          <input
            type="number"
            min="0"
            step="any"
            value={form.amount ?? ''}
            onChange={set('amount')}
            className={errors.amount ? 'is-invalid' : ''}
            placeholder="500"
          />
        </Field>

        <Field label="Start time" required error={errors.start_time}>
          <input
            type="time"
            value={form.start_time}
            onChange={set('start_time')}
            className={errors.start_time ? 'is-invalid' : ''}
          />
        </Field>

        <Field label="End time" required error={errors.end_time}>
          <input
            type="time"
            value={form.end_time}
            onChange={set('end_time')}
            className={errors.end_time ? 'is-invalid' : ''}
          />
        </Field>

        <Field label="Client name" required error={errors.client_name}>
          <input
            value={form.client_name}
            onChange={set('client_name')}
            className={errors.client_name ? 'is-invalid' : ''}
            placeholder="Rahul Sharma"
          />
        </Field>

        <Field label="Client phone">
          <input
            value={form.client_phone ?? ''}
            onChange={set('client_phone')}
            placeholder="98110 22001"
          />
        </Field>

        <div className="span-2">
          <Field label="Notes">
            <input
              value={form.notes ?? ''}
              onChange={set('notes')}
              placeholder="Optional — e.g. coaching session, 4 players"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
