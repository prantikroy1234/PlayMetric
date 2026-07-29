import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, EmptyState, SearchInline } from '../components/ui';
import { IconPlus, IconTicket, IconChevronLeft, IconChevronRight } from '../components/Icons';
import TicketForm from './tickets/TicketForm';
import { formatShortDate, daysUntil } from './bookings/dates';

const COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];
const ORDER = COLUMNS.map((c) => c.key);

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];
const PRIO_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

const blankTicket = (orgId) => ({
  org_id: orgId || '',
  client_id: null,
  title: '',
  description: '',
  category: 'General',
  priority: 'medium',
  status: 'open',
  assignee: '',
  due_date: '',
});

function TicketCard({ ticket, client, onEdit, onMove }) {
  const idx = ORDER.indexOf(ticket.status);
  const overdue =
    ticket.due_date &&
    daysUntil(ticket.due_date) < 0 &&
    (ticket.status === 'open' || ticket.status === 'in_progress');

  return (
    <div className="tcard" onClick={() => onEdit(ticket)} role="button" tabIndex={0}>
      <div className="tcard__top">
        <span className={`tprio is-${ticket.priority}`}>{PRIO_LABEL[ticket.priority]}</span>
        <span className="tcard__cat">{ticket.category}</span>
      </div>
      <div className="tcard__title">{ticket.title}</div>
      {ticket.description && <div className="tcard__desc">{ticket.description}</div>}
      <div className="tcard__meta">
        {ticket.assignee && <span className="tcard__assignee">{ticket.assignee}</span>}
        {client && <span className="tcard__client">{client.name}</span>}
        {ticket.due_date && (
          <span className={`tcard__due${overdue ? ' is-overdue' : ''}`}>
            {overdue ? 'Overdue · ' : ''}{formatShortDate(ticket.due_date)}
          </span>
        )}
      </div>
      <div className="tcard__move" onClick={(e) => e.stopPropagation()}>
        <button
          className="tmove"
          disabled={idx === 0}
          onClick={() => onMove(ticket, -1)}
          aria-label="Move left"
          title="Move back"
        >
          <IconChevronLeft width={14} height={14} />
        </button>
        <button
          className="tmove"
          disabled={idx === ORDER.length - 1}
          onClick={() => onMove(ticket, 1)}
          aria-label="Move right"
          title="Move forward"
        >
          <IconChevronRight width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export default function Tickets() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [clients, setClients] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [priority, setPriority] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, t] = await Promise.all([
        data.organisations.list(),
        data.clients.list(),
        data.tickets.list(),
      ]);
      setOrgs(o); setClients(c); setTickets(t);
    } catch (err) {
      toast(err.message || 'Could not load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const showOrgPicker = isPlatformAdmin || orgs.length > 1;
  useEffect(() => {
    if (!isPlatformAdmin && !orgId && orgs.length) setOrgId(orgs[0].id);
  }, [isPlatformAdmin, orgId, orgs]);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        (!orgId || t.org_id === orgId) &&
        (priority === 'all' || t.priority === priority) &&
        (!q || `${t.title} ${t.description || ''} ${t.assignee || ''}`.toLowerCase().includes(q))
    );
  }, [tickets, orgId, priority, query]);

  const byStatus = useMemo(() => {
    const m = { open: [], in_progress: [], resolved: [], closed: [] };
    for (const t of visible) (m[t.status] || (m[t.status] = [])).push(t);
    return m;
  }, [visible]);

  async function save(payload) {
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    try {
      if (id) {
        await data.tickets.update(id, rest);
        toast('Ticket updated');
      } else {
        await data.tickets.create(rest);
        toast('Ticket created');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(ticket) {
    try {
      await data.tickets.remove(ticket.id);
      toast('Ticket deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  async function move(ticket, dir) {
    const next = ORDER[ORDER.indexOf(ticket.status) + dir];
    if (!next) return;
    // Optimistic: update locally then persist.
    setTickets((list) => list.map((t) => (t.id === ticket.id ? { ...t, status: next } : t)));
    try {
      await data.tickets.update(ticket.id, { status: next });
    } catch (err) {
      toast(err.message || 'Could not move ticket', 'error');
      refresh();
    }
  }

  return (
    <>
      <PageHeader
        title="Support Tickets"
        subtitle="Client inquiries, issue tracking, and maintenance requests"
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(blankTicket(orgId))}>
            <IconPlus width={16} height={16} /> New Ticket
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
        <div className="segmented" role="tablist" aria-label="Priority filter">
          {PRIORITY_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`segmented__btn${priority === f.key ? ' is-active' : ''}`}
              onClick={() => setPriority(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="toolbar__spacer" />
        <SearchInline value={query} onChange={setQuery} placeholder="Search tickets…" />
      </div>

      {loading ? (
        <div className="dash-empty">Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconTicket width={24} height={24} />}
            title="No tickets yet"
            text="Log your first inquiry, issue, or maintenance request."
            action={
              <button className="btn btn--primary" onClick={() => setEditing(blankTicket(orgId))}>
                <IconPlus width={16} height={16} /> New Ticket
              </button>
            }
          />
        </div>
      ) : (
        <div className="kanban">
          {COLUMNS.map((col) => (
            <div className="kcol" key={col.key}>
              <div className={`kcol__head is-${col.key}`}>
                <span className="kcol__title">{col.label}</span>
                <span className="kcol__count">{byStatus[col.key].length}</span>
              </div>
              <div className="kcol__body">
                {byStatus[col.key].map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    client={clientById[t.client_id]}
                    onEdit={setEditing}
                    onMove={move}
                  />
                ))}
                {byStatus[col.key].length === 0 && <div className="kcol__empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TicketForm
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
