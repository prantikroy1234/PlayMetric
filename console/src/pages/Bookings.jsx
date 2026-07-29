import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, EmptyState, Modal } from '../components/ui';
import { syncPartnerBookings } from '../lib/integrations/partnerSync';
import {
  IconPlus, IconChevronLeft, IconChevronRight, IconCalendar, IconLayers, IconContract, IconStar,
} from '../components/Icons';
import { DayView, WeekView, MonthView, TransactionsView, STATUS_META } from './bookings/views';
import BookingForm from './bookings/BookingForm';
import {
  todayISO, addDays, addMonths, formatFullDay, formatWeekRange, formatMonth,
} from './bookings/dates';

const SUBTABS = [
  { key: 'calendar', label: 'Calendar', icon: IconCalendar },
  { key: 'inventory', label: 'Inventory', icon: IconLayers },
  { key: 'documents', label: 'Documents', icon: IconContract },
  { key: 'transactions', label: 'Transactions', icon: IconLayers },
  { key: 'reviews', label: 'Reviews', icon: IconStar },
];

const VIEWS = ['day', 'week', 'month'];

const blankFor = (orgId, dateISO, prefill = {}) => ({
  org_id: orgId || '',
  venue_id: prefill.court?.venue_id || '',
  court_id: prefill.court?.id || '',
  sport_id: prefill.court?.sport_id || '',
  booking_date: prefill.dateISO || dateISO,
  start_time: '',
  end_time: '',
  client_name: '',
  client_phone: '',
  status: 'confirmed',
  amount: '',
  notes: '',
});

