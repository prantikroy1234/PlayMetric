import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  PageHeader, Modal, Field, EmptyState, SearchInline, ConfirmModal,
} from '../components/ui';
import {
  IconPlus, IconKey, IconEdit, IconTrash, IconChevronDown, IconChevronRight,
} from '../components/Icons';

// The catalogue is a strict 4-level hierarchy; a node's level is implied by
// its parent, so the form never asks for it.
const LEVELS = ['subsystem', 'module', 'submodule', 'action'];
const LEVEL_LABEL = {
  subsystem: 'Subsystem', module: 'Module', submodule: 'Submodule', action: 'Action',
};
const childLevel = (level) => LEVELS[LEVELS.indexOf(level) + 1] || null;

function ActionForm({ initial, parent, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAction = form.level === 'action';

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        code: isAction ? (form.code?.trim() || null) : null,
        description: form.description?.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? `Edit ${LEVEL_LABEL[form.level].toLowerCase()}` : `Add ${LEVEL_LABEL[form.level].toLowerCase()}`}
      subtitle={parent ? `Inside “${parent.name}”` : 'Top level of the catalogue.'}
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
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="action-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial.id ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      <form id="action-form" onSubmit={submit} className="formgrid">
        <div className="span-2">
          <Field label="Name" required error={error}>
            <input
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
              className={error ? 'is-invalid' : ''}
              placeholder={isAction ? 'View dashboard' : 'Booking Management'}
            />
          </Field>
        </div>

        {isAction && (
          <div className="span-2">
            <Field label="Action code" hint="The permission identifier roles reference, e.g. ac-207.">
              <input
                value={form.code ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="ac-207"
              />
            </Field>
          </div>
        )}

        <div className="span-2">
          <Field label="Description">
            <input
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </Field>
        </div>

        <Field label="Sort order">
          <input
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
          />
        </Field>
      </form>
    </Modal>
  );
}

export default function Actions() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [editingParent, setEditingParent] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setActions(await data.actions.list());
    } catch (err) {
      toast(err.message || 'Could not load actions', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const kids = useCallback(
    (parent) =>
      actions.filter((a) => a.parent_id === parent).sort((x, y) => x.sort_order - y.sort_order),
    [actions]
  );

  // A node survives search if it — or any descendant — matches.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const keep = new Set();
    const byId = Object.fromEntries(actions.map((a) => [a.id, a]));
    for (const a of actions) {
      if (`${a.name} ${a.code || ''}`.toLowerCase().includes(q)) {
        let cur = a;
        while (cur) { keep.add(cur.id); cur = cur.parent_id ? byId[cur.parent_id] : null; }
      }
    }
    return keep;
  }, [actions, query]);

  const toggleCollapse = (id) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  function openAdd(parent) {
    const level = parent ? childLevel(parent.level) : 'subsystem';
    if (!level) return;
    setEditingParent(parent);
    setEditing({
      parent_id: parent?.id ?? null,
      level,
      name: '',
      code: '',
      description: '',
      sort_order: parent ? kids(parent.id).length : kids(null).length,
      is_active: true,
    });
  }

  async function save(form) {
    const { id, ...rest } = form;
    try {
      if (id) await data.actions.update(id, rest);
      else await data.actions.create(rest);
      toast(id ? 'Saved' : 'Created');
      setEditing(null);
      setEditingParent(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await data.actions.remove(deleting.id);
      toast('Deleted');
      setDeleting(null);
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function Node({ node, depth }) {
    if (visible && !visible.has(node.id)) return null;
    const children = kids(node.id);
    const isOpen = !collapsed.has(node.id) || Boolean(visible);
    const next = childLevel(node.level);

    return (
      <>
        <div className={`actrow actrow--${node.level}`} style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}>
          <button
            className="actrow__toggle"
            onClick={() => children.length && toggleCollapse(node.id)}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            disabled={children.length === 0}
          >
            {children.length > 0
              ? (isOpen ? <IconChevronDown width={14} height={14} /> : <IconChevronRight width={14} height={14} />)
              : <span className="actrow__leaf" />}
          </button>

          <span className={`actlevel is-${node.level}`}>{LEVEL_LABEL[node.level]}</span>
          <span className="actrow__name">{node.name}</span>
          {node.code && <code className="permcode">{node.code}</code>}
          {node.description && <span className="actrow__desc">{node.description}</span>}

          {isPlatformAdmin && (
            <span className="actrow__tools">
              {next && (
                <button className="linkbtn" onClick={() => openAdd(node)} title={`Add ${LEVEL_LABEL[next].toLowerCase()}`}>
                  <IconPlus width={13} height={13} /> {LEVEL_LABEL[next]}
                </button>
              )}
              <button className="linkbtn" onClick={() => { setEditingParent(null); setEditing(node); }}>
                <IconEdit width={13} height={13} />
              </button>
              <button className="linkbtn linkbtn--danger" onClick={() => setDeleting(node)}>
                <IconTrash width={13} height={13} />
              </button>
            </span>
          )}
        </div>

        {isOpen && children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
      </>
    );
  }

  const roots = kids(null);

  return (
    <>
      <PageHeader
        title="Actions & Hierarchy"
        subtitle="Subsystem → Module → Submodule → Action codes that roles reference"
        actions={
          isPlatformAdmin && (
            <button className="btn btn--primary" onClick={() => openAdd(null)}>
              <IconPlus width={16} height={16} /> Add Subsystem
            </button>
          )
        }
      />

      <div className="toolbar">
        {!isPlatformAdmin && (
          <span className="cstat is-draft">Read-only — the catalogue is managed by PlayMetric</span>
        )}
        <span className="toolbar__spacer" />
        <SearchInline value={query} onChange={setQuery} placeholder="Search actions or codes…" />
      </div>

      <div className="card">
        {loading ? (
          <div className="dash-empty">Loading catalogue…</div>
        ) : roots.length === 0 ? (
          <EmptyState
            icon={<IconKey width={24} height={24} />}
            title="No actions defined"
            text="The capability catalogue is empty."
          />
        ) : (
          <div className="acttree">
            {roots.map((r) => <Node key={r.id} node={r} depth={0} />)}
          </div>
        )}
      </div>

      {editing && (
        <ActionForm
          initial={editing}
          parent={editingParent}
          onSave={save}
          onDelete={(n) => setDeleting(n)}
          onClose={() => { setEditing(null); setEditingParent(null); }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete “${deleting.name}”?`}
          message="Everything nested under it is removed too, along with any role permissions that referenced it."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </>
  );
}
