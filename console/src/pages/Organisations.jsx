import { useEffect, useState } from 'react';
import { data } from '../lib/data';
import { useToast } from '../lib/toast';
import {
  PageHeader, Avatar, Chip, Field, Modal, ConfirmModal,
  EmptyState, TableSkeleton, SearchInline,
} from '../components/ui';
import { IconPlus, IconEdit, IconTrash, IconExternal, IconBuilding } from '../components/Icons';

const ACCENTS = ['cyan', 'violet', 'blue', 'green', 'amber'];
const SUBDOMAIN_RE = /^[a-zA-Z0-9-]+$/;

const blank = {
  name: '',
  subdomain: '',
  domain: '',
  code: '',
  office_location: '',
  accent: 'cyan',
};

function OrgForm({ initial, existing, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Only auto-derive the domain while the user hasn't hand-edited it.
  const [domainTouched, setDomainTouched] = useState(Boolean(initial?.domain));

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'subdomain' && !domainTouched) {
        next.domain = value ? `${value.toLowerCase()}.playmetric.in` : '';
      }
      return next;
    });
    setErrors((e2) => ({ ...e2, [key]: undefined }));
  };

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Organisation name is required';
    if (!form.subdomain.trim()) next.subdomain = 'Subdomain is required';
    else if (!SUBDOMAIN_RE.test(form.subdomain.trim()))
      next.subdomain = 'Letters, numbers and hyphens only';
    else {
      const clash = existing.find(
        (o) =>
          o.subdomain.toLowerCase() === form.subdomain.trim().toLowerCase() &&
          o.id !== initial?.id
      );
      if (clash) next.subdomain = `Already used by ${clash.name}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        subdomain: form.subdomain.trim(),
        domain: form.domain.trim() || `${form.subdomain.trim().toLowerCase()}.playmetric.in`,
        code: form.code.trim(),
        office_location: form.office_location.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? 'Edit organisation' : 'Add organisation'}
      subtitle="Company details, subdomain, and main office location."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="org-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create organisation'}
          </button>
        </>
      }
    >
      <form id="org-form" onSubmit={submit} className="formgrid">
        <div className="span-2">
          <Field label="Organisation name" required error={errors.name}>
            <input
              value={form.name}
              onChange={set('name')}
              className={errors.name ? 'is-invalid' : ''}
              placeholder="Sportizo"
            />
          </Field>
        </div>

        <Field label="Subdomain" required error={errors.subdomain}>
          <input
            value={form.subdomain}
            onChange={set('subdomain')}
            className={errors.subdomain ? 'is-invalid' : ''}
            placeholder="sportizo"
          />
        </Field>

        <Field label="Code / number">
          <input value={form.code} onChange={set('code')} placeholder="ORG-01" />
        </Field>

        <div className="span-2">
          <Field
            label="Domain link"
            hint="Auto-filled from the subdomain — edit if it differs."
          >
            <input
              value={form.domain}
              onChange={(e) => {
                setDomainTouched(true);
                set('domain')(e);
              }}
              placeholder="sportizo.playmetric.in"
            />
          </Field>
        </div>

        <div className="span-2">
          <Field label="Office location">
            <input
              value={form.office_location}
              onChange={set('office_location')}
              placeholder="Sector 56, Gurgaon"
            />
          </Field>
        </div>

        <Field label="Accent colour">
          <select value={form.accent} onChange={set('accent')}>
            {ACCENTS.map((a) => (
              <option key={a} value={a}>
                {a[0].toUpperCase() + a.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export default function Organisations() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // org | 'new' | null
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await data.organisations.list());
    } catch (err) {
      toast(err.message || 'Could not load organisations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = rows.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [o.name, o.subdomain, o.code, o.office_location]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  async function save(payload) {
    try {
      if (editing && editing !== 'new') {
        await data.organisations.update(editing.id, payload);
        toast(`${payload.name} updated`);
      } else {
        await data.organisations.create(payload);
        toast(`${payload.name} created`);
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await data.organisations.remove(deleting.id);
      toast(`${deleting.name} deleted`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Organisations Directory"
        subtitle="Manage company details, subdomains, and main office locations"
        actions={
          <button className="btn btn--primary" onClick={() => setEditing('new')}>
            <IconPlus width={16} height={16} /> Add Organisation
          </button>
        }
      />

      <div className="toolbar">
        <SearchInline value={query} onChange={setQuery} placeholder="Search organisations…" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Organisation info</th>
                <th>Subdomain</th>
                <th>Code / number</th>
                <th>Office location</th>
                <th>Domain link</th>
                <th className="cell-actions">Actions</th>
              </tr>
            </thead>

            {loading ? (
              <TableSkeleton cols={6} rows={3} />
            ) : (
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="cell-primary">
                        <Avatar name={o.name} accent={o.accent} />
                        <span className="cell-title">{o.name}</span>
                      </div>
                    </td>
                    <td>
                      <Chip mono>{o.subdomain}</Chip>
                    </td>
                    <td>{o.code || '—'}</td>
                    <td>{o.office_location || '—'}</td>
                    <td>
                      {o.domain ? (
                        <a
                          className="extlink"
                          href={`https://${o.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {o.domain} <IconExternal width={13} height={13} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="cell-actions">
                      <button className="linkbtn" onClick={() => setEditing(o)}>
                        <IconEdit width={14} height={14} /> Edit
                      </button>
                      <button className="linkbtn linkbtn--danger" onClick={() => setDeleting(o)}>
                        <IconTrash width={14} height={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {!loading && visible.length === 0 && (
          <EmptyState
            icon={<IconBuilding width={24} height={24} />}
            title={query ? 'No matches' : 'No organisations yet'}
            text={
              query
                ? 'Try a different search term.'
                : 'Add your first organisation to start configuring venues and sports.'
            }
            action={
              !query && (
                <button className="btn btn--primary" onClick={() => setEditing('new')}>
                  <IconPlus width={16} height={16} /> Add Organisation
                </button>
              )
            }
          />
        )}
      </div>

      {editing && (
        <OrgForm
          initial={editing === 'new' ? null : editing}
          existing={rows}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          message="This also removes every venue, sport, court and time slot belonging to this organisation. This cannot be undone."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </>
  );
}
