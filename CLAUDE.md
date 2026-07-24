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
├── server/            Slim Express STATIC HOST for public/ (port 8420). CSP only, no DB/API.
├── console/           React + Vite admin console SPA (port 5173). The real product.
├── supabase/          SQL migrations + seed (run manually in the Supabase dashboard)
└── .claude/launch.json  Preview configs for both servers
```

---

## Running it

| App | Command | Port | Notes |
|-----|---------|------|-------|
| Marketing site | `cd server && npm run dev` | 8420 | Express serves `../public` with a strict CSP |
| Admin console | `cd console && npm run dev` | 5173 | Vite dev server |

Both are also defined in `.claude/launch.json` (`playmetric-server`, `playmetric-console`)
for the preview tools. **Always use the preview tools / launch.json, never bare shell, to run
dev servers.**

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
  3. Staff bootstrap block at the bottom of `supabase/seed.sql` (insert yourself into `staff`
     with `is_platform_admin = true`).
- `supabase/seed.sql` seeds Sportizo/Calirox/Demo + their venues/sports/courts/timeslots.
  **Keep it in sync with `console/src/lib/data/seedData.js`** (the local-mode mirror).

### Auth & RLS model — READ THIS
- Auth = Supabase Auth (email confirmation currently **ON**).
- `staff` mirrors `auth.users`. `org_members` maps staff→org. `is_platform_admin=true` = sees
  all tenants. RLS on every table is keyed on org membership via the SECURITY DEFINER helper
  `is_org_member()` (avoids policy recursion).
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
- **Design system** in `src/index.css`: dark, `--primary` blue, cyan/violet accents,
  Bricolage Grotesque (display) + Inter (body). Sidebar groups mirror the live console exactly.

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

**Built & live:** Organisations (Academy, `/organisation`), Facility Management
(`/facility-management` — Venues/Sports/Courts/Time Slots tabs), standalone Time Slots
(`/timeslot`).

**Honest "Not built yet" stubs:** Dashboard, Booking Management, Financial Management, User
Role, Users & Staff, Actions & Hierarchy, Contracts, Clients, Analytics, Reviews, Tickets.
Route + sidebar are wired; the page renders a `Placeholder`.

**Recommended next:** the **RBAC backbone (Users / Roles / Actions)** — every later module
wants to check permissions against it, so build it before feature screens. Alternative:
**Booking Management** (most demo-friendly; courts + time-slots now exist to book against).
Decision was left to the user.

---

## Working notes / gotchas
- **In-app browser screenshots have been flaky all project** (blank frames / stale composites).
  Verify via `get_page_text`, `read_page`, `javascript_tool` (DOM), and network requests —
  not screenshots alone.
- **Never share/commit the Supabase service_role key.** Anon key is fine.
- Two bits of harmless housekeeping outstanding: a `pmtester` test auth user in Supabase, and
  the orphaned local `playmetric` MongoDB database (nothing uses it). User to clean up if/when.
- GitHub repo: `github.com/prantikroy1234/PlayMetric` (public). The console + supabase +
  Mongo-removal changes are **uncommitted** as of this writing.

## History (how we got here)
Started as a marketing site + Express/Mongo admin. Built a football-themed sign-in page, then
the client asked for the full 13-module console → chose Supabase as the single backend → built
the console (React+Vite) with orgs + facility config on real Postgres+RLS → migrated the
marketing site's auth and lead capture onto Supabase and **removed MongoDB entirely**.
