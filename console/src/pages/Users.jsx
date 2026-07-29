import { useCallback, useEffect, useMemo, useState } from 'react';
import { data, dataMode } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  PageHeader, Avatar, Modal, TableSkeleton, EmptyState, SearchInline,
} from '../components/ui';
import { IconPlus, IconUser } from '../components/Icons';
import StaffForm from './users/StaffForm';

const blankStaff = (orgId) => ({
  full_name: '',
  email: '',
  phone: '',
  employee_code: '',
  department: 'General',
  is_platform_admin: false,
  org_id: orgId || '',
  role_key: 'employee',
});

// In Supabase mode `staff.id` is a FK to auth.users, so a staff row can't exist
// before the person has an account. Rather than fail on save, explain the flow.
function InviteInfoModal({ onClose }) {
  return (
    <Modal
      title="Adding a user"
      subtitle="How console access is granted."
      onClose={onClose}
      footer={<button className="btn btn--ghost" onClick={onClose}>Got it</button>}
    >
      <div className="importstub">
        <p className="importstub__note">
          Every console user is backed by a real login, so a user record can only be created
          <strong> after they have an account</strong>. Two ways to do that:
        </p>
        <ol className="invite-steps">
          <li>Ask them to sign up on the sign-in page with their work email, or</li>
          <li>Create the account in Supabase → <strong>Authentication → Users → Add user</strong>.</li>
        </ol>
        <p className="importstub__note">
          They’ll then appear in this list, where you can set their role, department, and
          organisation. (In the local demo, users can be added directly.)
        </p>
      </div>
    </Modal>
  );
}

export default function Users() {
  const { isPlatformAdmin, staff: me } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [inviteInfo, setInviteInfo] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s, m, r] = await Promise.all([
        data.organisations.list(),
        data.staff.list(),
        data.orgMembers.list(),
        data.roles.list(),
      ]);
      setOrgs(o); setStaff(s); setMembers(m); setRoles(r);
    } catch (err) {
      toast(err.message || 'Could not load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const showOrgPicker = isPlatformAdmin || orgs.length > 1;
  useEffect(() => {
    if (!isPlatformAdmin && !orgId && orgs.length) setOrgId(orgs[0].id);
  }, [isPlatformAdmin, orgId, orgs]);

  const orgById = useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o])), [orgs]);
  const roleByKey = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r])), [roles]);
  // One membership per person is what the UI models (their "home" academy).
  const memberByStaff = useMemo(
    () => Object.fromEntries(members.map((m) => [m.staff_id, m])),
    [members]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .map((s) => {
        const m = memberByStaff[s.id];
        return { ...s, membership: m, org_id: m?.org_id ?? null, role_key: m?.role_key ?? null };
      })
      .filter((s) => {
        // Platform admins belong to no single org, so they always show.
        if (orgId && !s.is_platform_admin && s.org_id !== orgId) return false;
        if (!q) return true;
        return `${s.full_name} ${s.email} ${s.employee_code || ''} ${s.department || ''}`
          .toLowerCase()
          .includes(q);
      });
  }, [staff, memberByStaff, orgId, query]);

  // Keep a staff member's single org_members row in step with the form.
  async function syncMembership(staffId, orgIdNext, roleKey) {
    const existing = memberByStaff[staffId];
    if (!orgIdNext) {
      if (existing) await data.orgMembers.remove(existing.id);
      return;
    }
    if (existing) {
      if (existing.org_id !== orgIdNext || existing.role_key !== roleKey)
        await data.orgMembers.update(existing.id, { org_id: orgIdNext, role_key: roleKey });
    } else {
      await data.orgMembers.create({ org_id: orgIdNext, staff_id: staffId, role_key: roleKey });
    }
  }

  async function save(form) {
    const { id, org_id, role_key, ...fields } = form;
    // Derived-only columns that live on org_members, not staff.
    delete fields.membership;
    try {
      let staffId = id;
      if (id) {
        await data.staff.update(id, fields);
      } else {
        const created = await data.staff.create(fields);
        staffId = created.id;
      }
      await syncMembership(staffId, org_id, role_key || 'employee');
      toast(id ? 'User updated' : 'User added');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(row) {
    if (row.id === me?.id) {
      toast('You cannot remove your own account', 'error');
      return;
    }
    try {
      const m = memberByStaff[row.id];
      if (m) await data.orgMembers.remove(m.id);
      await data.staff.remove(row.id);
      toast('User removed');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Remove failed', 'error');
    }
  }

  function onAdd() {
    if (dataMode === 'supabase') setInviteInfo(true);
    else setEditing(blankStaff(orgId));
  }

  return (
    <>
      <PageHeader
        title="Users & Staff"
        subtitle="Manage roles, permissions, and internal team access"
        actions={
          <button className="btn btn--primary" onClick={onAdd}>
            <IconPlus width={16} height={16} /> Add User
          </button>
        }
      />

      <div className="toolbar">
        {showOrgPicker && (
          <select
            className="select-inline"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            aria-label="Organisation"
          >
            {isPlatformAdmin && <option value="">All Organisations</option>}
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <span className="toolbar__spacer" />
        <SearchInline value={query} onChange={setQuery} placeholder="Search users…" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Employee code</th>
                <th>Department</th>
                <th>Organisation</th>
                <th>Role</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : (
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="finrow" onClick={() => setEditing(s)}>
                    <td>
                      <div className="cell-primary">
                        <Avatar name={s.full_name} />
                        <div>
                          <div className="cell-title">
                            {s.full_name}
                            {s.id === me?.id && <span className="linkchip">you</span>}
                          </div>
                          <div className="cell-sub">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{s.employee_code || '—'}</td>
                    <td>{s.department || '—'}</td>
                    <td>
                      {s.is_platform_admin
                        ? <span className="ctype is-corporate">All organisations</span>
                        : (orgById[s.org_id]?.name || '—')}
                    </td>
                    <td>
                      {s.is_platform_admin
                        ? <span className="cstat is-active">Platform admin</span>
                        : s.role_key
                          ? <span className="ctype is-individual">{roleByKey[s.role_key]?.name || s.role_key}</span>
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState
            icon={<IconUser width={24} height={24} />}
            title={query ? 'No matching users' : 'No users yet'}
            text={
              query
                ? 'Try a different search term.'
                : 'Console users appear here once they have an account.'
            }
            action={
              !query && (
                <button className="btn btn--primary" onClick={onAdd}>
                  <IconPlus width={16} height={16} /> Add User
                </button>
              )
            }
          />
        )}
      </div>

      {editing && (
        <StaffForm
          initial={editing}
          isNew={!editing.id}
          orgs={orgs}
          roles={roles}
          lockedOrgId={orgId && !isPlatformAdmin ? orgId : null}
          canSetPlatformAdmin={isPlatformAdmin}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}

      {inviteInfo && <InviteInfoModal onClose={() => setInviteInfo(false)} />}
    </>
  );
}
