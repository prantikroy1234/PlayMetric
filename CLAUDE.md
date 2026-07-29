# PlayMetric — Project Guide

Multi-tenant **B2B SaaS for sports academies**. This is a **client project** (client owns
playmetric.in). The live console runs on MongoDB; the client team has no access to migrate
its data, so this rebuild starts fresh with **seeded demo data**.

Tenants seen in the real product: **Sportizo, Calirox, Demo** — each an *organisation* with
its own venues → courts, sports, and time slots.

---

## Architecture (one sentence)

**Supabase is the single backend for everything** (Postgres + Auth + RLS). There are two
frontends: a static **marketing site** and a React **admin console**. There is **no custom
API server** — the old Express+MongoDB backend was fully removed on 2026-07-23.

```
PlayMetric/
├── public/            Static marketing site (hero, football sign-in, Book-a-Demo)
├── server/            Slim Express STATIC HOST (port 8420). Serves public/ AND the built
│                      console at /app (same-origin). CSP only, no DB/API.
├── console/           React + Vite admin console SPA. Dev on 5173 (base /app/); in prod it's
│                      built to console/dist and served by the Express host at /app.
├── supabase/          SQL migrations + seed (run manually in the Supabase dashboard)
└── .claude/launch.json  Preview configs for both servers
```

**Same-origin `/app` (built 2026-07-25):** the console is served under the marketing origin at
`/app` so it shares the Supabase auth session (localStorage is per-origin). `/signin` success →
`/app`; the console's `<Gate>` bounces unauthenticated visitors back to `/signin.html`. The
console's old standalone login form is retired (kept only as `NoStaffRecord`). Vite `base` is
`/app/`, react-router `basename="/app"`, and the modulePreload polyfill is disabled so no inline
`<script>` violates the CSP.

---

## Running it

| App | Command | Port | Notes |
|-----|---------|------|-------|
| Marketing site + console | `cd server && npm run dev` | 8420 | Express serves `../public` and the built console at `/app`, strict CSP |
| Admin console (dev) | `cd console && npm run dev` | 5173 | Vite dev server; the app lives at **`/app/`** (base path) |
| **Console — LOCAL DEMO** | `cd console && npm run demo` | 5173 | **Auth-free seeded demo at `:5173/app/`.** Ignores `.env.local` and runs on browser-stored data — the easy path for demos/testing |
| Build the console | `cd console && npm run build` | — | Emits `console/dist` (gitignored). **Required before `/app` serves anything** on the Express host |
| Build for demo | `cd console && npm run build:demo` | — | Local-demo `console/dist` (auth-free), to serve the whole site (marketing + console) demo via the Express host |

**Demo-mode toggle (added 2026-07-25):** `npm run demo` / `npm run build:demo` pass `--mode demo`,
which loads `console/.env.demo` (`VITE_DATA_MODE=local`). `supabaseClient.js` treats that as a
hard override → the auth-free localStorage demo even when `.env.local` has real Supabase keys.
`.env.local` never sets `VITE_DATA_MODE`, so it can't clobber the flag; normal `dev`/`build` are
unaffected (Supabase mode). No file renaming needed to flip between demo and the real backend.
The demo's stub identity is **"Local Demo"** (platform admin) — there is no login/credential.

Both servers are also defined in `.claude/launch.json` (`playmetric-server`, `playmetric-console`)
for the preview tools. **Always use the preview tools / launch.json, never bare shell, to run
dev servers.** The **integrated flow** (sign-in → console) only works on the Express host at
`:8420/app` because the shared Supabase session is per-origin — so build the console first, then
run the marketing server. Standalone console dev on `:5173/app/` uses local demo data unless
`console/.env.local` is set (then it needs a session and will bounce to `/signin.html`; override
the target with `VITE_SIGNIN_URL`).

---

## Supabase

- **Project ref:** `mjkkrgpntlqbioevxdvw` · URL `https://mjkkrgpntlqbioevxdvw.supabase.co`
- **Keys policy:** the **anon key is public by design** — it's committed in
  `public/js/supabase-config.js` and `console/.env.local`, and that is safe because RLS gates
  everything. **The `service_role` key must NEVER be shared, committed, or put in any
  frontend** — it bypasses RLS entirely.