export default function Bookings() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [courts, setCourts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [sportId, setSportId] = useState('');

  const [subtab, setSubtab] = useState('calendar');
  const [view, setView] = useState('week');
  const [cursor, setCursor] = useState(todayISO());
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, v, s, c, b] = await Promise.all([
        data.organisations.list(),
        data.venues.list(),
        data.sports.list(),
        data.courts.list(),
        data.bookings.list(),
      ]);
      setOrgs(o);
      setVenues(v);
      setSports(s);
      setCourts(c);
      setBookings(b);
    } catch (err) {
      toast(err.message || 'Could not load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Scope academy owners to their own org; only platform admins pick across all.
  const showOrgPicker = isPlatformAdmin || orgs.length > 1;
  useEffect(() => {
    if (!isPlatformAdmin && !orgId && orgs.length) setOrgId(orgs[0].id);
  }, [isPlatformAdmin, orgId, orgs]);

  const byId = useMemo(
    () => ({
      org: Object.fromEntries(orgs.map((o) => [o.id, o])),
      venue: Object.fromEntries(venues.map((v) => [v.id, v])),
      sport: Object.fromEntries(sports.map((s) => [s.id, s])),
      court: Object.fromEntries(courts.map((c) => [c.id, c])),
    }),
    [orgs, venues, sports, courts]
  );

  // Venue/sport dropdown options follow the chosen org.
  const orgVenues = venues.filter((v) => !orgId || v.org_id === orgId);
  const orgSports = sports.filter((s) => !orgId || s.org_id === orgId);

  // Bookings and courts narrowed by the active filters — shared by every subtab.
  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!orgId || b.org_id === orgId) &&
          (!venueId || b.venue_id === venueId) &&
          (!sportId || b.sport_id === sportId)
      ),
    [bookings, orgId, venueId, sportId]
  );
  const filteredCourts = useMemo(
    () =>
      courts.filter(
        (c) =>
          (!orgId || c.org_id === orgId) &&
          (!venueId || c.venue_id === venueId) &&
          (!sportId || c.sport_id === sportId)
      ),
    [courts, orgId, venueId, sportId]
  );

  function step(dir) {
    if (view === 'day') setCursor((c) => addDays(c, dir));
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => addMonths(c, dir));
  }

  const rangeLabel =
    view === 'day' ? formatFullDay(cursor)
    : view === 'week' ? formatWeekRange(cursor)
    : formatMonth(cursor);

  // Keep Financials in sync with a booking's status:
  //   confirmed/completed → one 'inflow' entry (category Bookings)
  //   cancelled           → keep the inflow and post a 'Refund' outflow that
  //                         subtracts it back out (net zero, both auditable)
  //   pending             → no financial impact (remove any generated rows)
  // Entries are linked by booking_id (migration 0010), so this reconciles
  // idempotently against whatever already exists.
  async function syncBookingFinance(b) {
    if (!b?.id) return;
    let linked;
    try {
      linked = await data.financeEntries.list({ booking_id: b.id });
    } catch {
      // Column missing (0010 not applied yet) — skip silently.
      return;
    }
    const inflow = linked.find((e) => e.direction === 'inflow');
    const refund = linked.find((e) => e.direction === 'outflow');
    const amount = Number(b.amount || 0);
    const active = b.status === 'confirmed' || b.status === 'completed';
    const base = { org_id: b.org_id, entry_date: b.booking_date, source: 'booking', booking_id: b.id };

    try {
      if (active && amount > 0) {
        const label = `Booking — ${b.client_name}`;
        if (inflow) {
          if (Number(inflow.amount) !== amount || inflow.label !== label || inflow.entry_date !== b.booking_date)
            await data.financeEntries.update(inflow.id, { amount, label, entry_date: b.booking_date });
        } else {
          await data.financeEntries.create({ ...base, direction: 'inflow', category: 'Bookings', label, amount });
        }
        if (refund) await data.financeEntries.remove(refund.id); // active again → drop refund
      } else if (b.status === 'cancelled') {
        if (inflow) {
          const refundAmt = Number(inflow.amount);
          const label = `Refund — ${b.client_name}`;
          if (refund) {
            if (Number(refund.amount) !== refundAmt) await data.financeEntries.update(refund.id, { amount: refundAmt, label });
          } else {
            await data.financeEntries.create({ ...base, direction: 'outflow', category: 'Refund', label, amount: refundAmt });
          }
        }
      } else {
        // pending (or amount 0) → no revenue recorded
        if (inflow) await data.financeEntries.remove(inflow.id);
        if (refund) await data.financeEntries.remove(refund.id);
      }
    } catch (err) {
      toast(err.message || 'Booking saved, but Financials sync failed', 'error');
    }
  }

  async function save(payload) {
    // Never let the client rewrite server-managed columns.
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    delete rest.is_active;
    try {
      const saved = id
        ? await data.bookings.update(id, rest)
        : await data.bookings.create(rest);
      await syncBookingFinance(saved);
      toast(id ? 'Booking updated' : 'Booking created');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(booking) {
    try {
      await data.bookings.remove(booking.id);
      toast('Booking deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  // Pull the partner feed (mock today, real Hudle/Playo later) into bookings,
  // then reconcile Financials for anything that landed.
  async function runPartnerSync() {
    if (!orgId) {
      toast('Choose an organisation to sync into', 'error');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncPartnerBookings({
        orgId,
        venues,
        courts,
        existingBookings: bookings,
      });
      for (const b of [...result.created, ...result.updated]) await syncBookingFinance(b);
      setSyncResult(result);
      refresh();
    } catch (err) {
      toast(err.message || 'Partner sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

  const openCreate = (prefill) =>
    setEditing(blankFor(orgId, cursor, prefill || {}));

  const calendarProps = {
    dateISO: cursor,
    bookings: filteredBookings,
    byId,
    onEdit: (b) => setEditing(b),
    onCreateAt: openCreate,
  };

  return (
    <>
      <PageHeader
        title="Booking Management"
        subtitle="Manage and schedule venue courts"
        actions={
          <>
            <button
              className="btn btn--ghost"
              onClick={runPartnerSync}
              disabled={syncing}
              title="Pull bookings from the connected booking site"
            >
              {syncing ? 'Syncing…' : 'Sync from partner'}
            </button>
            <button className="btn btn--primary" onClick={() => openCreate()}>
              <IconPlus width={16} height={16} /> New Booking
            </button>
          </>
        }
      />

      <div className="subtabs">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            className={`subtab${t.key === subtab ? ' is-active' : ''}`}
            onClick={() => setSubtab(t.key)}
          >
            <t.icon width={15} height={15} /> {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar toolbar--wrap">
        {showOrgPicker && (
          <select
            className="select-inline"
            value={orgId}
            onChange={(e) => { setOrgId(e.target.value); setVenueId(''); setSportId(''); }}
            aria-label="Organisation"
          >
            {isPlatformAdmin && <option value="">All Organisations</option>}
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select
          className="select-inline"
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          aria-label="Venue"
        >
          <option value="">All venues</option>
          {orgVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          className="select-inline"
          value={sportId}
          onChange={(e) => setSportId(e.target.value)}
          aria-label="Sport"
        >
          <option value="">All sports</option>
          {orgSports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <span className="toolbar__spacer" />

        {subtab === 'calendar' && (
          <>
            <div className="segmented" role="tablist" aria-label="Calendar view">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  className={`segmented__btn${view === v ? ' is-active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="datenav">
              <button className="iconbtn" onClick={() => step(-1)} aria-label="Previous">
                <IconChevronLeft width={16} height={16} />
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setCursor(todayISO())}>
                Today
              </button>
              <button className="iconbtn" onClick={() => step(1)} aria-label="Next">
                <IconChevronRight width={16} height={16} />
              </button>
              <span className="datenav__label">{rangeLabel}</span>
            </div>
          </>
        )}
      </div>

      {subtab === 'calendar' && (
        <div className="card card--flush">
          {loading ? (
            <div className="daycal__empty">Loading bookings…</div>
          ) : view === 'day' ? (
            <DayView {...calendarProps} courts={filteredCourts} />
          ) : view === 'week' ? (
            <WeekView {...calendarProps} />
          ) : (
            <MonthView
              {...calendarProps}
              onOpenDay={(d) => { setCursor(d); setView('day'); }}
            />
          )}

          <div className="bk-legend">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <span key={k} className="bk-legend__item">
                <span className={`bk-dot ${m.cls}`} /> {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {subtab === 'transactions' && (
        <TransactionsView bookings={filteredBookings} byId={byId} />
      )}

      {subtab === 'inventory' && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Court</th><th>Venue</th><th>Sport</th><th>Surface</th><th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourts.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-title">{c.name}</td>
                    <td>{byId.venue[c.venue_id]?.name || '—'}</td>
                    <td>{byId.sport[c.sport_id]?.name || '—'}</td>
                    <td>{c.surface || '—'}</td>
                    <td>{c.capacity ?? '—'}</td>
                  </tr>
                ))}
                {filteredCourts.length === 0 && (
                  <tr><td colSpan={5} style={{ color: 'var(--ink-faint)' }}>No courts for this selection.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'documents' && (
        <div className="card">
          <EmptyState
            icon={<IconContract width={24} height={24} />}
            title="No documents yet"
            text="Booking agreements, invoices and receipts will live here. Coming soon."
          />
        </div>
      )}

      {subtab === 'reviews' && (
        <div className="card">
          <EmptyState
            icon={<IconStar width={24} height={24} />}
            title="No reviews yet"
            text="Client feedback tied to bookings will appear here. Coming soon."
          />
        </div>
      )}

      {syncResult && (
        <Modal
          title="Partner sync complete"
          subtitle={`Pulled from ${syncResult.provider}.`}
          onClose={() => setSyncResult(null)}
          footer={<button className="btn btn--primary" onClick={() => setSyncResult(null)}>Done</button>}
        >
          <div className="statgrid">
            <div className="statcard statcard--in">
              <span className="statcard__label">Imported</span>
              <span className="statcard__value">{syncResult.created.length}</span>
            </div>
            <div className="statcard">
              <span className="statcard__label">Updated</span>
              <span className="statcard__value">{syncResult.updated.length}</span>
            </div>
            <div className={`statcard ${syncResult.failed.length ? 'statcard--out' : ''}`}>
              <span className="statcard__label">Failed</span>
              <span className="statcard__value">{syncResult.failed.length}</span>
            </div>
          </div>
          <p className="importstub__note" style={{ marginTop: '1rem' }}>
            Re-running the sync updates these same bookings instead of duplicating them —
            each one is matched on its partner reference.
          </p>
          {syncResult.failed.length > 0 && (
            <ul className="invite-steps" style={{ marginTop: '0.75rem' }}>
              {syncResult.failed.map((f) => (
                <li key={f.reference}><strong>{f.reference}</strong>: {f.error}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {editing && (
        <BookingForm
          initial={editing}
          orgs={orgs}
          venues={venues}
          courts={courts}
          sports={sports}
          lockedOrgId={orgId && !isPlatformAdmin ? orgId : null}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
