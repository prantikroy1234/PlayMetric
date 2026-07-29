import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, Modal, Field, EmptyState } from '../components/ui';
import { IconPlus, IconKey, IconTrash } from '../components/Icons';

const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* --------------------------- Add-role modal ---------------------------- */
function RoleForm({ orgs, lockedOrgId, isPlatformAdmin, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    org_id: lockedOrgId || (isPlatformAdmin ? '' : ''),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Give the role a name'); return; }
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        key: slug(form.name),
        description: form.description.trim() || null,
        org_id: form.org_id || null,
        is_system: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add role"
      subtitle="A custom role you can tailor in the permission matrix."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="role-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Create role'}
          </button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} className="formgrid">
        <div className="span-2">
          <Field label="Role name" required error={error}>
            <input
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
              className={error ? 'is-invalid' : ''}
              placeholder="Head Coach"
            />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What this role is for"
            />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Organisation" hint="Custom roles belong to one academy.">
            <select
              value={form.org_id}
              onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
              disabled={Boolean(lockedOrgId)}
            >
              <option value="">Select one…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Roles() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [roles, setRoles] = useState([]);
  const [actions, setActions] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r, a, p] = await Promise.all([
        data.organisations.list(),
        data.roles.list(),
        data.actions.list(),
        data.rolePermissions.list(),
      ]);
      setOrgs(o); setRoles(r); setActions(a); setPerms(p);
      setSelectedId((cur) => cur || r[0]?.id || '');
    } catch (err) {
      toast(err.message || 'Could not load roles', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = roles.find((r) => r.id === selectedId) || null;
  // System roles are the shared templates — only PlayMetric's team edits those.
  const canEdit = selected ? (selected.is_system ? isPlatformAdmin : true) : false;

  // Flat action rows → the Subsystem ▸ Module ▸ Submodule ▸ Action tree.
  const tree = useMemo(() => {
    const kids = (parent) =>
      actions
        .filter((a) => a.parent_id === parent)
        .sort((x, y) => x.sort_order - y.sort_order);
    return kids(null).map((sub) => ({
      ...sub,
      modules: kids(sub.id).map((mod) => ({
        ...mod,
        submodules: kids(mod.id).map((sm) => ({ ...sm, actions: kids(sm.id) })),
      })),
    }));
  }, [actions]);

  const allowed = useMemo(() => {
    const s = new Set();
    for (const p of perms) if (p.role_id === selectedId && p.allowed) s.add(p.action_id);
    return s;
  }, [perms, selectedId]);

  const grantedCount = allowed.size;
  const actionCount = actions.filter((a) => a.level === 'action').length;

  // Optimistic local update, then persist in one bulk write.
  async function toggle(actionIds, next) {
    if (!canEdit || !selected) return;
    const rows = actionIds.map((action_id) => ({ role_id: selected.id, action_id, allowed: next }));
    setPerms((cur) => {
      const map = new Map(cur.map((p) => [`${p.role_id}|${p.action_id}`, p]));
      for (const r of rows) map.set(`${r.role_id}|${r.action_id}`, r);
      return [...map.values()];
    });
    setSaving(true);
    try {
      await data.rolePermissions.setMany(rows);
    } catch (err) {
      toast(err.message || 'Could not save permission', 'error');
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createRole(payload) {
    try {
      const created = await data.roles.create(payload);
      toast('Role created');
      setAdding(false);
      await refresh();
      setSelectedId(created.id);
    } catch (err) {
      toast(err.message || 'Could not create role', 'error');
    }
  }

  async function deleteRole(role) {
    try {
      await data.roles.remove(role.id);
      toast('Role deleted');
      setSelectedId('');
      refresh();
    } catch (err) {
      toast(err.message || 'Could not delete role', 'error');
    }
  }

  const orgName = (id) => orgs.find((o) => o.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Configure fine-grained module access for team roles"
        actions={
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            <IconPlus width={16} height={16} /> Add Role
          </button>
        }
      />

      {loading ? (
        <div className="dash-empty">Loading roles…</div>
      ) : roles.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconKey width={24} height={24} />}
            title="No roles yet"
            text="Create a role, then choose which screens it may open."
          />
        </div>
      ) : (
        <div className="rolegrid">
          {/* Role picker */}
          <aside className="rolelist">
            {roles.map((r) => (
              <button
                key={r.id}
                className={`roleitem${r.id === selectedId ? ' is-active' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span className="roleitem__name">{r.name}</span>
                <span className="roleitem__meta">
                  {r.is_system ? 'System template' : orgName(r.org_id) || 'Custom'}
                </span>
              </button>
            ))}
          </aside>

          {/* Permission matrix */}
          <section className="rolematrix">
            {selected && (
              <>
                <header className="rolematrix__head">
                  <div>
                    <h2 className="rolematrix__title">{selected.name}</h2>
                    <p className="rolematrix__sub">
                      {selected.description || 'No description'} · {grantedCount}/{actionCount} actions
                      {saving && ' · saving…'}
                    </p>
                  </div>
                  {!canEdit && <span className="cstat is-draft">Read-only</span>}
                  {canEdit && !selected.is_system && (
                    <button className="linkbtn linkbtn--danger" onClick={() => deleteRole(selected)}>
                      <IconTrash width={14} height={14} /> Delete role
                    </button>
                  )}
                </header>

                {tree.map((sub) => (
                  <div key={sub.id} className="permsub">
                    <div className="permsub__label">{sub.name}</div>
                    {sub.modules.map((mod) => {
                      const modActions = mod.submodules.flatMap((sm) => sm.actions);
                      const on = modActions.filter((a) => allowed.has(a.id)).length;
                      const all = on === modActions.length && on > 0;
                      return (
                        <div key={mod.id} className="permmod">
                          <div className="permmod__head">
                            <label className="permcheck">
                              <input
                                type="checkbox"
                                checked={all}
                                ref={(el) => { if (el) el.indeterminate = on > 0 && !all; }}
                                disabled={!canEdit}
                                onChange={() => toggle(modActions.map((a) => a.id), !all)}
                              />
                              <strong>{mod.name}</strong>
                            </label>
                            <span className="permmod__count">{on}/{modActions.length}</span>
                          </div>
                          <div className="permmod__body">
                            {mod.submodules.map((sm) => (
                              <div key={sm.id} className="permgroup">
                                <div className="permgroup__label">{sm.name}</div>
                                <div className="permgroup__actions">
                                  {sm.actions.map((a) => (
                                    <label key={a.id} className="permcheck permcheck--action">
                                      <input
                                        type="checkbox"
                                        checked={allowed.has(a.id)}
                                        disabled={!canEdit}
                                        onChange={(e) => toggle([a.id], e.target.checked)}
                                      />
                                      <span>{a.name}</span>
                                      <code className="permcode">{a.code}</code>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      )}

      {adding && (
        <RoleForm
          orgs={orgs}
          lockedOrgId={!isPlatformAdmin && orgs.length === 1 ? orgs[0].id : null}
          isPlatformAdmin={isPlatformAdmin}
          onSave={createRole}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
