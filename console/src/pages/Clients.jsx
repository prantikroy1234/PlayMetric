import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  PageHeader, Avatar, TableSkeleton, EmptyState, SearchInline,
} from '../components/ui';
import { IconPlus, IconUsers } from '../components/Icons';
import ClientForm from './clients/ClientForm';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const TYPE_LABEL = { individual: 'Individual', team: 'Team', corporate: 'Corporate' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'individual', label: 'Individuals' },
  { key: 'team', label: 'Teams' },
  { key: 'corporate', label: 'Corporate' },
];

const blankClient = (orgId) => ({
  org_id: orgId || '',
  name: '',
  type: 'individual',
  phone: '',
  email: '',
  notes: '',
});

export default function Clients() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, b] = await Promise.all([
        data.organisations.list(),
        data.clients.list(),
        data.bookings.list(),
      ]);
      setOrgs(o); setClients(c); setBookings(b);
    } catch (err) {
      toast(err.message || 'Could not load clients', 'error');
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

  // LTV + booking count are derived by matching booking.client_name within the
  // same org (bookings are free-text today; a client_id FK is the future fix).
  const stats = useMemo(() => {
    const m = {};
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      const key = `${b.org_id}::${(b.client_name || '').trim().toLowerCase()}`;
      if (!m[key]) m[key] = { count: 0, ltv: 0 };
      m[key].count += 1;
      m[key].ltv += Number(b.amount || 0);
    }
    return m;
  }, [bookings]);
  const statFor = (c) => stats[`${c.org_id}::${c.name.trim().toLowerCase()}`] || { count: 0, ltv: 0 };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter(
        (c) =>
          (!orgId || c.org_id === orgId) &&
          (filter === 'all' || c.type === filter) &&
          (!q || `${c.name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q))
      )
      .map((c) => ({ ...c, ...statFor(c) }))
      .sort((a, b) => b.ltv - a.ltv || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, orgId, filter, query, stats]);

  async function save(payload) {
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    delete rest.count;
    delete rest.ltv;
    try {
      if (id) {
        await data.clients.update(id, rest);
        toast('Client updated');
      } else {
        await data.clients.create(rest);
        toast('Client added');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(client) {
    try {
      await data.clients.remove(client.id);
      toast('Client deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  const totalLtv = rows.reduce((s, r) => s + r.ltv, 0);

  return (
    <>
      <PageHeader
        title="Client Directory"
        subtitle="Manage individual players, teams, and corporate accounts"
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(blankClient(orgId))}>
            <IconPlus width={16} height={16} /> Add Client
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
        <div className="segmented" role="tablist" aria-label="Client type filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`segmented__btn${filter === f.key ? ' is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="toolbar__spacer" />
        <SearchInline value={query} onChange={setQuery} placeholder="Search clients…" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Phone</th>
                <th style={{ textAlign: 'right' }}>Bookings</th>
                <th style={{ textAlign: 'right' }}>Lifetime value</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : (
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="finrow" onClick={() => setEditing(c)}>
                    <td>
                      <div className="cell-primary">
                        <Avatar name={c.name} />
                        <div>
                          <div className="cell-title">
                            {c.name}
                            {isPlatformAdmin && !orgId && orgById[c.org_id] && (
                              <span className="finrow__org"> · {orgById[c.org_id].name}</span>
                            )}
                          </div>
                          {c.email && <div className="cell-sub">{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`ctype is-${c.type}`}>{TYPE_LABEL[c.type] || c.type}</span>
                    </td>
                    <td>{c.phone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(c.ltv)}</td>
                  </tr>
                ))}
              </tbody>
            )}
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>
                    Total lifetime value ({rows.length})
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(totalLtv)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState
            icon={<IconUsers width={24} height={24} />}
            title={query || filter !== 'all' ? 'No matching clients' : 'No clients yet'}
            text={
              query || filter !== 'all'
                ? 'Try a different filter or search term.'
                : 'Add your first client to start tracking bookings and lifetime value.'
            }
            action={
              !query && filter === 'all' && (
                <button className="btn btn--primary" onClick={() => setEditing(blankClient(orgId))}>
                  <IconPlus width={16} height={16} /> Add Client
                </button>
              )
            }
          />
        )}
      </div>

      {editing && (
        <ClientForm
          initial={editing}
          orgs={orgs}
          lockedOrgId={orgId && !isPlatformAdmin ? orgId : null}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
