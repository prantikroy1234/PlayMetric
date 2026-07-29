import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, EmptyState } from '../components/ui';
import {
  IconCalendar, IconClock, IconWallet, IconChart, IconPin,
} from '../components/Icons';
import { STATUS_META } from './bookings/views';
import { todayISO, weekDays, formatTime12, dowShort } from './bookings/dates';
import { Donut, DonutLegend, TrendLine, PALETTE, BarChart, HBars } from '../components/charts';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const monthKey = (iso) => iso.slice(0, 7);
const compact = (n) => {
  const v = Math.abs(n);
  if (v >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
};

/* ------------------------------ KPI card ------------------------------ */
function Kpi({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="kpi">
      <span className={`kpi__icon kpi__icon--${accent}`}><Icon width={18} height={18} /></span>
      <div className="kpi__body">
        <span className="kpi__label">{label}</span>
        <span className="kpi__value">{value}</span>
        {sub && <span className="kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isPlatformAdmin, staff } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [courts, setCourts] = useState([]);
  const [sports, setSports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [finance, setFinance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, v, c, s, b, f] = await Promise.all([
        data.organisations.list(),
        data.venues.list(),
        data.courts.list(),
        data.sports.list(),
        data.bookings.list(),
        data.financeEntries.list(),
      ]);
      setOrgs(o); setVenues(v); setCourts(c); setSports(s); setBookings(b); setFinance(f);
    } catch (err) {
      toast(err.message || 'Could not load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const showOrgPicker = isPlatformAdmin || orgs.length > 1;
  useEffect(() => {
    if (!isPlatformAdmin && !orgId && orgs.length) setOrgId(orgs[0].id);
  }, [isPlatformAdmin, orgId, orgs]);

  const byId = useMemo(
    () => ({
      venue: Object.fromEntries(venues.map((v) => [v.id, v])),
      court: Object.fromEntries(courts.map((c) => [c.id, c])),
      sport: Object.fromEntries(sports.map((s) => [s.id, s])),
    }),
    [venues, courts, sports]
  );

  const today = todayISO();
  const thisMonth = monthKey(today);

  const scopedBookings = useMemo(
    () => bookings.filter((b) => !orgId || b.org_id === orgId),
    [bookings, orgId]
  );
  const scopedFinance = useMemo(
    () => finance.filter((f) => !orgId || f.org_id === orgId),
    [finance, orgId]
  );
  const scopedCourts = useMemo(
    () => courts.filter((c) => !orgId || c.org_id === orgId),
    [courts, orgId]
  );

  const live = (b) => b.status !== 'cancelled';

  // KPIs
  const week = weekDays(today);
  const todaysBookings = scopedBookings
    .filter((b) => b.booking_date === today && live(b))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const weekCount = scopedBookings.filter((b) => week.includes(b.booking_date) && live(b)).length;

  const mtd = scopedFinance.filter((f) => monthKey(f.entry_date) === thisMonth);
  const inflowMTD = mtd.filter((f) => f.direction === 'inflow').reduce((s, f) => s + Number(f.amount || 0), 0);
  const outflowMTD = mtd.filter((f) => f.direction === 'outflow').reduce((s, f) => s + Number(f.amount || 0), 0);
  const netMTD = inflowMTD - outflowMTD;

  // Weekly bookings bar chart
  const weekBars = week.map((d) => ({
    label: dowShort(d),
    value: scopedBookings.filter((b) => b.booking_date === d && live(b)).length,
    highlight: d === today,
  }));

  // Top venues by booked revenue this month
  const venueRevenue = useMemo(() => {
    const acc = {};
    for (const b of scopedBookings) {
      if (!live(b) || monthKey(b.booking_date) !== thisMonth) continue;
      const name = byId.venue[b.venue_id]?.name || 'Unassigned';
      acc[name] = (acc[name] || 0) + Number(b.amount || 0);
    }
    return Object.entries(acc)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [scopedBookings, byId, thisMonth]);

  // Expense mix (MTD) for the donut, and a running-balance trend — the same
  // widgets the Financials overview uses, for a consistent visual language.
  const expenseData = useMemo(() => {
    const m = {};
    for (const e of scopedFinance) {
      if (e.direction !== 'outflow' || monthKey(e.entry_date) !== thisMonth) continue;
      m[e.category] = (m[e.category] || 0) + Number(e.amount || 0);
    }
    return Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  }, [scopedFinance, thisMonth]);

  const trendPoints = useMemo(() => {
    const byDate = {};
    for (const e of scopedFinance) {
      if (monthKey(e.entry_date) !== thisMonth) continue;
      const delta = (e.direction === 'inflow' ? 1 : -1) * Number(e.amount || 0);
      byDate[e.entry_date] = (byDate[e.entry_date] || 0) + delta;
    }
    const dates = Object.keys(byDate).sort();
    let run = 0;
    return dates.map((d) => {
      run += byDate[d];
      return { label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, value: run };
    });
  }, [scopedFinance, thisMonth]);

  const firstName = (staff?.full_name || '').split(' ')[0] || 'there';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${firstName} — here's what's happening at your academy.`}
        actions={
          showOrgPicker && (
            <select
              className="select-inline"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              aria-label="Organisation"
            >
              {isPlatformAdmin && <option value="">All Organisations</option>}
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )
        }
      />

      {loading ? (
        <div className="dash-empty">Loading dashboard…</div>
      ) : (
        <>
          <div className="kpigrid">
            <Kpi icon={IconCalendar} accent="blue" label="Bookings Today"
              value={todaysBookings.length}
              sub={`${scopedBookings.filter((b) => b.booking_date === today && b.status === 'confirmed').length} confirmed`} />
            <Kpi icon={IconClock} accent="cyan" label="This Week"
              value={weekCount} sub="bookings" />
            <Kpi icon={IconWallet} accent="green" label="Inflow (MTD)"
              value={money(inflowMTD)} sub={`${money(outflowMTD)} out`} />
            <Kpi icon={IconChart} accent={netMTD >= 0 ? 'green' : 'red'} label="Net (MTD)"
              value={`${netMTD < 0 ? '−' : ''}${money(Math.abs(netMTD))}`}
              sub="this month" />
          </div>

          <div className="dashcard dashcard--standalone">
            <h2 className="dashcard__title">Cash flow — running balance (this month)</h2>
            {trendPoints.length > 1 ? (
              <TrendLine points={trendPoints} />
            ) : (
              <p className="dash-empty">Not enough finance activity yet this month.</p>
            )}
          </div>

          <div className="dashgrid">
            <div className="dashcard">
              <h2 className="dashcard__title">Bookings this week</h2>
              <BarChart data={weekBars} />
            </div>

            <div className="dashcard">
              <h2 className="dashcard__title">Where money goes (this month)</h2>
              {expenseData.length ? (
                <div className="donut-wrap">
                  <Donut data={expenseData} size={158} thickness={22} centerValue={compact(outflowMTD)} centerLabel="spent" />
                  <DonutLegend data={expenseData} total={outflowMTD} />
                </div>
              ) : (
                <p className="dash-empty">No expenses recorded this month.</p>
              )}
            </div>
          </div>

          <div className="dashgrid">
            <div className="dashcard">
              <h2 className="dashcard__title">Today’s schedule</h2>
              {todaysBookings.length === 0 ? (
                <EmptyState
                  icon={<IconCalendar width={22} height={22} />}
                  title="Nothing booked today"
                  text="New bookings will show up here as they come in."
                />
              ) : (
                <ul className="schedule">
                  {todaysBookings.map((b) => {
                    const meta = STATUS_META[b.status] || STATUS_META.confirmed;
                    return (
                      <li className="schedule__item" key={b.id}>
                        <span className="schedule__time">{formatTime12(b.start_time)}</span>
                        <span className={`bk-dot ${meta.cls}`} />
                        <span className="schedule__main">
                          <span className="schedule__client">{b.client_name}</span>
                          <span className="schedule__court">
                            {byId.court[b.court_id]?.name || 'Unassigned'}
                            {byId.sport[b.sport_id] ? ` · ${byId.sport[b.sport_id].name}` : ''}
                          </span>
                        </span>
                        <span className="schedule__amt">{money(b.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="dashcard">
              <h2 className="dashcard__title">
                <IconPin width={15} height={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Top venues by revenue (MTD)
              </h2>
              <HBars data={venueRevenue} format={money} empty="No booked revenue yet this month." />
              <p className="dashcard__foot">
                {scopedCourts.length} court{scopedCourts.length === 1 ? '' : 's'} configured
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
