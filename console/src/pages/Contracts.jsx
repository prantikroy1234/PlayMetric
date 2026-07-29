import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  PageHeader, TableSkeleton, EmptyState, SearchInline,
} from '../components/ui';
import { IconPlus, IconContract } from '../components/Icons';
import ContractForm from './contracts/ContractForm';
import { formatShortDate, daysUntil } from './bookings/dates';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const TYPE_LABEL = { lease: 'Lease', service: 'Service', sponsorship: 'Sponsorship', membership: 'Membership' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', expired: 'Expired', terminated: 'Terminated' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'expired', label: 'Expired' },
  { key: 'terminated', label: 'Terminated' },
];

const EXPIRY_WINDOW = 30; // days

const blankContract = (orgId) => ({
  org_id: orgId || '',
  client_id: null,
  title: '',
  counterparty: '',
  type: 'service',
  status: 'draft',
  start_date: '',
  end_date: '',
  value: '',
  notes: '',
});

// Amber "expiring soon" / red "expired" hint for active contracts.
function ExpiryHint({ contract }) {
  if (contract.status !== 'active' || !contract.end_date) return null;
  const d = daysUntil(contract.end_date);
  if (d < 0) return <span className="expiry is-past">Expired</span>;
  if (d <= EXPIRY_WINDOW) return <span className="expiry is-soon">{d === 0 ? 'Ends today' : `Expires in ${d}d`}</span>;
  return null;
}

export default function Contracts() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, cl, c] = await Promise.all([
        data.organisations.list(),
        data.clients.list(),
        data.contracts.list(),
      ]);
      setOrgs(o); setClients(cl); setContracts(c);
    } catch (err) {
      toast(err.message || 'Could not load contracts', 'error');
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
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts.filter(
      (c) =>
        (!orgId || c.org_id === orgId) &&
        (filter === 'all' || c.status === filter) &&
        (!q || `${c.title} ${c.counterparty}`.toLowerCase().includes(q))
    );
  }, [contracts, orgId, filter, query]);

  const activeValue = rows
    .filter((c) => c.status === 'active')
    .reduce((s, c) => s + Number(c.value || 0), 0);

  async function save(payload) {
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    try {
      if (id) {
        await data.contracts.update(id, rest);
        toast('Contract updated');
      } else {
        await data.contracts.create(rest);
        toast('Contract added');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(contract) {
    try {
      await data.contracts.remove(contract.id);
      toast('Contract deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Contracts & Agreements"
        subtitle="Manage all legal documents, leases, and service agreements"
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(blankContract(orgId))}>
            <IconPlus width={16} height={16} /> Add Contract
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
        <div className="segmented" role="tablist" aria-label="Status filter">
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
        <SearchInline value={query} onChange={setQuery} placeholder="Search contracts…" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Counterparty</th>
                <th>Status</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Value</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : (
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="finrow" onClick={() => setEditing(c)}>
                    <td>
                      <div className="cell-title">
                        {c.title}
                        {isPlatformAdmin && !orgId && orgById[c.org_id] && (
                          <span className="finrow__org"> · {orgById[c.org_id].name}</span>
                        )}
                      </div>
                      <div className="cell-sub">{TYPE_LABEL[c.type] || c.type}</div>
                    </td>
                    <td>
                      {c.counterparty}
                      {c.client_id && clientById[c.client_id] && (
                        <span className="linkchip" title="Linked to a client">client</span>
                      )}
                    </td>
                    <td>
                      <span className={`cstat is-${c.status}`}>{STATUS_LABEL[c.status] || c.status}</span>
                    </td>
                    <td>
                      <span className="cperiod">
                        {formatShortDate(c.start_date)} → {formatShortDate(c.end_date)}
                      </span>
                      <ExpiryHint contract={c} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            )}
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>
                    Active contract value ({rows.length} shown)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(activeValue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState
            icon={<IconContract width={24} height={24} />}
            title={query || filter !== 'all' ? 'No matching contracts' : 'No contracts yet'}
            text={
              query || filter !== 'all'
                ? 'Try a different filter or search term.'
                : 'Add your first lease, service agreement, or sponsorship.'
            }
            action={
              !query && filter === 'all' && (
                <button className="btn btn--primary" onClick={() => setEditing(blankContract(orgId))}>
                  <IconPlus width={16} height={16} /> Add Contract
                </button>
              )
            }
          />
        )}
      </div>

      {editing && (
        <ContractForm
          initial={editing}
          orgs={orgs}
          clients={clients}
          lockedOrgId={orgId && !isPlatformAdmin ? orgId : null}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
