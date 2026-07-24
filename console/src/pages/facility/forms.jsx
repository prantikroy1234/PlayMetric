import { useState } from 'react';
import { Modal, Field } from '../../components/ui';

/* Shared wrapper: identical modal chrome + submit handling for every entity. */
function FormShell({ title, subtitle, initial, onClose, onSave, validate, children }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="entity-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit} className="formgrid">
        {children({ form, set, errors, setForm })}
      </form>
    </Modal>
  );
}

function OrgSelect({ form, set, errors, orgs, lockedOrgId }) {
  return (
    <Field label="Organisation" required error={errors.org_id}>
      <select
        value={form.org_id}
        onChange={set('org_id')}
        disabled={Boolean(lockedOrgId)}
        className={errors.org_id ? 'is-invalid' : ''}
      >
        <option value="">Select one…</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

const req = (v) => !String(v ?? '').trim();

/* ------------------------------- Venue -------------------------------- */
export function VenueForm({ initial, orgs, lockedOrgId, onSave, onClose }) {
  return (
    <FormShell
      title={initial.id ? 'Edit venue' : 'Add venue'}
      subtitle="A physical site belonging to an organisation."
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      validate={(f) => {
        const e = {};
        if (req(f.org_id)) e.org_id = 'Choose an organisation';
        if (req(f.name)) e.name = 'Venue name is required';
        return e;
      }}
    >
      {({ form, set, errors }) => (
        <>
          <OrgSelect form={form} set={set} errors={errors} orgs={orgs} lockedOrgId={lockedOrgId} />
          <Field label="Venue name" required error={errors.name}>
            <input
              value={form.name}
              onChange={set('name')}
              className={errors.name ? 'is-invalid' : ''}
              placeholder="Indoor Badminton"
            />
          </Field>
          <div className="span-2">
            <Field label="Location">
              <input value={form.location} onChange={set('location')} placeholder="Sector 56, Gurgaon" />
            </Field>
          </div>
        </>
      )}
    </FormShell>
  );
}

/* ------------------------------- Sport -------------------------------- */
export function SportForm({ initial, orgs, venues, lockedOrgId, onSave, onClose }) {
  return (
    <FormShell
      title={initial.id ? 'Edit sport' : 'Add sport'}
      subtitle="Configure a sport and link it to a venue."
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      validate={(f) => {
        const e = {};
        if (req(f.org_id)) e.org_id = 'Choose an organisation';
        if (req(f.name)) e.name = 'Sport name is required';
        return e;
      }}
    >
      {({ form, set, errors }) => {
        const orgVenues = venues.filter((v) => v.org_id === form.org_id);
        return (
          <>
            <OrgSelect form={form} set={set} errors={errors} orgs={orgs} lockedOrgId={lockedOrgId} />
            <Field label="Sport name" required error={errors.name}>
              <input
                value={form.name}
                onChange={set('name')}
                className={errors.name ? 'is-invalid' : ''}
                placeholder="Badminton"
              />
            </Field>
            <div className="span-2">
              <Field
                label="Venue"
                hint={
                  form.org_id && orgVenues.length === 0
                    ? 'This organisation has no venues yet — add one first.'
                    : 'Optional: a sport can exist before it is pinned to a venue.'
                }
              >
                <select value={form.venue_id ?? ''} onChange={set('venue_id')}>
                  <option value="">Not linked</option>
                  {orgVenues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        );
      }}
    </FormShell>
  );
}

/* ------------------------------- Court -------------------------------- */
export function CourtForm({ initial, orgs, venues, sports, lockedOrgId, onSave, onClose }) {
  return (
    <FormShell
      title={initial.id ? 'Edit court' : 'Add court'}
      subtitle="A bookable surface inside a venue."
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      validate={(f) => {
        const e = {};
        if (req(f.org_id)) e.org_id = 'Choose an organisation';
        if (req(f.venue_id)) e.venue_id = 'Choose a venue';
        if (req(f.name)) e.name = 'Court name is required';
        if (f.capacity && (Number.isNaN(Number(f.capacity)) || Number(f.capacity) < 0))
          e.capacity = 'Capacity must be a positive number';
        return e;
      }}
    >
      {({ form, set, errors }) => {
        const orgVenues = venues.filter((v) => v.org_id === form.org_id);
        const orgSports = sports.filter(
          (s) => s.org_id === form.org_id && (!form.venue_id || !s.venue_id || s.venue_id === form.venue_id)
        );
        return (
          <>
            <OrgSelect form={form} set={set} errors={errors} orgs={orgs} lockedOrgId={lockedOrgId} />
            <Field label="Venue" required error={errors.venue_id}>
              <select
                value={form.venue_id ?? ''}
                onChange={set('venue_id')}
                className={errors.venue_id ? 'is-invalid' : ''}
              >
                <option value="">Select one…</option>
                {orgVenues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Court name" required error={errors.name}>
              <input
                value={form.name}
                onChange={set('name')}
                className={errors.name ? 'is-invalid' : ''}
                placeholder="Badminton Court 1"
              />
            </Field>
            <Field label="Sport">
              <select value={form.sport_id ?? ''} onChange={set('sport_id')}>
                <option value="">Not set</option>
                {orgSports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Surface">
              <input value={form.surface ?? ''} onChange={set('surface')} placeholder="Synthetic" />
            </Field>
            <Field label="Capacity" error={errors.capacity}>
              <input
                type="number"
                min="0"
                value={form.capacity ?? ''}
                onChange={set('capacity')}
                className={errors.capacity ? 'is-invalid' : ''}
                placeholder="4"
              />
            </Field>
          </>
        );
      }}
    </FormShell>
  );
}

/* ----------------------------- Time slot ------------------------------ */
export function TimeSlotForm({ initial, orgs, lockedOrgId, onSave, onClose }) {
  return (
    <FormShell
      title={initial.id ? 'Edit time slot' : 'Create time slot'}
      subtitle="Global scheduling and booking interval for an organisation."
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      validate={(f) => {
        const e = {};
        if (req(f.org_id)) e.org_id = 'Choose an organisation';
        if (req(f.label)) e.label = 'Give the slot a name';
        if (req(f.start_time)) e.start_time = 'Required';
        if (req(f.end_time)) e.end_time = 'Required';
        if (f.start_time && f.end_time && f.end_time <= f.start_time)
          e.end_time = 'End must be after start';
        return e;
      }}
    >
      {({ form, set, errors }) => (
        <>
          <OrgSelect form={form} set={set} errors={errors} orgs={orgs} lockedOrgId={lockedOrgId} />
          <Field label="Slot name" required error={errors.label}>
            <input
              value={form.label}
              onChange={set('label')}
              className={errors.label ? 'is-invalid' : ''}
              placeholder="Evening Peak"
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
        </>
      )}
    </FormShell>
  );
}
