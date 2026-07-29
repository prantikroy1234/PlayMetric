import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  PageHeader, Modal, Chip, TableSkeleton, EmptyState, SearchInline,
} from '../components/ui';
import { IconPlus, IconWallet, IconExternal, IconChart } from '../components/Icons';
import FinanceForm from './finance/FinanceForm';
import Overview from './finance/Overview';
import { todayISO } from './bookings/dates';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const blankEntry = (orgId) => ({
  org_id: orgId || '',
  direction: 'outflow',
  category: 'Rent',
  label: '',
  amount: '',
  entry_date: todayISO(),
  method: '',
  notes: '',
});

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'inflow', label: 'Inflow' },
  { key: 'outflow', label: 'Outflow' },
];

// Client-side CSV export of whatever rows are currently in view.
function exportCSV(rows) {
  const headers = ['Date', 'Direction', 'Category', 'Description', 'Method', 'Amount'];
  const esc = (cell) => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) =>
    [r.entry_date, r.direction, r.category, r.label, r.method || '', r.amount].map(esc).join(',')
  );
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Honest "coming soon" import — the parser lands with the integrations work.
function ImportModal({ onClose }) {
  return (
    <Modal
      title="Import from CSV"
      subtitle="Bulk-load entries from a spreadsheet export."
      onClose={onClose}
      footer={
        <button className="btn btn--ghost" onClick={onClose}>Close</button>
      }
    >
      <div className="importstub">
        <input type="file" accept=".csv" disabled />
        <p className="importstub__note">
          CSV import isn’t wired up yet — it arrives with the Hudle/Playo/District sync so the
          same parser can be reused. For now, add entries manually or export what you have.
        </p>
      </div>
    </Modal>
  );
}

export default function Financials() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [subtab, setSubtab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, e] = await Promise.all([
        data.organisations.list(),
        data.financeEntries.list(),
      ]);
      setOrgs(o);
      setEntries(e);
    } catch (err) {
      toast(err.message || 'Could not load financials', 'error');
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

  // Org-only scope powers the Overview (all directions, no ledger search/filter).
  const orgScoped = useMemo(
    () => entries.filter((e) => !orgId || e.org_id === orgId),
    [entries, orgId]
  );

  // Org + search scope for the summary cards (independent of the direction toggle).
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!orgId || e.org_id === orgId) &&
        (!q || `${e.category} ${e.label} ${e.method || ''}`.toLowerCase().includes(q))
    );
  }, [entries, orgId, query]);

  const totals = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const e of scoped) {
      if (e.direction === 'inflow') inflow += Number(e.amount || 0);
      else outflow += Number(e.amount || 0);
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [scoped]);

  // Table rows additionally honour the direction toggle.
  const rows = useMemo(
    () => (filter === 'all' ? scoped : scoped.filter((e) => e.direction === filter)),
    [scoped, filter]
  );

  async function save(payload) {
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    delete rest.is_active;
    try {
      if (id) {
        await data.financeEntries.update(id, rest);
        toast('Entry updated');
      } else {
        await data.financeEntries.create(rest);
        toast('Entry added');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(entry) {
    try {
      await data.financeEntries.remove(entry.id);
      toast('Entry deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Financial Management"
        subtitle="Aggregated at Business Level"
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setImporting(true)}>
              Import CSV
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => exportCSV(rows)}
              disabled={rows.length === 0}
            >
              <IconExternal width={15} height={15} /> Export
            </button>
            <button className="btn btn--primary" onClick={() => setEditing(blankEntry(orgId))}>
              <IconPlus width={16} height={16} /> Add Entry
            </button>
          </>
        }
      />

      <div className="subtabs">
        <button
          className={`subtab${subtab === 'overview' ? ' is-active' : ''}`}
          onClick={() => setSubtab('overview')}
        >
          <IconChart width={15} height={15} /> Overview
        </button>
        <button
          className={`subtab${subtab === 'ledger' ? ' is-active' : ''}`}
          onClick={() => setSubtab('ledger')}
        >
          <IconWallet width={15} height={15} /> Ledger
        </button>
      </div>

      {(showOrgPicker || subtab === 'ledger') && (
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
          {subtab === 'ledger' && (
            <>
              <div className="segmented" role="tablist" aria-label="Direction filter">
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
              <SearchInline value={query} onChange={setQuery} placeholder="Search entries…" />
            </>
          )}
        </div>
      )}

      {subtab === 'overview' ? (
        loading ? (
          <div className="dash-empty">Loading overview…</div>
        ) : (
          <Overview entries={orgScoped} />
        )
      ) : (
        <>
          <div className="statgrid">
            <div className="statcard statcard--in">
              <span className="statcard__label">Total Inflow</span>
              <span className="statcard__value">{money(totals.inflow)}</span>
            </div>
            <div className="statcard statcard--out">
              <span className="statcard__label">Total Outflow</span>
              <span className="statcard__value">{money(totals.outflow)}</span>
            </div>
            <div className={`statcard ${totals.net >= 0 ? 'statcard--in' : 'statcard--out'}`}>
              <span className="statcard__label">Net Balance</span>
              <span className="statcard__value">
                {totals.net < 0 ? '−' : ''}{money(Math.abs(totals.net))}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Method</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                {loading ? (
                  <TableSkeleton cols={6} rows={5} />
                ) : (
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="finrow" onClick={() => setEditing(e)}>
                        <td>{e.entry_date}</td>
                        <td><Chip>{e.category}</Chip></td>
                        <td className="cell-title">
                          {e.label}
                          {isPlatformAdmin && !orgId && orgById[e.org_id] && (
                            <span className="finrow__org"> · {orgById[e.org_id].name}</span>
                          )}
                        </td>
                        <td>{e.method || '—'}</td>
                        <td>
                          <span className={`fin-tag ${e.direction === 'inflow' ? 'is-in' : 'is-out'}`}>
                            {e.direction === 'inflow' ? 'Inflow' : 'Outflow'}
                          </span>
                        </td>
                        <td
                          style={{ textAlign: 'right', fontWeight: 600 }}
                          className={e.direction === 'inflow' ? 'fin-amt-in' : 'fin-amt-out'}
                        >
                          {e.direction === 'inflow' ? '+' : '−'}{money(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {!loading && rows.length === 0 && (
              <EmptyState
                icon={<IconWallet width={24} height={24} />}
                title={query || filter !== 'all' ? 'No matching entries' : 'No entries yet'}
                text={
                  query || filter !== 'all'
                    ? 'Try a different filter or search term.'
                    : 'Record your first inflow or outflow to start tracking the books.'
                }
                action={
                  !query && filter === 'all' && (
                    <button className="btn btn--primary" onClick={() => setEditing(blankEntry(orgId))}>
                      <IconPlus width={16} height={16} /> Add Entry
                    </button>
                  )
                }
              />
            )}
          </div>
        </>
      )}

      {editing && (
        <FinanceForm
          initial={editing}
          orgs={orgs}
          lockedOrgId={orgId && !isPlatformAdmin ? orgId : null}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </>
  );
}
