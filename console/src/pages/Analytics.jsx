import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/ui';
import { IconCalendar, IconWallet, IconStar, IconUsers } from '../components/Icons';
import { Donut, DonutLegend, TrendLine, BarChart, HBars } from '../components/charts';
import { Stars } from './Reviews';
import { todayISO, addDays } from './bookings/dates';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const hourLabel = (h) => (h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`);

const STATUS_META = [
  { key: 'confirmed', label: 'Confirmed', color: '#3b82f6' },
  { key: 'pending', label: 'Pending', color: '#f59e0b' },
  { key: 'completed', label: 'Completed', color: '#22c55e' },
  { key: 'cancelled', label: 'Cancelled', color: '#6b7381' },
];

function Kpi({ icon: Icon, accent, label, value, sub }) {
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

export default function Analytics() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, v, s, b, r, c] = await Promise.all([
        data.organisations.list(),
        data.venues.list(),
        data.sports.list(),
        data.bookings.list(),
        data.reviews.list(),
        data.clients.list(),
      ]);
      setOrgs(o); setVenues(v); setSports(s); setBookings(b); setReviews(r); setClients(c);
    } catch (err) {
      toast(err.message || 'Could not load analytics', 'error');
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
      sport: Object.fromEntries(sports.map((s) => [s.id, s])),
    }),
    [venues, sports]
  );

  const A = useMemo(() => {
    const bk = bookings.filter((b) => !orgId || b.org_id === orgId);
    const rv = reviews.filter((r) => !orgId || r.org_id === orgId);
    const cl = clients.filter((c) => !orgId || c.org_id === orgId);
    const live = bk.filter((b) => b.status !== 'cancelled');

    const revenue = live.reduce((s, b) => s + Number(b.amount || 0), 0);
    const avgRating = rv.length ? rv.reduce((s, r) => s + r.rating, 0) / rv.length : 0;

    // Daily booking volume over a 2-week window (incl. a few upcoming days).
    const start = addDays(todayISO(), -10);
    const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
    const volume = days.map((d) => ({
      label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      value: bk.filter((b) => b.booking_date === d && b.status !== 'cancelled').length,
    }));

    // Status mix.
    const statusMix = STATUS_META.map((m) => ({
      label: m.label,
      value: bk.filter((b) => b.status === m.key).length,
      color: m.color,
    })).filter((d) => d.value > 0);

    // Revenue by venue.
    const venueAcc = {};
    for (const b of live) {
      const name = byId.venue[b.venue_id]?.name || 'Unassigned';
      venueAcc[name] = (venueAcc[name] || 0) + Number(b.amount || 0);
    }
    const venueRevenue = Object.entries(venueAcc)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Bookings by sport.
    const sportAcc = {};
    for (const b of live) {
      const name = byId.sport[b.sport_id]?.name || 'Other';
      sportAcc[name] = (sportAcc[name] || 0) + 1;
    }
    const sportCounts = Object.entries(sportAcc)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Peak hours (6a–9p).
    const peak = Array.from({ length: 16 }, (_, i) => {
      const h = 6 + i;
      return {
        label: hourLabel(h),
        value: live.filter((b) => Number(b.start_time?.slice(0, 2)) === h).length,
      };
    });

    // Rating distribution.
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rv) dist[r.rating] = (dist[r.rating] || 0) + 1;

    return {
      totalBookings: bk.length,
      revenue,
      avgRating,
      reviewCount: rv.length,
      clientCount: cl.length,
      volume,
      statusMix,
      venueRevenue,
      sportCounts,
      peak,
      dist,
    };
  }, [bookings, reviews, clients, orgId, byId]);

  const statusTotal = A.statusMix.reduce((s, d) => s + d.value, 0);
  const distMax = Math.max(1, ...Object.values(A.dist));

  return (
    <>
      <PageHeader
        title="Business Analytics"
        subtitle="Data-driven insights for venue performance"
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
        <div className="dash-empty">Loading analytics…</div>
      ) : (
        <>
          <div className="kpigrid">
            <Kpi icon={IconCalendar} accent="blue" label="Total Bookings" value={A.totalBookings} sub="all statuses" />
            <Kpi icon={IconWallet} accent="green" label="Booking Revenue" value={money(A.revenue)} sub="excl. cancelled" />
            <Kpi icon={IconStar} accent="cyan" label="Avg Rating" value={`${A.avgRating.toFixed(1)}/5`} sub={`${A.reviewCount} reviews`} />
            <Kpi icon={IconUsers} accent="violet" label="Clients" value={A.clientCount} sub="in directory" />
          </div>

          <div className="dashcard dashcard--standalone">
            <h2 className="dashcard__title">Daily booking volume (2 weeks)</h2>
            {A.volume.some((d) => d.value > 0) ? (
              <TrendLine points={A.volume} formatY={(v) => String(v)} />
            ) : (
              <p className="dash-empty">No bookings in this window.</p>
            )}
          </div>

          <div className="dashgrid">
            <div className="dashcard">
              <h2 className="dashcard__title">Booking status mix</h2>
              {A.statusMix.length ? (
                <div className="donut-wrap">
                  <Donut data={A.statusMix} size={158} thickness={22} centerValue={A.totalBookings} centerLabel="bookings" />
                  <DonutLegend data={A.statusMix} total={statusTotal} format={(v) => String(v)} />
                </div>
              ) : (
                <p className="dash-empty">No bookings yet.</p>
              )}
            </div>

            <div className="dashcard">
              <h2 className="dashcard__title">Ratings</h2>
              {A.reviewCount ? (
                <div className="an-ratings">
                  <div className="an-ratings__score">
                    <div className="review-summary__avg">{A.avgRating.toFixed(1)}</div>
                    <Stars value={Math.round(A.avgRating)} size={16} />
                    <div className="review-summary__count">{A.reviewCount} reviews</div>
                  </div>
                  <div className="review-summary__dist">
                    {[5, 4, 3, 2, 1].map((r) => (
                      <div className="rdist" key={r}>
                        <span className="rdist__label">{r}★</span>
                        <div className="rdist__track">
                          <div className="rdist__fill" style={{ width: `${(A.dist[r] / distMax) * 100}%` }} />
                        </div>
                        <span className="rdist__count">{A.dist[r]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="dash-empty">No reviews yet.</p>
              )}
            </div>
          </div>

          <div className="dashgrid">
            <div className="dashcard">
              <h2 className="dashcard__title">Revenue by venue</h2>
              <HBars data={A.venueRevenue} format={money} empty="No booked revenue yet." />
            </div>
            <div className="dashcard">
              <h2 className="dashcard__title">Bookings by sport</h2>
              <HBars data={A.sportCounts} variant="in" empty="No bookings yet." />
            </div>
          </div>

          <div className="dashcard dashcard--standalone">
            <h2 className="dashcard__title">Peak hours</h2>
            <BarChart data={A.peak} />
          </div>
        </>
      )}
    </>
  );
}
