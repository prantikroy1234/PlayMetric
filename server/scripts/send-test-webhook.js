#!/usr/bin/env node
/*
 * Fires a fake partner webhook at the running PlayMetric server, exactly the
 * way Hudle/Playo/District would once the real integration exists.
 *
 *   node server/scripts/send-test-webhook.js --org <ORG_UUID>
 *
 * Options:
 *   --org     <uuid>   organisation to import into            (required)
 *   --url     <url>    webhook endpoint  (default http://localhost:8420/api/webhooks/bookings)
 *   --secret  <text>   shared secret     (default PLAYMETRIC_WEBHOOK_SECRET or "dev-secret")
 *   --ref     <text>   partner reference (default WHK-<timestamp>)
 *   --amount  <number> booking amount    (default 850)
 *   --status  <text>   confirmed|pending|cancelled|completed (default confirmed)
 */

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const url = arg('url', 'http://localhost:8420/api/webhooks/bookings');
const secret = arg('secret', process.env.PLAYMETRIC_WEBHOOK_SECRET || 'dev-secret');
const orgId = arg('org');
const reference = arg('ref', `WHK-${Date.now()}`);
const amount = Number(arg('amount', '850'));
const status = arg('status', 'confirmed');

if (!orgId) {
  console.error('Missing --org <ORG_UUID>.\nFind one in Supabase → organisations, or in seed.sql.');
  process.exit(1);
}

const today = new Date();
today.setDate(today.getDate() + 1);
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const payload = {
  provider: 'hudle',
  org_id: orgId,
  bookings: [
    {
      reference,
      status,
      customer: { name: 'Webhook Test User', phone: '90000 12345' },
      facility: { venue: 'Indoor Badminton', court: 'Badminton Court 1', sport: 'Badminton' },
      slot: { date, start: '20:00', end: '21:00' },
      payment: { amount, currency: 'INR', status: status === 'cancelled' ? 'refunded' : 'paid' },
    },
  ],
};

(async () => {
  console.log(`→ POST ${url}`);
  console.log(`  reference: ${reference}  org: ${orgId}  amount: ₹${amount}  status: ${status}\n`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-playmetric-secret': secret },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    console.log(`← ${res.status} ${res.statusText}`);
    console.log(JSON.stringify(body, null, 2));
    // Set the code and let the event loop drain on its own. Calling
    // process.exit() here kills the still-closing HTTP socket, which trips a
    // libuv assertion on Windows (noisy, and loses the real exit code).
    process.exitCode = res.ok ? 0 : 1;
  } catch (err) {
    console.error('Request failed:', err.message);
    console.error('Is the server running?  cd server && npm run dev');
    process.exitCode = 1;
  }
})();
