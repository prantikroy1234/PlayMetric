import { useMemo, useState } from 'react';
import { Modal, Field } from '../../components/ui';
import { IconStar } from '../../components/Icons';

const req = (v) => !String(v ?? '').trim();

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="starpick" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`starpick__btn${n <= shown ? ' is-on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <IconStar width={26} height={26} fill={n <= shown ? 'currentColor' : 'none'} />
        </button>
      ))}
      <span className="starpick__val">{value}/5</span>
    </div>
  );
}

// Add / edit a review. A linked client auto-fills the author name; venue/sport
// are optional attributions used for filtering and venue ratings.
export default function ReviewForm({
  initial, orgs, clients, venues, sports, lockedOrgId, onSave, onDelete, onClose,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const orgClients = useMemo(() => clients.filter((c) => c.org_id === form.org_id), [clients, form.org_id]);
  const orgVenues = useMemo(() => venues.filter((v) => v.org_id === form.org_id), [venues, form.org_id]);
  const orgSports = useMemo(() => sports.filter((s) => s.org_id === form.org_id), [sports, form.org_id]);

  function onClientChange(e) {
    const client_id = e.target.value;
    const client = clients.find((c) => c.id === client_id);
    setForm((f) => ({
      ...f,
      client_id: client_id || null,
      author_name: client ? client.name : f.author_name,
    }));
    setErrors((prev) => ({ ...prev, author_name: undefined }));
  }

  function validate(f) {
    const e = {};
    if (req(f.org_id)) e.org_id = 'Choose an organisation';
    if (req(f.author_name)) e.author_name = 'Who wrote it?';
    if (req(f.body)) e.body = 'Add the review text';
    if (!f.rating || f.rating < 1 || f.rating > 5) e.rating = 'Pick a rating';
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
        rating: Number(form.rating),
        title: form.title?.trim() || null,
        body: form.body.trim(),
        author_name: form.author_name.trim(),
        client_id: form.client_id || null,
        venue_id: form.venue_id || null,
        sport_id: form.sport_id || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit review' : 'Add review'}
      subtitle="Record client feedback and venue ratings."
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
          <button type="submit" form="review-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Add review'}
          </button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="formgrid">
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

        <Field label="Status">
          <select value={form.status} onChange={set('status')}>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </Field>

        <div className="span-2">
          <Field label="Rating" required error={errors.rating}>
            <StarPicker value={Number(form.rating) || 0} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
          </Field>
        </div>

        <div className="span-2">
          <Field label="Title">
            <input value={form.title ?? ''} onChange={set('title')} placeholder="Superb tennis courts" />
          </Field>
        </div>

        <div className="span-2">
          <Field label="Review" required error={errors.body}>
            <textarea
              rows={3}
              value={form.body}
              onChange={set('body')}
              className={errors.body ? 'is-invalid' : ''}
              placeholder="What did they think?"
            />
          </Field>
        </div>

        <Field label="Linked client" hint="Optional — fills the author.">
          <select value={form.client_id ?? ''} onChange={onClientChange}>
            <option value="">None</option>
            {orgClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Author" required error={errors.author_name}>
          <input
            value={form.author_name}
            onChange={set('author_name')}
            className={errors.author_name ? 'is-invalid' : ''}
            placeholder="Rahul Sharma"
          />
        </Field>

        <Field label="Venue">
          <select value={form.venue_id ?? ''} onChange={set('venue_id')}>
            <option value="">Any venue</option>
            {orgVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>

        <Field label="Sport">
          <select value={form.sport_id ?? ''} onChange={set('sport_id')}>
            <option value="">Any sport</option>
            {orgSports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <div className="span-2">
          <Field label="Date">
            <input type="date" value={form.review_date} onChange={set('review_date')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
