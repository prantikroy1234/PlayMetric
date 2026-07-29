# PlayMetric

**Multi-tenant B2B SaaS for sports academies.** Academies manage venues, courts, bookings,
finances, clients, contracts, reviews, support tickets and staff permissions from a single
admin console, with each academy's data isolated from every other academy's at the database
level.

Live tenants modelled in the demo data: **Sportizo**, **Calirox**, **Demo**.

> 📘 **New to the codebase, or explaining it to a non-technical audience?**
> Read **[API_calls.md](API_calls.md)** first — every API call in plain English, with
> analogies, click-by-click walk-throughs, and a Q&A section.

---

## Table of contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Repository map — what every file does](#2-repository-map--what-every-file-does)
3. [Running it locally](#3-running-it-locally)
4. [The Supabase backend](#4-the-supabase-backend)
5. [Security model — RLS + RBAC](#5-security-model--rls--rbac)
6. [Frontend architecture](#6-frontend-architecture)
7. [The 13 modules](#7-the-13-modules)
8. [API surface](#8-api-surface)
9. [Business logic worth knowing](#9-business-logic-worth-knowing)
10. [Project journey](#10-project-journey)
11. [Known gaps & next steps](#11-known-gaps--next-steps)

---

## 1. Architecture at a glance

**Supabase is the single backend** — Postgres, Auth, and Row-Level Security. There is no
custom API server for application data; the browser talks to Postgres directly and RLS decides
what it may see. The Express process is a *static host* with one narrow exception (the partner
webhook, § 8).

```
                    ┌──────────────────────────────────────────┐
   Browser          │              Express :8420               │
 ┌──────────┐       │  ┌────────────────────────────────────┐  │
 │ Marketing│◄──────┼──┤ public/          static site       │  │
 │  site    │       │  ├────────────────────────────────────┤  │
 ├──────────┤       │  │ console/dist     built SPA at /app │  │
 │ Console  │◄──────┼──┤                                    │  │
 │  (React) │       │  ├────────────────────────────────────┤  │
 └────┬─────┘       │  │ /api/*  integration test rig only  │──┼──┐
      │             │  └────────────────────────────────────┘  │  │
      │             └──────────────────────────────────────────┘  │
      │ supabase-js (anon key, RLS-gated)                          │ service_role
      │                                                            │ (server-side only)
      ▼                                                            ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  Supabase — Postgres + Auth + Row-Level Security                     │
 │  17 tables · 12 migrations · RLS on every tenant table               │
 └──────────────────────────────────────────────────────────────────────┘
```

**Why same-origin matters:** the console is served at `/app` on the *same origin* as the
marketing site. Supabase stores its auth session in `localStorage`, which is per-origin — so
signing in at `/signin.html` makes the session automatically available to the console at
`/app`. That is the entire reason the console isn't on its own port in production.

---

## 2. Repository map — what every file does

```
PlayMetric/
├── public/                     Static marketing site
│   ├── index.html              Landing page (hero, features, Book-a-Demo)
│   ├── signin.html             Football-themed sign-in / sign-up
│   ├── css/                    Stylesheets (no inline styles — strict CSP)
│   └── js/
│       ├── main.js             Landing interactions + "Book a Demo" → leads table
│       ├── auth.js             Supabase Auth sign-in/sign-up → redirects to /app
│       ├── supabase-config.js  Exposes window.pmSupabase (anon key — public by design)
│       └── vendor/supabase.js  Vendored supabase-js UMD (CSP forbids CDNs)
│
├── server/                     Express static host (port 8420)
│   ├── src/server.js           Entry point; reads .env, starts listener
│   ├── src/app.js              CSP/helmet, mounts /api, serves public/ + console/dist at /app
│   ├── src/routes/
│   │   └── integrations.js     ★ The only server-side API: mock partner feed + webhook receiver
│   ├── scripts/
│   │   └── send-test-webhook.js  CLI to fire a fake partner webhook
│   └── .env.example            Config template (PORT, webhook secret, service_role)
│
├── console/                    React + Vite admin SPA (dev :5173, prod served at /app)
│   ├── vite.config.js          base '/app/', /api proxy, CSP-safe build settings
│   ├── .env.demo               VITE_DATA_MODE=local — forces the auth-free demo
│   └── src/
│       ├── main.jsx            React root
│       ├── App.jsx             Router, <Gate> auth guard, all route definitions
│       ├── index.css           Entire design system (dark theme, all component tokens)
│       │
│       ├── lib/
│       │   ├── supabaseClient.js   Creates the client; decides Supabase vs local mode
│       │   ├── auth.jsx            AuthProvider / useAuth() — session, staff row, isPlatformAdmin
│       │   ├── toast.jsx           Toast notifications
│       │   ├── data/
│       │   │   ├── index.js        ★ Picks the adapter — the app's single backend switch
│       │   │   ├── supabaseAdapter.js  CRUD against Postgres via supabase-js
│       │   │   ├── localAdapter.js     Same API, backed by localStorage (demo mode)
│       │   │   └── seedData.js         Demo dataset mirroring supabase/seed.sql
│       │   └── integrations/
│       │       └── partnerSync.js  Pull-side importer for partner bookings
│       │
│       ├── components/
│       │   ├── ui.jsx          Modal, ConfirmModal, Field, PageHeader, Avatar, Chip,
│       │   │                   Pagination, EmptyState, TableSkeleton, SearchInline
│       │   ├── charts.jsx      Donut, DonutLegend, TrendLine (SVG) + BarChart, HBars (CSS)
│       │   ├── Icons.jsx       Single stroke-based icon set, all currentColor
│       │   └── Sidebar.jsx     Navigation groups (mirrors the live product)
│       │
│       └── pages/              One file per module + a folder for its sub-components
│           ├── Dashboard.jsx           Overview KPIs + charts
│           ├── Bookings.jsx            + bookings/{views,BookingForm,dates}
│           ├── Financials.jsx          + finance/{Overview,FinanceForm}
│           ├── Clients.jsx             + clients/ClientForm
│           ├── Contracts.jsx           + contracts/ContractForm
│           ├── Reviews.jsx             + reviews/ReviewForm
│           ├── Tickets.jsx             + tickets/TicketForm
│           ├── Analytics.jsx           Read-only charts page
│           ├── Users.jsx               + users/StaffForm
│           ├── Roles.jsx               Role × action permission matrix
│           ├── Actions.jsx             4-level capability catalogue
│           ├── Organisations.jsx       Academy details
│           ├── Facility.jsx            + facility/{EntityTable,forms,useFacility}
│           └── TimeSlots.jsx           Standalone time-slot config
│
└── supabase/
    ├── migrations/0001…0012    Schema, applied by hand in the SQL Editor
    ├── seed.sql                Demo data (idempotent — safe to re-run)
    ├── apply_new.sql           Bundle: migrations 0004–0010 + seed (fresh DB only)
    └── apply_rbac.sql          Bundle: 0011 + 0012 + RBAC seed (existing DB)
```

---

## 3. Running it locally

| Goal | Command | URL |
|---|---|---|
| **Demo — no login, full data** | `cd console && npm run demo` | http://localhost:5173/app/ |
| Console dev (real Supabase) | `cd console && npm run dev` | http://localhost:5173/app/ |
| **Full site + console** | `cd console && npm run build`<br>`cd ../server && npm run dev` | http://localhost:8420 |
| Full site in demo mode | `cd console && npm run build:demo`<br>`cd ../server && npm run dev` | http://localhost:8420 |

**Two ports, two purposes:** `5173` is Vite's dev server (console only, hot reload). `8420` is
Express serving the marketing site *and* the built console at `/app` — the only place the
sign-in → console handoff works, because of the same-origin session.

> `console/dist` is gitignored, so **`npm run build` is required** before `:8420/app` serves
> anything.

### Demo mode vs Supabase mode

`console/src/lib/supabaseClient.js` decides:

```js
const forceLocal = import.meta.env.VITE_DATA_MODE === 'local';
export const isSupabaseConfigured = !forceLocal && Boolean(url && anonKey);
```

- **Supabase mode** — `.env.local` holds `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
  Real auth, real Postgres, RLS enforced.
- **Demo mode** — `npm run demo` loads `.env.demo` (`VITE_DATA_MODE=local`), which *overrides*
  any real keys. No login; data lives in `localStorage` and is seeded on first run. Ideal for
  demos because it cannot break and needs no setup.

---

## 4. The Supabase backend

**Project ref:** `mjkkrgpntlqbioevxdvw` · `https://mjkkrgpntlqbioevxdvw.supabase.co`

### Key policy

| Key | Where it lives | Safe to expose? |
|---|---|---|
| `anon` | `public/js/supabase-config.js`, `console/.env.local` | **Yes** — RLS gates everything |
| `service_role` | `server/.env` only (gitignored) | **Never.** Bypasses RLS entirely |

### Migrations

Applied **by hand** in the Supabase dashboard SQL Editor (no CLI wired up), in order:

| # | File | Creates |
|---|---|---|
| 0001 | `0001_init.sql` | `organisations`, `venues`, `sports`, `courts`, `time_slots`, `staff`, `org_members`; RLS + helper functions |
| 0002 | `0002_leads.sql` | `leads` — public "Book a Demo" capture |
| 0003 | `0003_onboarding.sql` | Trigger on `auth.users` insert → auto-provisions org + owner staff row on signup |
| 0004 | `0004_bookings.sql` | `bookings` (court reservations; `source` defaults `'manual'`) |
| 0005 | `0005_finance.sql` | `finance_entries` (inflow/outflow ledger) |
| 0006 | `0006_clients.sql` | `clients` (players / teams / corporate) |
| 0007 | `0007_contracts.sql` | `contracts` (leases, services, sponsorships, memberships) |
| 0008 | `0008_reviews.sql` | `reviews` (1–5 rating + body, optional venue/sport/client) |
| 0009 | `0009_tickets.sql` | `tickets` (kanban: open → in_progress → resolved → closed) |
| 0010 | `0010_finance_booking_link.sql` | `finance_entries.booking_id` FK — links booking revenue to its ledger row |
| 0011 | `0011_rbac.sql` | `actions`, `roles`, `role_permissions`; widens two 0001 policies |
| 0012 | `0012_booking_external_ref.sql` | `bookings.external_ref` — idempotency key for partner imports |

Then run **`seed.sql`** for demo data (every insert is `on conflict do nothing`, so it's safe
to re-run after adding new migrations).

### Setting up from scratch

```
1. Run migrations 0001 → 0012 in order in the SQL Editor.
2. Run seed.sql.
3. Create your login: Authentication → Users → Add user (tick Auto Confirm).
4. Promote yourself to platform admin:

   insert into public.staff (id, full_name, email, is_platform_admin)
   select id, 'Your Name', email, true
   from auth.users where email = 'you@example.com'
   on conflict (id) do update set is_platform_admin = true;

5. cd console && npm run build && cd ../server && npm run dev  →  localhost:8420
```

### Data model

```
organisations ──┬── venues ──── courts ──┐
   (tenant)     ├── sports ──────────────┤
                ├── time_slots           │
                ├── bookings ◄───────────┘   external_ref (partner idempotency)
                │      └── finance_entries.booking_id   (auto-posted revenue/refunds)
                ├── finance_entries
                ├── clients ──┬── contracts.client_id
                │             ├── reviews.client_id
                │             └── tickets.client_id
                ├── reviews · tickets · contracts
                └── org_members ──── staff ──── auth.users

Global (not per-tenant):
   actions (4-level tree) ──── role_permissions ──── roles
```

---

## 5. Security model — RLS + RBAC

Two independent layers. Getting the distinction right is the core of the product:

> **RLS decides *which organisation's rows* you can touch.**
> **RBAC decides *which screens* your role may open.**

### Layer 1 — Row-Level Security (enforced by Postgres)

Every tenant table carries `org_id` and has four policies (select/insert/update/delete) all
gated on one `SECURITY DEFINER` helper:

```sql
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer as $$
  select public.is_platform_admin() or exists (
    select 1 from public.org_members m
    where m.org_id = target_org and m.staff_id = auth.uid()
  );
$$;
```

`SECURITY DEFINER` matters: policies on `org_members` would otherwise recurse when another
table's policy consults membership.

Helper functions:

| Function | Answers |
|---|---|
| `is_platform_admin()` | Is the caller on PlayMetric's own team? |
| `is_org_member(org)` | May the caller act inside this organisation? |
| `shares_org_with(staff)` | Do the caller and this person share an academy? *(0011)* |
| `can_access_role(role)` | May the caller see/manage this role? *(0011)* |

**The #1 gotcha:** a signed-in user with **no `staff` row correctly sees zero rows**. That's RLS
working, not a bug. The console detects this and shows a "no staff record" screen with the
exact fix SQL.

### Layer 2 — Application RBAC (migration 0011)

A 4-level capability catalogue that roles map onto:

```
Subsystem (CRM)
└── Module (Booking Management)
    └── Submodule (Calendar)
        └── Action (ac-202 "Create booking")
```

Seeded with **56 nodes** — 1 subsystem, 7 modules, 15 submodules, **33 action codes** — and
**5 system roles** (Owner, Manager, Front Desk, Accountant, Coach) with a full
`role_permissions` matrix (165 rows).

`actions` is **global**, not per-tenant: it describes the product itself, so every academy sees
the same tree. Read access is open to any authenticated staff; writes are platform-admin only.
Roles can be system templates (`org_id is null`) or an academy's own custom role.

### Two roles you'll meet in the UI

| | Regular **staff** | **Platform admin** |
|---|---|---|
| Who | An academy's employee | PlayMetric's own team |
| Sees | Only their academy | Every academy |
| Flag | `is_platform_admin = false` | `is_platform_admin = true` |
| In-app | Org picker hidden, auto-scoped | "All Organisations" picker shown |

Every screen applies this via `useAuth().isPlatformAdmin`.

### Content Security Policy

`server/src/app.js` sets a strict CSP: `script-src 'self'`, `style-src 'self'` + Google Fonts,
`connect-src 'self'` + the Supabase origin, no inline scripts/styles, no CDNs. Consequences
that shaped the code:

- supabase-js is **vendored locally**, not loaded from a CDN.
- No inline `<script>`, `style=""`, or inline `background-image: url()` — CSS classes only.
- Vite's modulePreload polyfill is **disabled** (it injects an inline script).
- All charts are hand-written inline SVG/CSS — **no charting library**, nothing new to allow.

---

## 6. Frontend architecture

### The data adapter — the key design decision

Every screen calls `data.<entity>.list/create/update/remove` and **never knows which backend
it's on**:

```js
// console/src/lib/data/index.js
export const data = isSupabaseConfigured ? supabaseAdapter : localAdapter;
```

Both adapters expose an identical surface. `supabaseAdapter` issues PostgREST queries;
`localAdapter` reads/writes `localStorage` and mirrors Postgres FK behaviour (cascades, set-null)
by hand. This is why the entire product demos with zero backend setup, and why adding a module
means touching one adapter line rather than every screen.

Composite-keyed tables (`role_permissions`) get purpose-built repos with `set`/`setMany` upserts
instead of the generic id-based CRUD.

### Auth flow

```
/signin.html ──sign in──► Supabase Auth ──► redirect to /app
                                              │
                                     <Gate> in App.jsx
                                              │
              ┌───────────────┬───────────────┴───────────────┐
        signed out        no staff row                    all good
              │                │                              │
      → /signin.html    "no staff record" screen        render console
                          (+ exact fix SQL)
```

`AuthProvider` loads the session, fetches the matching `staff` row, and exposes
`{ session, staff, status, isPlatformAdmin, signIn, signOut }`.

### Shared UI

- **`components/ui.jsx`** — Modal, ConfirmModal, Field, PageHeader, Avatar, Chip, Pagination,
  EmptyState, TableSkeleton, SearchInline. Reuse these; don't reinvent.
- **`components/charts.jsx`** — `Donut` + `DonutLegend` + `TrendLine` (inline SVG,
  Catmull-Rom smoothing) and `BarChart` + `HBars` (CSS). Used by Dashboard, Financials and
  Analytics so all three read as one system. SVG theme colours arrive via CSS classes, because
  SVG presentation attributes can't read `var()`.
- **`index.css`** — the whole design system: dark theme, `--primary` blue, cyan/violet accents,
  Bricolage Grotesque + Inter.

---

## 7. The 13 modules

| # | Module | Route | Key files | Tables |
|---|---|---|---|---|
| 1 | **Dashboard** | `/` | `Dashboard.jsx` | *(derived)* |
| 2 | **Booking Management** | `/bookings` | `Bookings.jsx`, `bookings/*` | `bookings` |
| 3 | **Financial Management** | `/financials` | `Financials.jsx`, `finance/*` | `finance_entries` |
| 4 | **Academy** | `/organisation` | `Organisations.jsx` | `organisations` |
| 5 | **Time Slots** | `/timeslot` | `TimeSlots.jsx` | `time_slots` |
| 6 | **Sports Management** | `/facility-management` | `Facility.jsx`, `facility/*` | `venues`, `sports`, `courts`, `time_slots` |
| 7 | **Clients** | `/clients` | `Clients.jsx`, `clients/*` | `clients` |
| 8 | **Contracts** | `/contracts` | `Contracts.jsx`, `contracts/*` | `contracts` |
| 9 | **Reviews** | `/reviews` | `Reviews.jsx`, `reviews/*` | `reviews` |
| 10 | **Tickets** | `/tickets` | `Tickets.jsx`, `tickets/*` | `tickets` |
| 11 | **Analytics** | `/analytics` | `Analytics.jsx` | *(derived)* |
| 12 | **Users & Staff** | `/users` | `Users.jsx`, `users/*` | `staff`, `org_members` |
| 13 | **User Role** / **Actions** | `/users/roles`, `/actions` | `Roles.jsx`, `Actions.jsx` | `roles`, `role_permissions`, `actions` |

**Highlights worth demoing**

- **Bookings** — Day resource-timeline (courts × hours), Week agenda, Month grid, plus
  Transactions and Inventory tabs. Clicking an empty slot pre-fills a booking.
- **Financials** — an **Overview** tab (expense donut, auto-generated "good / watch-outs"
  insights, running-balance trend line, revenue mix) and a **Ledger** tab with real client-side
  CSV export.
- **Dashboard / Analytics** — fully derived from `bookings` + `finance_entries` + `reviews`;
  no tables of their own.
- **Clients** — lifetime value and booking count derived by matching `bookings.client_name`
  within the org.
- **Tickets** — kanban board with move controls and optimistic updates.
- **Roles** — role × 33-action matrix with module-level bulk toggles.

---

## 8. API surface

The application has **no REST API of its own** — the browser talks to Supabase directly. The
only server-side endpoints are the partner-integration test rig
(`server/src/routes/integrations.js`), namespaced under `/api` so it can be deleted wholesale
once real partner APIs arrive.

This rig proves the Hudle / Playo / District plumbing before those credentials exist.

### `GET /api/integrations/health`

Reports configuration without echoing secrets.

```jsonc
{
  "ok": true,
  "mockFeed": "GET /api/mock/partner/bookings",
  "webhook": "POST /api/webhooks/bookings",
  "supabaseUrl": "https://mjkkrgpntlqbioevxdvw.supabase.co",
  "serviceKeyConfigured": true,      // is service_role present in server/.env?
  "webhookSecretIsDefault": true     // still using "dev-secret"?
}
```

### `GET /api/mock/partner/bookings` — the pull source

Stands in for a partner's API. No auth, no secrets. Dates are anchored to today so the feed
always looks live. Optional `?since=YYYY-MM-DD` and `?provider=`.

```jsonc
{
  "provider": "hudle",
  "generated_at": "2026-07-27T10:19:30.228Z",
  "count": 4,
  "bookings": [
    {
      "reference": "HDL-100231",
      "status": "confirmed",
      "customer": { "name": "Aditya Menon", "phone": "98110 44001" },
      "facility": { "venue": "Indoor Badminton", "court": "Badminton Court 1", "sport": "Badminton" },
      "slot":     { "date": "2026-07-28", "start": "18:00", "end": "19:00" },
      "payment":  { "amount": 600, "currency": "INR", "status": "paid" }
    }
  ]
}
```

**Consumed by** the **"Sync from partner"** button on `/bookings`
(`console/src/lib/integrations/partnerSync.js`), which:

1. fetches the feed,
2. resolves `venue` / `court` **by name** within the selected organisation,
3. writes through the normal data adapter — so it **obeys RLS** in Supabase mode and works
   unchanged in demo mode,
4. reconciles Financials for anything imported.

### `POST /api/webhooks/bookings` — the push receiver

The real webhook direction: a partner calls *us* when a booking happens.

```bash
curl -X POST http://localhost:8420/api/webhooks/bookings \
  -H "Content-Type: application/json" \
  -H "x-playmetric-secret: dev-secret" \
  -d '{
    "provider": "hudle",
    "org_id": "1787e9bd-c42e-4279-aa9d-b791095ba1fe",
    "bookings": [{
      "reference": "HDL-900001",
      "status": "confirmed",
      "customer": { "name": "Test User", "phone": "90000 12345" },
      "facility": { "venue": "Indoor Badminton", "court": "Badminton Court 1" },
      "slot":     { "date": "2026-07-28", "start": "20:00", "end": "21:00" },
      "payment":  { "amount": 850, "currency": "INR", "status": "paid" }
    }]
  }'
```

```jsonc
{ "ok": true, "received": 1, "created": 1, "updated": 0,
  "results": [{ "reference": "HDL-900001", "action": "created", "id": "c77ee45a-…" }] }
```

| Response | Meaning |
|---|---|
| `200` | Written to Supabase |
| `400` | Missing `org_id` / empty payload |
| `401` | Bad or missing `x-playmetric-secret` (timing-safe compare) |
| `503` | `SUPABASE_SERVICE_ROLE_KEY` not set on the server |

Or use the CLI helper:

```bash
node server/scripts/send-test-webhook.js --org <ORG_UUID> [--amount 1250] [--status pending] [--ref HDL-123]
```

**Why this one endpoint is server-side:** it writes with `service_role`, which bypasses RLS.
That key must never reach the browser, so the write happens in Express (over PostgREST) and the
key stays in `server/.env`.

**Idempotency (both paths):** rows key on `bookings.external_ref`, unique per org where
non-null (migration 0012). Re-sending the same reference **updates** the booking instead of
duplicating it — so partner retries are safe.

---

## 9. Business logic worth knowing

### Booking → Financials auto-sync

Saving a booking reconciles a linked `finance_entries` row (`syncBookingFinance()` in
`Bookings.jsx`):

| Booking status | Financial effect |
|---|---|
| `confirmed` / `completed` | Posts a **`Bookings` inflow** for the booking amount |
| `cancelled` | Adds a **`Refund` outflow** of the same amount — both rows stay visible, net zero |
| `pending` | Removes any generated rows |

Linked by `finance_entries.booking_id` (0010), so it reconciles idempotently no matter how many
times a booking is edited, and degrades gracefully (skips silently) if 0010 isn't applied.

### Money inputs use `step="any"`

A numeric `step` other than `any` makes the browser reject non-multiples via native
`stepMismatch` and **silently refuse to submit the form** — e.g. `step="50"` blocked ₹777.
Don't reintroduce it.

### Dates are local-time throughout

`pages/bookings/dates.js` builds `YYYY-MM-DD` strings from local date parts, never
`toISOString()`, so a booking never slips a day across timezones.

---

## 10. Project journey

| Phase | What happened |
|---|---|
| **1. Marketing site** | Static landing page + a football-themed sign-in page under a strict CSP. |
| **2. First backend** | Express + MongoDB admin backend. |
| **3. The pivot** | Client asked for the full 13-module console → **Supabase chosen as the single backend**. MongoDB and the custom API were **removed entirely**; Express demoted to a static host. |
| **4. Console foundation** | React + Vite SPA, the swappable data-adapter pattern, organisations + facility config on real Postgres with RLS. |
| **5. Auth unification** | Marketing site's auth and lead capture moved onto Supabase. Self-serve academy signup via the `0003` onboarding trigger. |
| **6. Same-origin `/app`** | Console built into `console/dist` and served under the marketing origin so the auth session is shared. Standalone console login retired. |
| **7. Per-tenant scoping** | `isPlatformAdmin` introduced; org pickers hidden and auto-scoped for academy owners across every screen. |
| **8. Module build-out** | Bookings → Financials → Dashboard → Clients → Contracts → Reviews → Tickets → Analytics, each with its own migration, seed mirror, adapter entry and UI. |
| **9. Visualization pass** | Inline-SVG donut + trend charts, the Financials **Overview** dashboard, then shared across Dashboard and Analytics. |
| **10. RBAC backbone** | `actions` / `roles` / `role_permissions`, the Users, Roles and Actions screens — completing all 13 modules. Fixed two RLS policies that made a staff directory impossible. |
| **11. Integration rig** | Mock partner feed, pull-sync button, and a secret-guarded webhook receiver with `external_ref` idempotency. |

**Things found and fixed along the way**

- `staff_select` only ever returned *yourself* — colleagues were invisible, so a staff directory
  couldn't work. Widened in 0011 via `shares_org_with()`.
- `org_members` writes were platform-admin only, so an academy owner could never assign a role
  to their own staff. Widened in 0011.
- `step="50"` on money inputs silently blocked form submission for non-multiples.
- Money-formatted chart axes printed "₹5" on *count* data; `TrendLine`/`DonutLegend` now take
  formatter props.
- `process.exit()` in the webhook CLI tripped a libuv assertion on Windows; replaced with
  `process.exitCode`.

---

## 11. Known gaps & next steps

**Deliberate stubs (honest placeholders, clearly labelled in the UI)**

- Finance **CSV import** — export is real; the import parser is intended to be shared with the
  partner-sync work.
- Booking **Documents** and **Reviews** sub-tabs.

**Known limitations**

- No double-booking validation on create — the Day timeline assumes one booking per court per
  slot.
- Client LTV joins on `bookings.client_name` (text) rather than a `client_id` FK. A client
  picker in the booking form is the proper fix.
- The webhook does **not** post revenue to Financials (that sync currently runs console-side on
  save). The pull-sync path does both.
- RBAC is **modelled and editable but not yet enforced** — action codes don't gate route access
  at runtime.
- Migrations are applied by hand; no Supabase CLI wired up.

**Next up**

1. Enforce RBAC at the route level using the action codes.
2. Replace the mock partner feed with real Hudle / Playo / District APIs (auth, pagination,
   field mapping) — the mapping seam already exists in `partnerSync.js` and `integrations.js`.
3. Move booking-revenue posting server-side so webhook bookings hit Financials too.
4. `bookings.client_id` FK + client picker.

---

## Contributing notes

Adding a module follows one path every time:

1. New `supabase/migrations/000N_*.sql` — table + indexes + RLS on `org_id`.
2. Mirror the shape in `console/src/lib/data/seedData.js`.
3. Add the entity to **both** adapters.
4. Build the page reusing `components/ui.jsx` and `components/charts.jsx`.
5. Apply the `isPlatformAdmin` scoping pattern.
6. Add the route in `App.jsx`.

See [API_calls.md](API_calls.md) for a plain-English tour of how the pieces talk to each other.
