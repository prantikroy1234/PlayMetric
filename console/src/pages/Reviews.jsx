import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, Avatar, EmptyState, SearchInline } from '../components/ui';
import { IconPlus, IconStar, IconPin, IconBall } from '../components/Icons';
import ReviewForm from './reviews/ReviewForm';
import { todayISO, formatShortDate } from './bookings/dates';

// Read-only star row.
export function Stars({ value, size = 15 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          width={size}
          height={size}
          fill={n <= value ? 'currentColor' : 'none'}
          className={`star ${n <= value ? 'is-on' : 'is-off'}`}
        />
      ))}
    </span>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '5', label: '5★' },
  { key: '4', label: '4★' },
  { key: '3', label: '3★' },
  { key: '2', label: '2★' },
  { key: '1', label: '1★' },
];

const blankReview = (orgId) => ({
  org_id: orgId || '',
  client_id: null,
  venue_id: '',
  sport_id: '',
  rating: 5,
  title: '',
  body: '',
  author_name: '',
  status: 'published',
  review_date: todayISO(),
});

export default function Reviews() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [orgs, setOrgs] = useState([]);
  const [clients, setClients] = useState([]);
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, v, s, r] = await Promise.all([
        data.organisations.list(),
        data.clients.list(),
        data.venues.list(),
        data.sports.list(),
        data.reviews.list(),
      ]);
      setOrgs(o); setClients(c); setVenues(v); setSports(s); setReviews(r);
    } catch (err) {
      toast(err.message || 'Could not load reviews', 'error');
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
      org: Object.fromEntries(orgs.map((o) => [o.id, o])),
      venue: Object.fromEntries(venues.map((v) => [v.id, v])),
      sport: Object.fromEntries(sports.map((s) => [s.id, s])),
    }),
    [orgs, venues, sports]
  );

  // Org scope drives the summary; rating filter + search additionally narrow
  // the card list.
  const scoped = useMemo(
    () => reviews.filter((r) => !orgId || r.org_id === orgId),
    [reviews, orgId]
  );

  const summary = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of scoped) {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
      sum += r.rating;
    }
    return { dist, total: scoped.length, avg: scoped.length ? sum / scoped.length : 0 };
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(
      (r) =>
        (filter === 'all' || r.rating === Number(filter)) &&
        (!q || `${r.title || ''} ${r.body} ${r.author_name}`.toLowerCase().includes(q))
    );
  }, [scoped, filter, query]);

  async function save(payload) {
    const { id } = payload;
    const rest = { ...payload };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    try {
      if (id) {
        await data.reviews.update(id, rest);
        toast('Review updated');
      } else {
        await data.reviews.create(rest);
        toast('Review added');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(review) {
    try {
      await data.reviews.remove(review.id);
      toast('Review deleted');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  const distMax = Math.max(1, ...Object.values(summary.dist));

  return (
    <>
      <PageHeader
        title="Consolidated Reviews"
        subtitle="Monitor client feedback and venue ratings"
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(blankReview(orgId))}>
            <IconPlus width={16} height={16} /> Add Review
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
        <div className="segmented" role="tablist" aria-label="Rating filter">
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
        <SearchInline value={query} onChange={setQuery} placeholder="Search reviews…" />
      </div>

      {!loading && summary.total > 0 && (
        <div className="review-summary">
          <div className="review-summary__score">
            <div className="review-summary__avg">{summary.avg.toFixed(1)}</div>
            <Stars value={Math.round(summary.avg)} size={18} />
            <div className="review-summary__count">{summary.total} review{summary.total === 1 ? '' : 's'}</div>
          </div>
          <div className="review-summary__dist">
            {[5, 4, 3, 2, 1].map((r) => (
              <div className="rdist" key={r}>
                <span className="rdist__label">{r}★</span>
                <div className="rdist__track">
                  <div className="rdist__fill" style={{ width: `${(summary.dist[r] / distMax) * 100}%` }} />
                </div>
                <span className="rdist__count">{summary.dist[r]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="dash-empty">Loading reviews…</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconStar width={24} height={24} />}
            title={query || filter !== 'all' ? 'No matching reviews' : 'No reviews yet'}
            text={
              query || filter !== 'all'
                ? 'Try a different rating or search term.'
                : 'Record your first piece of client feedback.'
            }
            action={
              !query && filter === 'all' && (
                <button className="btn btn--primary" onClick={() => setEditing(blankReview(orgId))}>
                  <IconPlus width={16} height={16} /> Add Review
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="review-grid">
          {rows.map((r) => (
            <button className="review-card" key={r.id} onClick={() => setEditing(r)}>
              <div className="review-card__head">
                <Stars value={r.rating} />
                {r.status === 'hidden' && <span className="review-hidden">Hidden</span>}
              </div>
              {r.title && <h3 className="review-card__title">{r.title}</h3>}
              <p className="review-card__body">{r.body}</p>
              {(byId.venue[r.venue_id] || byId.sport[r.sport_id]) && (
                <div className="review-card__tags">
                  {byId.venue[r.venue_id] && (
                    <span className="review-tag"><IconPin width={12} height={12} /> {byId.venue[r.venue_id].name}</span>
                  )}
                  {byId.sport[r.sport_id] && (
                    <span className="review-tag"><IconBall width={12} height={12} /> {byId.sport[r.sport_id].name}</span>
                  )}
                </div>
              )}
              <div className="review-card__meta">
                <Avatar name={r.author_name} size="sm" />
                <span className="review-card__author">
                  {r.author_name}
                  {isPlatformAdmin && !orgId && byId.org[r.org_id] && (
                    <span className="finrow__org"> · {byId.org[r.org_id].name}</span>
                  )}
                </span>
                <span className="review-card__date">{formatShortDate(r.review_date)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <ReviewForm
          initial={editing}
          orgs={orgs}
          clients={clients}
          venues={venues}
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
