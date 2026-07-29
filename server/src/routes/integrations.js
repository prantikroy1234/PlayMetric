const crypto = require('crypto');
const express = require('express');

// ============================================================================
// Partner booking integration — TEST RIG
//
// Two halves, deliberately separate:
//
//   1. MOCK PARTNER FEED  GET /api/mock/partner/bookings
//      Pretends to be Hudle/Playo/District. Returns fake bookings in a
//      partner-ish envelope. No auth, no secrets — it's a stand-in for the
//      third-party API we don't have credentials for yet. The console's
//      "Sync from partner" button PULLS from this.
//
//   2. WEBHOOK RECEIVER   POST /api/webhooks/bookings
//      The real push direction: a partner calls us when a booking happens.
//      Validates a shared secret, maps the payload onto our schema, and
//      upserts into Supabase server-side (service_role — which is why this
//      lives on the server and never in the browser).
//
// Both are namespaced under /api so they can be deleted wholesale once the
// genuine integrations land.
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mjkkrgpntlqbioevxdvw.supabase.co';
// Server-side only. NEVER expose this to the browser or commit it.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.PLAYMETRIC_WEBHOOK_SECRET || 'dev-secret';

/* ------------------------------ helpers -------------------------------- */

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Constant-time compare so a wrong secret can't be guessed by timing.
function secretMatches(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(WEBHOOK_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(body?.message || `Supabase responded ${res.status}`);
    err.status = res.status;
    err.details = body;
    throw err;
  }
  return body;
}

/* ------------------------- mock partner payload ------------------------ */
// Anchored to today so the feed always looks live.
function mockFeed() {
  return [
    {
      reference: 'HDL-100231',
      status: 'confirmed',
      customer: { name: 'Aditya Menon', phone: '98110 44001' },
      facility: { venue: 'Indoor Badminton', court: 'Badminton Court 1', sport: 'Badminton' },
      slot: { date: iso(1), start: '18:00', end: '19:00' },
      payment: { amount: 600, currency: 'INR', status: 'paid' },
    },
    {
      reference: 'HDL-100232',
      status: 'confirmed',
      customer: { name: 'Farah Sheikh', phone: '98110 44002' },
      facility: { venue: 'Main Tennis Courts', court: 'Tennis Court 2', sport: 'Tennis' },
      slot: { date: iso(1), start: '07:00', end: '08:00' },
      payment: { amount: 700, currency: 'INR', status: 'paid' },
    },
    {
      reference: 'HDL-100233',
      status: 'pending',
      customer: { name: 'Gaurav Malhotra', phone: '98110 44003' },
      facility: { venue: 'Cricket Nets', court: 'Cricket Net 1', sport: 'Cricket' },
      slot: { date: iso(2), start: '16:00', end: '17:30' },
      payment: { amount: 1200, currency: 'INR', status: 'pending' },
    },
    {
      reference: 'HDL-100234',
      status: 'cancelled',
      customer: { name: 'Ishita Roy', phone: '98110 44004' },
      facility: { venue: 'Indoor Badminton', court: 'Badminton Court 3', sport: 'Badminton' },
      slot: { date: iso(3), start: '19:00', end: '20:00' },
      payment: { amount: 500, currency: 'INR', status: 'refunded' },
    },
  ];
}

// Partner shape → our bookings row. Shared by the pull and push paths so the
// mapping is defined exactly once.
function mapPartnerBooking(p, { org_id, source = 'hudle' }) {
  const statusMap = { confirmed: 'confirmed', pending: 'pending', cancelled: 'cancelled', completed: 'completed' };
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
    notes: `Imported from ${source} (${p.reference})`,
    _facility: p.facility || {}, // stripped before insert; used to resolve ids
  };
}

