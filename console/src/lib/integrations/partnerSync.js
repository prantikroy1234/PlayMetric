import { data } from '../data';

// Pull-side of the partner booking integration.
//
// Fetches a partner feed (today: the server's mock endpoint; tomorrow: the real
// Hudle/Playo/District API) and lands each booking in our own `bookings` table
// through the normal data adapter — so it obeys RLS in Supabase mode and works
// unchanged in local demo mode.
//
// Idempotent: rows are keyed on `external_ref`, so re-running a sync updates
// the existing booking instead of duplicating it.

export const PARTNER_FEED_URL = '/api/mock/partner/bookings';

const statusMap = {
  confirmed: 'confirmed',
  pending: 'pending',
  cancelled: 'cancelled',
  completed: 'completed',
};

// Partner envelope → our booking row (ids resolved by the caller's lookups).
export function mapPartnerBooking(p, { org_id, source, byName }) {
  const court = byName.court(p.facility?.court);
  const venue = byName.venue(p.facility?.venue);
  return {
    org_id,
    external_ref: p.reference,
    source,
    client_name: p.customer?.name || 'Unknown',
    client_phone: p.customer?.phone || null,
    booking_date: p.slot?.date,
    start_time: p.slot?.start,
    end_time: p.slot?.end,
    amount: Number(p.payment?.amount || 0),
    status: statusMap[p.status] || 'confirmed',
    venue_id: court?.venue_id ?? venue?.id ?? null,
    court_id: court?.id ?? null,
    sport_id: court?.sport_id ?? null,
    notes: `Imported from ${source} (${p.reference})`,
  };
}

export async function fetchPartnerFeed(url = PARTNER_FEED_URL) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'Partner feed not found — is the PlayMetric server running on :8420?'
        : `Partner feed returned ${res.status}`
    );
  }
  return res.json();
}

/**
 * Sync the partner feed into `bookings` for one organisation.
 * @returns {{created:Array, updated:Array, failed:Array, provider:string}}
 */
export async function syncPartnerBookings({ orgId, venues, courts, existingBookings, url }) {
  if (!orgId) throw new Error('Choose an organisation before syncing.');

  const feed = await fetchPartnerFeed(url);
  const provider = feed.provider || 'partner';

  const lower = (s) => String(s || '').toLowerCase();
  const byName = {
    venue: (n) => venues.find((v) => v.org_id === orgId && lower(v.name) === lower(n)),
    court: (n) => courts.find((c) => c.org_id === orgId && lower(c.name) === lower(n)),
  };

  // Existing partner rows for this org, keyed by their partner reference.
  const seen = new Map(
    existingBookings
      .filter((b) => b.org_id === orgId && b.external_ref)
      .map((b) => [b.external_ref, b])
  );

  const created = [];
  const updated = [];
  const failed = [];

  for (const p of feed.bookings || []) {
    try {
      const row = mapPartnerBooking(p, { org_id: orgId, source: provider, byName });
      const match = seen.get(row.external_ref);
      if (match) {
        updated.push(await data.bookings.update(match.id, row));
      } else {
        created.push(await data.bookings.create(row));
      }
    } catch (err) {
      failed.push({ reference: p.reference, error: err.message });
    }
  }

  return { created, updated, failed, provider };
}