- **Migrations are applied by hand** in the dashboard SQL Editor (no CLI wired up):
  1. `supabase/migrations/0001_init.sql` — orgs, venues, sports, courts, time_slots, staff,
     org_members, RLS, helper functions.
  2. `supabase/migrations/0002_leads.sql` — public "Book a Demo" lead capture.
  3. `supabase/migrations/0003_onboarding.sql` — trigger on `auth.users` insert that
     auto-provisions org + owner `staff` row + `org_members` when a signup carries an
     `academy_name` (guarded so hand-made platform admins are skipped).
  4. `supabase/migrations/0004_bookings.sql` — `bookings` table (manual court reservations)
     + RLS on `org_id`. `source` defaults to `'manual'` so later Hudle/Playo/District imports
     can be told apart without a schema change.
  5. `supabase/migrations/0005_finance.sql` — `finance_entries` table (manual inflow/outflow
     ledger; `direction` in/out, `category`, `amount`, `entry_date`) + RLS on `org_id`. Kept
     separate from bookings so custom/one-off entries and future CSV imports have a home.
  6. `supabase/migrations/0006_clients.sql` — `clients` table (directory of players/teams/
     corporate accounts; `type`, contact fields) + RLS on `org_id`. No FK to bookings yet —
     LTV/booking-count are derived by matching `bookings.client_name` within the org.
  7. `supabase/migrations/0007_contracts.sql` — `contracts` table (leases/services/sponsorships/
     memberships; `type`, `status`, start/end dates, value, nullable `client_id` FK → clients)
     + RLS on `org_id`.
  8. `supabase/migrations/0008_reviews.sql` — `reviews` table (rating 1–5, title/body,
     author_name, status published|hidden, nullable client/venue/sport FKs, review_date)
     + RLS on `org_id`.
  9. `supabase/migrations/0009_tickets.sql` — `tickets` table (title/description, category,
     priority low|medium|high, status open|in_progress|resolved|closed, assignee, due_date,
     nullable `client_id` FK) + RLS on `org_id`.
  10. `supabase/migrations/0010_finance_booking_link.sql` — adds `finance_entries.booking_id`
     (nullable FK → bookings, on delete cascade) so the console auto-posts booking revenue /
     refunds. **Additive; run it on top of an existing DB.**
  11. Staff bootstrap block at the bottom of `supabase/seed.sql` (insert yourself into `staff`
     with `is_platform_admin = true`).
- `supabase/apply_new.sql` is a generated convenience bundle (migrations 0004–0010 + seed) for a
  **fresh** database; on an existing DB run `seed.sql` (+ `0010` if missing) instead.
- `supabase/seed.sql` seeds Sportizo/Calirox/Demo + their venues/sports/courts/timeslots/
  bookings/finance_entries. **Keep it in sync with `console/src/lib/data/seedData.js`** (the
  local-mode mirror). Bookings and finance rows are anchored to `current_date`±n so the
  calendar and ledger always look populated.

### Auth & RLS model — READ THIS
- Auth = Supabase Auth (email confirmation currently **ON**).
- **Self-serve model (B2B):** academies **sign up themselves** on the marketing `/signin` page
  (Academy name + Your name + email + password). The `0003` trigger provisions their org +
  owner staff row automatically, so they land in a console scoped to their own academy. Signup
  passes metadata keys `academy_name` + `full_name` — the trigger reads exactly those.
- `staff` mirrors `auth.users`. `org_members` maps staff→org. `is_platform_admin=true` = sees
  all tenants. RLS on every table is keyed on org membership via the SECURITY DEFINER helper
  `is_org_member()` (avoids policy recursion).
- **Per-tenant scoping (BUILT 2026-07-25 across current screens):** `useAuth()` now exposes
  `isPlatformAdmin`. Academy owners no longer see the org-picker/"All Organisations" controls —
  the picker is hidden and the single org auto-selected on Facility, Time Slots, and Bookings;
  the Academy (Organisations) screen hides Add/Delete and retitles to "Your Academy". Platform
  admins keep the full multi-org view. RLS still isolates the *data*; this is the UI layer.
  **Apply the same `isPlatformAdmin` pattern to every new screen.**