/* --------------------------------- router ------------------------------ */
function createIntegrationsRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  // What's wired up? Never echoes secret values, only whether they're present.
  router.get('/integrations/health', (req, res) => {
    res.json({
      ok: true,
      mockFeed: 'GET /api/mock/partner/bookings',
      webhook: 'POST /api/webhooks/bookings',
      supabaseUrl: SUPABASE_URL,
      serviceKeyConfigured: Boolean(SERVICE_KEY),
      webhookSecretIsDefault: WEBHOOK_SECRET === 'dev-secret',
    });
  });

  // ---- 1. Mock partner feed (pull source) ----
  router.get('/mock/partner/bookings', (req, res) => {
    const all = mockFeed();
    const since = req.query.since;
    const bookings = since ? all.filter((b) => b.slot.date >= since) : all;
    res.json({
      provider: req.query.provider || 'hudle',
      generated_at: new Date().toISOString(),
      count: bookings.length,
      bookings,
    });
  });

  // ---- 2. Webhook receiver (push target) ----
  // Accepts either a single booking or { bookings: [...] }.
  router.post('/webhooks/bookings', async (req, res) => {
    const given = req.get('x-playmetric-secret') || req.query.secret;
    if (!secretMatches(given)) {
      return res.status(401).json({ ok: false, error: 'Invalid or missing webhook secret' });
    }
    if (!SERVICE_KEY) {
      return res.status(503).json({
        ok: false,
        error:
          'SUPABASE_SERVICE_ROLE_KEY is not set on the server. Add it to server/.env to let the webhook write to Supabase.',
      });
    }

    const body = req.body || {};
    const org_id = body.org_id;
    const source = body.provider || body.source || 'hudle';
    const incoming = Array.isArray(body.bookings) ? body.bookings : body.booking ? [body.booking] : [];

    if (!org_id) return res.status(400).json({ ok: false, error: 'org_id is required' });
    if (incoming.length === 0) return res.status(400).json({ ok: false, error: 'No bookings in payload' });

    try {
      // Resolve venue/court names → ids once for the whole batch.
      const [venues, courts] = await Promise.all([
        sb(`venues?org_id=eq.${org_id}&select=id,name`),
        sb(`courts?org_id=eq.${org_id}&select=id,name,venue_id,sport_id`),
      ]);
      const findVenue = (n) => venues.find((v) => v.name.toLowerCase() === String(n || '').toLowerCase());
      const findCourt = (n) => courts.find((c) => c.name.toLowerCase() === String(n || '').toLowerCase());

      const results = [];
      for (const p of incoming) {
        const mapped = mapPartnerBooking(p, { org_id, source });
        const facility = mapped._facility;
        delete mapped._facility;

        const court = findCourt(facility.court);
        const venue = findVenue(facility.venue);
        mapped.court_id = court?.id ?? null;
        mapped.venue_id = court?.venue_id ?? venue?.id ?? null;
        mapped.sport_id = court?.sport_id ?? null;

        // Idempotent: same partner reference updates rather than duplicates.
        const existing = await sb(
          `bookings?org_id=eq.${org_id}&external_ref=eq.${encodeURIComponent(mapped.external_ref)}&select=id`
        );

        if (existing.length > 0) {
          await sb(`bookings?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(mapped),
          });
          results.push({ reference: mapped.external_ref, action: 'updated', id: existing[0].id });
        } else {
          const created = await sb('bookings', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(mapped),
          });
          results.push({ reference: mapped.external_ref, action: 'created', id: created?.[0]?.id });
        }
      }

      res.json({
        ok: true,
        received: incoming.length,
        created: results.filter((r) => r.action === 'created').length,
        updated: results.filter((r) => r.action === 'updated').length,
        results,
      });
    } catch (err) {
      res.status(err.status && err.status < 500 ? 400 : 502).json({
        ok: false,
        error: err.message,
        details: err.details ?? null,
      });
    }
  });

  // Anything else under /api is a genuine 404 — answer in JSON rather than
  // letting it fall through to the SPA's index.html.
  router.use((req, res) => {
    res.status(404).json({ ok: false, error: `No API route for ${req.method} /api${req.path}` });
  });

  return router;
}

module.exports = { createIntegrationsRouter, mapPartnerBooking, mockFeed };