- **THE #1 GOTCHA:** a signed-in user with **no `staff` row correctly sees ZERO rows** — this
  is RLS working, not a bug. If the console looks empty after login, that's almost always why.
  The console shows a "no staff record" screen with the exact fix SQL.
- The live product also has **4-level app-RBAC**: Subsystem (CRM) → Module → Submodule →
  Action codes (`ac-101`…). That layers **on top of** RLS (RLS = *which org's rows*; action
  codes = *which screens a role may open*). Not built yet — see module status below.

---

## Console conventions (`console/`)

- **Data layer** (`src/lib/data/`): a swappable adapter. `localAdapter` (localStorage demo
  data) vs `supabaseAdapter`, auto-selected by whether `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` are set in `.env.local`. **Screens call `data.<entity>.list/create/
  update/remove` and never know which backend they're on.** Add new entities here.
- **Auth** (`src/lib/auth.jsx`): `AuthProvider` + `useAuth()`. `<Gate>` in `App.jsx` decides
  login / "no staff record" / console.
- **Shared UI** (`src/components/ui.jsx`): `Modal`, `ConfirmModal`, `Field`, `PageHeader`,
  `Avatar`, `Chip`, `Pagination`, `EmptyState`, `TableSkeleton`, `SearchInline`, toasts via
  `src/lib/toast.jsx` (`useToast()`). Reuse these — don't reinvent.
- **Icons** (`src/components/Icons.jsx`): one stroke-based set, all `currentColor`.
- **Facility screens** share `pages/facility/` (`useFacility` hook, `EntityTable`, `forms.jsx`)
  — good template for future CRUD modules.
- **Booking screens** live in `pages/bookings/` (`views.jsx` = Day resource-timeline / Week
  agenda / Month grid + Transactions table; `BookingForm.jsx`; `dates.js` = local-time date
  helpers) with `pages/Bookings.jsx` as the shell. Status colours are driven by the shared
  `.is-confirmed/.is-pending/.is-completed/.is-cancelled` CSS var tokens in `index.css`.
  **Booking → Financials sync:** on save, `syncBookingFinance()` reconciles a `finance_entries`
  row linked by `booking_id` — confirmed/completed posts a `Bookings` **inflow**; cancelled adds
  a `Refund` **outflow** (net zero, both visible); pending removes them. Idempotent from existing
  linked rows; degrades gracefully (skips) if migration `0010` isn't applied.
- **Money inputs use `step="any"`** (Booking/Finance/Contract forms). Any other numeric `step`
  makes the browser reject non-multiples via native `stepMismatch`, silently blocking submit —
  don't reintroduce it.
- **Shared charts** live in `components/charts.jsx`: SVG `Donut` + `DonutLegend` + `TrendLine`
  (Catmull-Rom smoothing, `PALETTE`) plus CSS-based `BarChart` + `HBars`. Used by Financials,
  Dashboard, and Analytics. SVG theme colours come via CSS classes (presentation attributes
  can't read `var()`). `DonutLegend` takes an optional `format` and `TrendLine` an optional
  `formatY` — pass `String` when the values are counts, not money (default is ₹). `HBars` takes
  a `variant` (e.g. `"in"` for the green fill). `.donut*` / `.trend__*` / `.barchart*` / `.hbar*`
  tokens in `index.css`. **Donut hover:** each arc is a `.donut__seg` carrying `--sw`/`--swh`
  (base vs grown stroke width); CSS `:hover` thickens it (same colour) and dims the rest. The
  radius reserves `GROW+2`px headroom so the pop never clips the viewBox.
- **Finance screen** is `pages/Financials.jsx` with two sub-tabs. **Overview** (`pages/finance/
  Overview.jsx`, using `components/charts`) is a visualization dashboard: summary stats, a "where money
  goes" expense **donut** (inline-SVG arcs), auto-generated "good / watch-outs" **insights**, a
  **running-balance trend line** (SVG Catmull-Rom smoothing + area gradient + zero baseline),
  and a "where money comes from" revenue bar list. **Ledger** is the entry table + Add Entry
  modal. Charts are pure inline SVG (no library → nothing new for the CSP); theme colours reach
  SVG via CSS classes (presentation attributes can't read `var()`), the categorical palette in
  `charts.jsx` is literal hex. The direction toggle (Ledger) re-scopes the category list;
  summary cards ignore it. CSV export builds a Blob client-side (`a[download]`); import is a
  stub. `.fviz*`, `.donut*`, `.insights*`, `.trend__*`, `.statcard`, `.fin-*` tokens in `index.css`.
- **Dashboard** is `pages/Dashboard.jsx` — read-only, aggregates bookings + finance_entries at
  render (no table). KPI cards, a CSS `BarChart` (bookings this week) + `HBars` (top venues),
  today's schedule, plus the **shared** `Donut` (expense mix) and `TrendLine` (running balance)
  from `components/charts` for a consistent look with Financials. `.kpi*`/`.dashcard`/`.barchart`/
  `.hbar`/`.schedule` tokens in `index.css`. Reuses `bookings/dates.js` + `STATUS_META`.
- **Reviews screen** is `pages/Reviews.jsx` + `pages/reviews/ReviewForm.jsx`. Average rating +
  1–5 distribution bars are derived from the org-scoped reviews; the rating filter/search narrow
  the card list but not the summary. `Stars` (exported from `Reviews.jsx`) renders filled/empty
  `IconStar` (pass `fill="currentColor"`); the form has an interactive `StarPicker`. `.stars`/
  `.star`/`.review-*`/`.rdist*`/`.starpick*` tokens in `index.css`.
- **Tickets screen** is `pages/Tickets.jsx` + `pages/tickets/TicketForm.jsx`. A kanban board
  keyed on `status` (the columns in `COLUMNS`/`ORDER`); the ‹ › card buttons shift a ticket to
  the adjacent status with an optimistic local update then persist. Priority filter + search
  narrow the board; overdue = `daysUntil(due_date) < 0` on open/in-progress tickets. `.kanban`/
  `.kcol*`/`.tcard*`/`.tprio`/`.tmove` tokens in `index.css`.
- **Analytics screen** is `pages/Analytics.jsx` — read-only, no table; aggregates bookings +
  finance + reviews at render and renders entirely with the shared `components/charts`. Reuses
  `Stars` from `Reviews.jsx` and `dashcard`/`kpi` tokens. Org-scoped via `isPlatformAdmin`.
- **Clients screen** is `pages/Clients.jsx` + `pages/clients/ClientForm.jsx`. LTV + booking
  count are derived at render by matching `booking.client_name` to `client.name` within the org
  (`.ctype` type-tag tokens in `index.css`). The proper fix later is a `bookings.client_id` FK
  set via a client picker in the booking form — until then, names are the join key.
- **Contracts screen** is `pages/Contracts.jsx` + `pages/contracts/ContractForm.jsx`. Rows sort
  soonest-ending first; the expiring-soon/expired hint (`.expiry`) is computed from `end_date`
  via `daysUntil()` in `bookings/dates.js` (only for `active` contracts). A linked client
  auto-fills the counterparty; `.cstat`/`.linkchip` tokens in `index.css`.
- **Design system** in `src/index.css`: dark, `--primary` blue, cyan/violet accents,
  Bricolage Grotesque (display) + Inter (body). Sidebar groups mirror the live console exactly.

## Partner booking integration — TEST RIG (added 2026-07-27)

Proves the Hudle/Playo/District plumbing before those APIs exist. Everything is
namespaced under `/api` (`server/src/routes/integrations.js`) so it can be deleted
wholesale later. **This is the only server-side API surface** — the rest is static.

- **Pull (works everywhere, no secrets):** `GET /api/mock/partner/bookings` returns a
  fake partner feed (dates anchored to today). The console's **"Sync from partner"**
  button on `/bookings` fetches it via `lib/integrations/partnerSync.js`, resolves
  venue/court **by name** within the selected org, and writes through the normal data
  adapter — so it obeys RLS in Supabase mode and works unchanged in demo mode. It also
  runs `syncBookingFinance()` over the results, so imported revenue hits Financials.
- **Push (the real webhook):** `POST /api/webhooks/bookings`, guarded by the
  `x-playmetric-secret` header (timing-safe compare). Writes to Supabase server-side
  over PostgREST + `SUPABASE_SERVICE_ROLE_KEY` — **the reason this lives on the server
  and never in the browser.** Returns a clear 503 if that key isn't set. Test it with
  `node server/scripts/send-test-webhook.js --org <ORG_UUID>`.
- **Idempotency:** both paths key on `bookings.external_ref` (migration `0012`, unique
  per org where non-null). Re-running a sync **updates** rather than duplicating.
- `GET /api/integrations/health` reports what's configured without echoing secrets.
- Vite proxies `/api` → `:8420`, so the sync button also works under `npm run dev`.

## Marketing site conventions (`public/`)
- **STRICT CSP** (`server/src/app.js`): `script-src 'self'`, `style-src 'self'` (+ Google
  Fonts), no inline, no CDN. This bit repeatedly. Rules:
  - Vendor libraries locally — supabase-js UMD is at `public/js/vendor/supabase.js`, exposed
    as `window.pmSupabase` via `public/js/supabase-config.js`.
  - All JS/CSS in external files; **never inline `<script>`, `style=""`, or `background-image:
    url()` inline** — use CSS classes.
  - `connectSrc` allows only `'self'` + the Supabase origin.
- The football sign-in page (`signin.html` + `js/auth.js`) uses `pmSupabase.auth.*`. "Book a
  Demo" (`js/main.js`) inserts into the `leads` table. Nav "Sign In" → `/signin.html`.

---

## Module status (console) — 13 total

**Built & live:** **Dashboard (`/`)** — read-only overview aggregating bookings +
finance_entries (KPI cards, weekly bookings bar chart, cash-flow snapshot, today's schedule,
top venues by revenue; org-scoped, no new table), Organisations (Academy, `/organisation`),
Facility Management (`/facility-management` — Venues/Sports/Courts/Time Slots tabs), standalone
Time Slots (`/timeslot`), **Booking Management (`/bookings`)** — Day/Week/Month calendar + New
Booking modal + Transactions ledger + Inventory list; Documents/Reviews sub-tabs are honest
stubs, **Financial Management (`/financials`)** — an **Overview** viz dashboard (expense donut,
good/watch-out insights, running-balance trend line, revenue mix; all inline SVG) plus a
**Ledger** tab (inflow/outflow table, direction filter, Add Entry modal, real client-side CSV
export, honest "coming soon" import stub), **Client Directory (`/clients`)** — players/teams/
corporate accounts with a derived LTV + booking-count column (name-matched to bookings), type
filter, and Add Client modal, **Contracts & Agreements (`/contracts`)** — leases/services/
sponsorships/memberships with status chips, an expiring-soon/expired hint from `end_date`,
status filter, optional client link (auto-fills counterparty), and Add Contract modal,
**Consolidated Reviews (`/reviews`)** — client feedback cards with an average-rating summary +
star distribution bars, star display, rating filter, optional venue/sport/client attribution,
hidden-review support, and an Add Review modal with an interactive star picker,
**Support Tickets (`/tickets`)** — a **kanban board** (Open / In Progress / Resolved / Closed
columns with move-arrow controls), priority chips, category/assignee/client/due-date on each
card, overdue hint, priority filter + search, and a New Ticket modal, **Business Analytics
(`/analytics`)** — a read-only charts page (no new table) aggregating bookings + finance +
reviews: KPI cards, a daily booking-volume trend, booking status-mix donut, ratings breakdown,
revenue-by-venue + bookings-by-sport bars, and a peak-hours chart.

**Honest "Not built yet" stubs:** User Role, Users & Staff, Actions & Hierarchy (the RBAC
backbone). Route + sidebar are wired; the page renders a `Placeholder`.

## ⭐ NEXT SESSION — START HERE (ordered build plan)

The user wants the full per-academy console built out, **one module at a time**, **fully
manual** for now (academy enters data by hand). The Hudle/Playo/District booking-sync
automation comes later, once those APIs are available — do NOT build integrations yet.

✅ **DONE 2026-07-25:** (1) Login → `/app` redirect + per-tenant scoping, (2) Booking
Management, (3) Financial Management (with a charted **Overview** tab), (4) Dashboard (now using
the shared donut/trend charts too), (5) Client Directory, (6) Contracts, (7) Reviews,
(8) Tickets, and (9) Analytics. See the sections above for how they landed.

**Only the RBAC backbone is left** — the last three sidebar stubs. Build in this order:

1. **Users & Staff** (`/users`) — the `staff` + `org_members` tables already exist (0001). Build
   the CRUD: list staff (name, email, employee_code, department, platform-admin flag, org
   membership), Add/Edit modal. NB `staff.id` FKs `auth.users`, so in Supabase mode a real staff
   row needs an auth user — seed/demo can use free rows in local mode. Scope non-admins to their
   own org's members.
2. **User Role** (`/users/roles`) — a roles matrix: roles (owner/manager/employee/…) × modules,
   with allow/deny toggles. New `role` + `role_permissions` tables (or a JSON perms column).
3. **Actions & Hierarchy** (`/actions`) — the 4-level Subsystem → Module → Submodule → Action-code
   model (`ac-101…`), the source of truth the roles matrix references. New `000N_*.sql`
   migration(s) + RLS; mirror in `seedData.js`; add to both adapters; reuse `components/ui.jsx`;
   apply the `isPlatformAdmin` scoping pattern.

Once these land, all 13 modules are real — the console is feature-complete against the live
product's surface, still fully manual (no Hudle/Playo/District sync yet, by design).

**Dashboard note:** it's read-only and derives everything from bookings + finance_entries at
render (no `dashboard` table). Chart widgets (`BarChart`, `HBars`, cash-flow) are plain
CSS/flex — no chart library, so nothing to add to the CSP.

**Follow-ups if asked:** Booking Documents/Reviews sub-tabs are placeholders; the Day timeline
assumes one booking per court per time (no double-booking validation on create yet). Finance
CSV *import* is a stub (parser to be shared with the future booking-sync work); export is real.

Reference screenshots of the target live console for every module were shared 2026-07-24/25
(booking calendar, financial inflow/outflow ledger, roles matrix, users table, actions
hierarchy, contracts, clients LTV table, analytics, reviews, kanban tickets).

Each new module: add the table + RLS to a new `supabase/migrations/000N_*.sql`, mirror the
shape in `console/src/lib/data/seedData.js`, add the entity to the data adapters, and reuse
`components/ui.jsx` + the `pages/facility/` CRUD pattern.

---

## Working notes / gotchas
- **In-app browser screenshots have been flaky all project** (blank frames / stale composites).
  Verify via `get_page_text`, `read_page`, `javascript_tool` (DOM), and network requests —
  not screenshots alone.
- **Never share/commit the Supabase service_role key.** Anon key is fine.
- Two bits of harmless housekeeping outstanding: a `pmtester` test auth user in Supabase, and
  the orphaned local `playmetric` MongoDB database (nothing uses it). User to clean up if/when.
- GitHub repo: `github.com/prantikroy1234/PlayMetric` (public). Everything through the auth
  redesign + onboarding trigger is committed & pushed to `main`. `console/.env.local` and
  `server/.env` (secrets) and `public/media/signin.mp4` (50MB, unused) are gitignored — the
  console reads Supabase creds from `console/.env.local` (present locally, not in git).

## History (how we got here)
Started as a marketing site + Express/Mongo admin. Built a football-themed sign-in page, then
the client asked for the full 13-module console → chose Supabase as the single backend → built
the console (React+Vite) with orgs + facility config on real Postgres+RLS → migrated the
marketing site's auth and lead capture onto Supabase and **removed MongoDB entirely**.
