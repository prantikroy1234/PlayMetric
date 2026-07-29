-- ============================================================================
-- PlayMetric — apply_new.sql  (convenience bundle for a FRESH database)
-- Paste + Run ONCE in the Supabase SQL Editor. Creates the tables added this
-- session + booking→finance link, then seeds demo data. Idempotent seeds.
-- If tables already exist, DON'T run this — run seed.sql (data) and, if you
-- haven't yet, migrations/0010_finance_booking_link.sql (the booking link).
-- ============================================================================

-- >>> migrations/0004_bookings.sql
-- ============================================================================
-- PlayMetric — 0004_bookings
-- Manual booking management. An academy enters bookings by hand (walk-ins,
-- phone reservations, memberships). The `source` column defaults to 'manual'
-- so that when the Hudle/Playo/District sync lands later, imported rows can be
-- distinguished from hand-entered ones without a schema change.
--
-- Tenancy: bookings carry org_id and are gated by the same is_org_member()
-- helper as every other tenant table (see 0001_init).
-- ============================================================================

create table public.bookings (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  -- venue/court/sport are nullable so a booking survives a court being removed
  -- from configuration; the calendar still shows the client and time.
  venue_id     uuid references public.venues(id) on delete set null,
  court_id     uuid references public.courts(id) on delete set null,
  sport_id     uuid references public.sports(id) on delete set null,
  booking_date date not null,
  start_time   time not null,
  end_time     time not null,
  client_name  text not null,
  client_phone text,
  -- confirmed | pending | cancelled | completed
  status       text not null default 'confirmed',
  -- Rupee amount for the session. Kept on the booking so Financials can read
  -- inflow straight from here later.
  amount       numeric(10,2) not null default 0,
  -- 'manual' now; 'hudle' | 'playo' | 'district' once integrations exist.
  source       text not null default 'manual',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint bookings_valid_range check (end_time > start_time),
  constraint bookings_status_check
    check (status in ('confirmed', 'pending', 'cancelled', 'completed'))
);

create index on public.bookings (org_id);
create index on public.bookings (court_id);
create index on public.bookings (org_id, booking_date);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the facility tables.
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;

create policy bookings_select on public.bookings
  for select to authenticated
  using (public.is_org_member(org_id));

create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy bookings_update on public.bookings
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy bookings_delete on public.bookings
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0005_finance.sql
-- ============================================================================
-- PlayMetric — 0005_finance
-- Manual financial ledger. An academy records money in (bookings revenue,
-- memberships, coaching) and money out (rent, salaries, utilities, equipment)
-- by hand. Bookings already carry an `amount`, so inflow could eventually be
-- derived from there — but this table stays SEPARATE so custom/one-off entries
-- (and future CSV imports) live somewhere that isn't tied to a booking row.
--
-- Tenancy: same org_id + is_org_member() gate as every other tenant table.
-- ============================================================================

create table public.finance_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  -- 'inflow' (revenue) | 'outflow' (expense)
  direction  text not null,
  -- Free-form bucket, e.g. Bookings / Membership / Rent / Salaries / Utilities.
  category   text not null,
  label      text not null,
  amount     numeric(10,2) not null default 0,
  entry_date date not null,
  -- Cash / UPI / Card / Bank Transfer — optional.
  method     text,
  notes      text,
  -- 'manual' now; 'csv' | 'bookings' once import/derivation exist.
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_entries_direction_check
    check (direction in ('inflow', 'outflow')),
  constraint finance_entries_amount_check
    check (amount >= 0)
);

create index on public.finance_entries (org_id);
create index on public.finance_entries (org_id, entry_date);

create trigger finance_entries_set_updated_at
  before update on public.finance_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the facility/booking tables.
-- ---------------------------------------------------------------------------
alter table public.finance_entries enable row level security;

create policy finance_entries_select on public.finance_entries
  for select to authenticated
  using (public.is_org_member(org_id));

create policy finance_entries_insert on public.finance_entries
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy finance_entries_update on public.finance_entries
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy finance_entries_delete on public.finance_entries
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0006_clients.sql
-- ============================================================================
-- PlayMetric — 0006_clients
-- Client directory. The people/teams/companies an academy sells court time to.
-- Deliberately SEPARATE from `staff` (console users) — a client never signs in.
--
-- LTV / booking-count are derived, not stored: the console sums a client's
-- bookings by matching name within the org (bookings are captured as free-text
-- client_name today). A proper bookings.client_id FK + a client picker in the
-- booking form is the future upgrade; name-matching keeps the demo honest now.
--
-- Tenancy: same org_id + is_org_member() gate as every other tenant table.
-- ============================================================================

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  name       text not null,
  phone      text,
  email      text,
  -- individual | team | corporate
  type       text not null default 'individual',
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_type_check check (type in ('individual', 'team', 'corporate'))
);

create index on public.clients (org_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the other tenant tables.
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select to authenticated
  using (public.is_org_member(org_id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy clients_update on public.clients
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0007_contracts.sql
-- ============================================================================
-- PlayMetric — 0007_contracts
-- Legal documents an academy manages: venue leases, service agreements,
-- sponsorships, and membership contracts. Manual entry for now.
--
-- `client_id` optionally links a contract to a row in the clients directory
-- (e.g. a corporate membership) — nullable, because most counterparties
-- (landlords, vendors, sponsors) are NOT clients; those keep a free-text
-- `counterparty`.
--
-- Tenancy: same org_id + is_org_member() gate as every other tenant table.
-- ============================================================================

create table public.contracts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  title        text not null,
  counterparty text not null,
  -- lease | service | sponsorship | membership
  type         text not null default 'service',
  -- draft | active | expired | terminated
  status       text not null default 'draft',
  start_date   date,
  end_date     date,
  value        numeric(12,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint contracts_type_check
    check (type in ('lease', 'service', 'sponsorship', 'membership')),
  constraint contracts_status_check
    check (status in ('draft', 'active', 'expired', 'terminated')),
  constraint contracts_valid_range
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index on public.contracts (org_id);
create index on public.contracts (client_id);

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the other tenant tables.
-- ---------------------------------------------------------------------------
alter table public.contracts enable row level security;

create policy contracts_select on public.contracts
  for select to authenticated
  using (public.is_org_member(org_id));

create policy contracts_insert on public.contracts
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy contracts_update on public.contracts
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy contracts_delete on public.contracts
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0008_reviews.sql
-- ============================================================================
-- PlayMetric — 0008_reviews
-- Consolidated client reviews / venue ratings. Manual entry for now (an academy
-- records feedback it collects); later this is where imported Google/Playo
-- reviews would land.
--
-- Optional FKs (client/venue/sport) let a review be attributed and filtered,
-- but stay nullable so a walk-in's feedback can still be captured. `author_name`
-- is the display name (may or may not match a client row).
--
-- Tenancy: same org_id + is_org_member() gate as every other tenant table.
-- ============================================================================

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  venue_id     uuid references public.venues(id) on delete set null,
  sport_id     uuid references public.sports(id) on delete set null,
  rating       smallint not null,
  title        text,
  body         text not null,
  author_name  text not null,
  -- published | hidden
  status       text not null default 'published',
  review_date  date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_status_check check (status in ('published', 'hidden'))
);

create index on public.reviews (org_id);
create index on public.reviews (org_id, rating);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the other tenant tables.
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy reviews_select on public.reviews
  for select to authenticated
  using (public.is_org_member(org_id));

create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy reviews_update on public.reviews
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy reviews_delete on public.reviews
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0009_tickets.sql
-- ============================================================================
-- PlayMetric — 0009_tickets
-- Support / maintenance tickets. Client inquiries, issue tracking, and facility
-- maintenance requests — the kanban board in the console. Manual entry for now.
--
-- `client_id` is optional (a maintenance ticket has no client). `status` is the
-- kanban column; `priority` drives the card colour.
--
-- Tenancy: same org_id + is_org_member() gate as every other tenant table.
-- ============================================================================

create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null,
  description text,
  category    text not null default 'General',
  -- low | medium | high
  priority    text not null default 'medium',
  -- open | in_progress | resolved | closed
  status      text not null default 'open',
  assignee    text,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tickets_priority_check check (priority in ('low', 'medium', 'high')),
  constraint tickets_status_check check (status in ('open', 'in_progress', 'resolved', 'closed'))
);

create index on public.tickets (org_id);
create index on public.tickets (org_id, status);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same membership gate as the other tenant tables.
-- ---------------------------------------------------------------------------
alter table public.tickets enable row level security;

create policy tickets_select on public.tickets
  for select to authenticated
  using (public.is_org_member(org_id));

create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (public.is_org_member(org_id));

create policy tickets_update on public.tickets
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy tickets_delete on public.tickets
  for delete to authenticated
  using (public.is_org_member(org_id));

-- >>> migrations/0010_finance_booking_link.sql
-- ============================================================================
-- PlayMetric — 0010_finance_booking_link
-- Links a finance_entries row back to the booking that generated it, so the
-- console can keep booking revenue and its refund in sync automatically:
--   * booking confirmed/completed  → an 'inflow' entry (category Bookings)
--   * booking cancelled            → a 'Refund' 'outflow' entry reverses it
-- Manual finance entries leave booking_id null. `on delete cascade` cleans up
-- the generated rows if the booking itself is deleted.
--
-- Safe to re-run (guards with IF NOT EXISTS).
-- ============================================================================

alter table public.finance_entries
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create index if not exists finance_entries_booking_id_idx
  on public.finance_entries (booking_id);

-- >>> seed.sql
-- ============================================================================
-- PlayMetric — demo seed
-- Mirrors the organisations/venues/sports visible in the live console so the
-- rebuilt screens look real from the first run.
--
-- Fixed UUIDs are used so child rows can reference parents deterministically
-- and so re-running this file is idempotent.
--
-- NOTE: public.staff references auth.users, so staff cannot be seeded here.
-- After creating your first Supabase Auth user, run the block at the bottom.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
insert into public.organisations (id, name, subdomain, domain, code, office_location, accent) values
  ('11111111-1111-4111-8111-000000000001', 'Sportizo', 'sportizo',  'sportizo.playmetric.in', 'ORG-01',   'Sector 56',           'cyan'),
  ('11111111-1111-4111-8111-000000000002', 'Calirox',  'CALIROXND', 'calirox.playmetric.in',  '1005',     'Sector 56, Gurgaon',  'violet'),
  ('11111111-1111-4111-8111-000000000003', 'Demo',     'demo',      'demo.playmetric.in',     'ORG-0000', 'demo address',        'blue')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------
insert into public.venues (id, org_id, name, location) values
  -- Sportizo (names taken from the Analytics "Venue Popularity" panel)
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Main Tennis Courts', 'Sector 56'),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Indoor Badminton',   'Sector 56'),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000001', 'Cricket Nets',       'Sector 56'),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-000000000001', 'Swimming Pool',      'Sector 56'),
  -- Calirox
  ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-000000000002', 'Sector 56',          'Sector 56, Gurgaon'),
  -- Demo
  ('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-000000000003', 'Badminton Academy',  'demo address')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sports  (the three Calirox/Demo rows match the live Sports Configuration)
-- ---------------------------------------------------------------------------
insert into public.sports (id, org_id, venue_id, name, icon) values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000005', 'Badminton',          'racket'),
  ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000005', 'brazilian jiu jitsu','martial'),
  ('33333333-3333-4333-8333-000000000003', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000006', 'Badminton',          'racket'),
  -- Sportizo
  ('33333333-3333-4333-8333-000000000004', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', 'Tennis',             'racket'),
  ('33333333-3333-4333-8333-000000000005', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', 'Badminton',          'racket'),
  ('33333333-3333-4333-8333-000000000006', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003', 'Cricket',            'cricket'),
  ('33333333-3333-4333-8333-000000000007', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000004', 'Swimming',           'swim')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Courts
-- ---------------------------------------------------------------------------
insert into public.courts (id, org_id, venue_id, sport_id, name, surface, capacity) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000004', 'Tennis Court 1',   'Hard',    4),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000004', 'Tennis Court 2',   'Hard',    4),
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000004', 'Tennis Court 3',   'Clay',    4),
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000005', 'Badminton Court 1','Synthetic',4),
  ('44444444-4444-4444-8444-000000000005', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000005', 'Badminton Court 3','Synthetic',4),
  ('44444444-4444-4444-8444-000000000006', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003', '33333333-3333-4333-8333-000000000006', 'Cricket Net 1',    'Turf',    2),
  ('44444444-4444-4444-8444-000000000007', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000005', '33333333-3333-4333-8333-000000000001', 'Court A',          'Synthetic',4),
  ('44444444-4444-4444-8444-000000000008', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000006', '33333333-3333-4333-8333-000000000003', 'Demo Court 1',     'Synthetic',4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Time slots
-- ---------------------------------------------------------------------------
insert into public.time_slots (id, org_id, label, start_time, end_time, days) values
  ('55555555-5555-4555-8555-000000000001', '11111111-1111-4111-8111-000000000001', 'Morning',      '06:00', '09:00', '{}'),
  ('55555555-5555-4555-8555-000000000002', '11111111-1111-4111-8111-000000000001', 'Midday',       '12:00', '15:00', '{}'),
  ('55555555-5555-4555-8555-000000000003', '11111111-1111-4111-8111-000000000001', 'Evening Peak', '17:00', '21:00', '{}'),
  ('55555555-5555-4555-8555-000000000004', '11111111-1111-4111-8111-000000000002', 'Morning',      '06:30', '10:00', '{}'),
  ('55555555-5555-4555-8555-000000000005', '11111111-1111-4111-8111-000000000002', 'Evening',      '18:00', '22:00', '{}'),
  ('55555555-5555-4555-8555-000000000006', '11111111-1111-4111-8111-000000000003', 'All Day',      '08:00', '20:00', '{}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Bookings (manual). Anchored to current_date + n so the calendar always looks
-- populated regardless of when the seed is run. Mirrors seedData.js.
-- ---------------------------------------------------------------------------
insert into public.bookings
  (id, org_id, venue_id, court_id, sport_id, booking_date, start_time, end_time, client_name, client_phone, status, amount, source, notes) values
  -- Sportizo
  ('66666666-6666-4666-8666-000000000001', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000004', current_date,     '07:00', '08:00', 'Rahul Sharma',  '98110 22001', 'confirmed', 600,  'manual', ''),
  ('66666666-6666-4666-8666-000000000002', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '44444444-4444-4444-8444-000000000004', '33333333-3333-4333-8333-000000000005', current_date,     '18:00', '19:00', 'Priya Nair',    '98110 22002', 'confirmed', 500,  'manual', ''),
  ('66666666-6666-4666-8666-000000000003', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003', '44444444-4444-4444-8444-000000000006', '33333333-3333-4333-8333-000000000006', current_date,     '17:00', '18:30', 'Arjun Mehta',   '98110 22003', 'pending',   900,  'manual', 'Net practice, 6 players'),
  ('66666666-6666-4666-8666-000000000004', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000004', current_date + 1, '06:00', '07:00', 'Karan Singh',   '98110 22004', 'confirmed', 600,  'manual', ''),
  ('66666666-6666-4666-8666-000000000005', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '44444444-4444-4444-8444-000000000005', '33333333-3333-4333-8333-000000000005', current_date + 1, '19:00', '20:00', 'Sneha Rao',     '98110 22005', 'confirmed', 500,  'manual', ''),
  ('66666666-6666-4666-8666-000000000006', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000004', current_date + 2, '08:00', '09:00', 'Vikram Patel',  '98110 22006', 'confirmed', 700,  'manual', ''),
  ('66666666-6666-4666-8666-000000000007', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003', '44444444-4444-4444-8444-000000000006', '33333333-3333-4333-8333-000000000006', current_date + 2, '16:00', '17:00', 'Team Titans',   '98110 22007', 'confirmed', 1200, 'manual', ''),
  ('66666666-6666-4666-8666-000000000008', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '44444444-4444-4444-8444-000000000004', '33333333-3333-4333-8333-000000000005', current_date - 1, '20:00', '21:00', 'Ananya Gupta',  '98110 22008', 'completed', 500,  'manual', ''),
  ('66666666-6666-4666-8666-000000000009', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000004', current_date + 3, '09:00', '10:00', 'Rohan Das',     '98110 22009', 'cancelled', 600,  'manual', 'Client rescheduled'),
  -- Calirox
  ('66666666-6666-4666-8666-000000000010', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000005', '44444444-4444-4444-8444-000000000007', '33333333-3333-4333-8333-000000000001', current_date,     '07:00', '08:00', 'Meera Iyer',    '99870 33001', 'confirmed', 550,  'manual', ''),
  ('66666666-6666-4666-8666-000000000011', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000005', '44444444-4444-4444-8444-000000000007', '33333333-3333-4333-8333-000000000001', current_date + 1, '18:30', '19:30', 'Sameer Khan',   '99870 33002', 'pending',   550,  'manual', ''),
  -- Demo
  ('66666666-6666-4666-8666-000000000012', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000006', '44444444-4444-4444-8444-000000000008', '33333333-3333-4333-8333-000000000003', current_date,     '10:00', '11:00', 'Demo Client',   '90000 00000', 'confirmed', 400,  'manual', ''),
  -- Extra past sessions (repeat visits so client LTV varies)
  ('66666666-6666-4666-8666-000000000013', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000004', current_date - 3, '07:00', '08:00', 'Rahul Sharma',  '98110 22001', 'completed', 600,  'manual', ''),
  ('66666666-6666-4666-8666-000000000014', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003', '44444444-4444-4444-8444-000000000006', '33333333-3333-4333-8333-000000000006', current_date - 5, '16:00', '17:30', 'Team Titans',   '98110 22007', 'completed', 1500, 'manual', ''),
  ('66666666-6666-4666-8666-000000000015', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000002', '44444444-4444-4444-8444-000000000005', '33333333-3333-4333-8333-000000000005', current_date - 4, '18:00', '19:00', 'Priya Nair',    '98110 22002', 'completed', 500,  'manual', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Finance entries (manual ledger). Anchored to current_date - n. Mirrors
-- seedData.js. Kept separate from bookings so custom entries have a home.
-- ---------------------------------------------------------------------------
insert into public.finance_entries
  (id, org_id, direction, category, label, amount, entry_date, method, source, notes) values
  -- Sportizo — inflow
  ('77777777-7777-4777-8777-000000000001', '11111111-1111-4111-8111-000000000001', 'inflow',  'Bookings',    'Court bookings — week collection', 42500, current_date - 2,  'UPI',           'manual', ''),
  ('77777777-7777-4777-8777-000000000002', '11111111-1111-4111-8111-000000000001', 'inflow',  'Membership',  'Monthly membership renewals',      68000, current_date - 6,  'Bank Transfer', 'manual', ''),
  ('77777777-7777-4777-8777-000000000003', '11111111-1111-4111-8111-000000000001', 'inflow',  'Coaching',    'Summer tennis camp fees',          35000, current_date - 10, 'Card',          'manual', '18 kids'),
  ('77777777-7777-4777-8777-000000000004', '11111111-1111-4111-8111-000000000001', 'inflow',  'Events',      'Corporate cricket tournament',     25000, current_date - 14, 'Bank Transfer', 'manual', ''),
  -- Sportizo — outflow
  ('77777777-7777-4777-8777-000000000005', '11111111-1111-4111-8111-000000000001', 'outflow', 'Rent',        'Venue rent — Sector 56',           55000, current_date - 5,  'Bank Transfer', 'manual', ''),
  ('77777777-7777-4777-8777-000000000006', '11111111-1111-4111-8111-000000000001', 'outflow', 'Salaries',    'Coaching + ground staff payroll',  82000, current_date - 4,  'Bank Transfer', 'manual', ''),
  ('77777777-7777-4777-8777-000000000007', '11111111-1111-4111-8111-000000000001', 'outflow', 'Utilities',   'Electricity + water',              14500, current_date - 7,  'UPI',           'manual', ''),
  ('77777777-7777-4777-8777-000000000008', '11111111-1111-4111-8111-000000000001', 'outflow', 'Equipment',   'Tennis balls + net replacements',  9800,  current_date - 9,  'Cash',          'manual', ''),
  ('77777777-7777-4777-8777-000000000009', '11111111-1111-4111-8111-000000000001', 'outflow', 'Maintenance', 'Court resurfacing (Court 3)',      18000, current_date - 16, 'UPI',           'manual', ''),
  ('77777777-7777-4777-8777-000000000010', '11111111-1111-4111-8111-000000000001', 'outflow', 'Marketing',   'Instagram ads + flyers',           6500,  current_date - 12, 'Card',          'manual', ''),
  -- Calirox
  ('77777777-7777-4777-8777-000000000011', '11111111-1111-4111-8111-000000000002', 'inflow',  'Bookings',    'Badminton court collections',      21000, current_date - 3,  'UPI',           'manual', ''),
  ('77777777-7777-4777-8777-000000000012', '11111111-1111-4111-8111-000000000002', 'outflow', 'Salaries',    'Coach payouts',                    28000, current_date - 5,  'Bank Transfer', 'manual', ''),
  ('77777777-7777-4777-8777-000000000013', '11111111-1111-4111-8111-000000000002', 'outflow', 'Utilities',   'Electricity',                      7200,  current_date - 8,  'UPI',           'manual', ''),
  -- Demo
  ('77777777-7777-4777-8777-000000000014', '11111111-1111-4111-8111-000000000003', 'inflow',  'Bookings',    'Demo court bookings',              4800,  current_date - 1,  'Cash',          'manual', ''),
  ('77777777-7777-4777-8777-000000000015', '11111111-1111-4111-8111-000000000003', 'outflow', 'Equipment',   'Shuttlecocks',                     1500,  current_date - 4,  'Cash',          'manual', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Clients (directory). Names mirror booking client_names so the console can
-- resolve LTV / booking counts by name. Mirrors seedData.js.
-- ---------------------------------------------------------------------------
insert into public.clients (id, org_id, name, phone, email, type, notes) values
  ('88888888-8888-4888-8888-000000000001', '11111111-1111-4111-8111-000000000001', 'Rahul Sharma', '98110 22001', 'rahul.sharma@example.com', 'individual', ''),
  ('88888888-8888-4888-8888-000000000002', '11111111-1111-4111-8111-000000000001', 'Priya Nair',   '98110 22002', 'priya.nair@example.com',   'individual', ''),
  ('88888888-8888-4888-8888-000000000003', '11111111-1111-4111-8111-000000000001', 'Arjun Mehta',  '98110 22003', 'arjun.mehta@example.com',  'individual', ''),
  ('88888888-8888-4888-8888-000000000004', '11111111-1111-4111-8111-000000000001', 'Karan Singh',  '98110 22004', 'karan.singh@example.com',  'individual', ''),
  ('88888888-8888-4888-8888-000000000005', '11111111-1111-4111-8111-000000000001', 'Team Titans',  '98110 22007', 'captain@teamtitans.in',    'team',       'Corporate cricket league side'),
  ('88888888-8888-4888-8888-000000000006', '11111111-1111-4111-8111-000000000001', 'Ananya Gupta', '98110 22008', 'ananya.g@example.com',     'individual', ''),
  ('88888888-8888-4888-8888-000000000007', '11111111-1111-4111-8111-000000000002', 'Meera Iyer',   '99870 33001', 'meera.iyer@example.com',   'individual', ''),
  ('88888888-8888-4888-8888-000000000008', '11111111-1111-4111-8111-000000000002', 'Sameer Khan',  '99870 33002', 'sameer.khan@example.com',  'individual', ''),
  ('88888888-8888-4888-8888-000000000009', '11111111-1111-4111-8111-000000000003', 'Demo Client',  '90000 00000', 'demo@example.com',         'corporate',  'Sample corporate account')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Contracts. Dates anchored to current_date so one is expiring soon and one is
-- already expired. Mirrors seedData.js.
-- ---------------------------------------------------------------------------
insert into public.contracts
  (id, org_id, client_id, title, counterparty, type, status, start_date, end_date, value, notes) values
  ('99999999-9999-4999-8999-000000000001', '11111111-1111-4111-8111-000000000001', null,                                     'Venue Lease — Sector 56',            'Sector 56 Realty',        'lease',       'active',  current_date - 320, current_date + 45,  660000, 'Annual lease, renews yearly'),
  ('99999999-9999-4999-8999-000000000002', '11111111-1111-4111-8111-000000000001', null,                                     'Coaching Services Agreement',        'Elite Coaching LLP',      'service',     'active',  current_date - 120, current_date + 240, 180000, ''),
  ('99999999-9999-4999-8999-000000000003', '11111111-1111-4111-8111-000000000001', null,                                     'Beverage Sponsorship',               'HydraFuel Sports Drinks', 'sponsorship', 'active',  current_date - 60,  current_date + 20,  90000,  'Signage + sampling rights'),
  ('99999999-9999-4999-8999-000000000004', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000005', 'Corporate Membership — Team Titans', 'Team Titans',             'membership',  'active',  current_date - 30,  current_date + 335, 120000, 'Priority cricket nets'),
  ('99999999-9999-4999-8999-000000000005', '11111111-1111-4111-8111-000000000001', null,                                     'Grounds Maintenance (2025)',         'GreenTurf Services',      'service',     'expired', current_date - 400, current_date - 35,  75000,  ''),
  ('99999999-9999-4999-8999-000000000006', '11111111-1111-4111-8111-000000000002', null,                                     'Venue Lease — Gurgaon',              'Gurgaon Estates',         'lease',       'active',  current_date - 200, current_date + 150, 420000, ''),
  ('99999999-9999-4999-8999-000000000007', '11111111-1111-4111-8111-000000000002', null,                                     'Annual Membership Plan',             'Calirox Members Pool',    'membership',  'draft',   current_date + 10,  current_date + 375, 0,      'Pending sign-off'),
  ('99999999-9999-4999-8999-000000000008', '11111111-1111-4111-8111-000000000003', null,                                     'Trial Service Agreement',            'Demo Vendor',             'service',     'draft',   current_date,       current_date + 90,  5000,   '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews. review_date anchored to current_date - n. Mirrors seedData.js.
-- ---------------------------------------------------------------------------
insert into public.reviews
  (id, org_id, client_id, venue_id, sport_id, rating, title, body, author_name, status, review_date) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000004', 5, 'Superb tennis courts',        'Well-maintained hard courts and easy online booking. My go-to spot.', 'Rahul Sharma', 'published', current_date - 3),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000002', '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000005', 4, 'Good badminton facility',     'Nice synthetic courts. Evenings get busy so book ahead.',             'Priya Nair',   'published', current_date - 6),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000003', '22222222-2222-4222-8222-000000000003', '33333333-3333-4333-8333-000000000006', 3, 'Nets are okay',               'Practice nets do the job but could use fresh matting.',               'Arjun Mehta',  'published', current_date - 9),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000004', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000004', 5, 'Great coaching',              'Coaches are attentive and the courts are always ready on time.',      'Karan Singh',  'published', current_date - 12),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', '11111111-1111-4111-8111-000000000001', null,                                     '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000005', 4, 'Enjoyable sessions',          'Friendly staff and clean changing rooms.',                            'Sneha Rao',    'published', current_date - 4),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006', '11111111-1111-4111-8111-000000000001', null,                                     '22222222-2222-4222-8222-000000000004', '33333333-3333-4333-8333-000000000007', 2, 'Too crowded',                 'Pool is overcrowded during peak evening hours.',                      'Deepak Verma', 'published', current_date - 2),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', '11111111-1111-4111-8111-000000000002', '88888888-8888-4888-8888-000000000007', '22222222-2222-4222-8222-000000000005', '33333333-3333-4333-8333-000000000001', 5, 'Best badminton in the area',  'Excellent courts and coaching. Highly recommend.',                    'Meera Iyer',   'published', current_date - 5),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000008', '11111111-1111-4111-8111-000000000002', '88888888-8888-4888-8888-000000000008', '22222222-2222-4222-8222-000000000005', '33333333-3333-4333-8333-000000000001', 4, 'Solid experience',            'Good value memberships.',                                             'Sameer Khan',  'hidden',    current_date - 8),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000009', '11111111-1111-4111-8111-000000000003', '88888888-8888-4888-8888-000000000009', '22222222-2222-4222-8222-000000000006', '33333333-3333-4333-8333-000000000003', 5, 'Nice academy',                'Clean, well-run, and friendly.',                                      'Demo Client',  'published', current_date - 1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tickets. due_date anchored to current_date ± n. Mirrors seedData.js.
-- ---------------------------------------------------------------------------
insert into public.tickets
  (id, org_id, client_id, title, description, category, priority, status, assignee, due_date) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', '11111111-1111-4111-8111-000000000001', null,                                     'Leaking roof over Court 3',        'Water dripping onto the clay court after rain — needs sealing.', 'Maintenance', 'high',   'open',        'Ravi',         current_date + 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000001', 'Membership renewal query',         'Rahul asked about upgrading to an annual plan.',                'Billing',     'medium', 'open',        'Front Desk',   current_date + 4),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003', '11111111-1111-4111-8111-000000000001', null,                                     'Broken net on Cricket Net 1',      'Netting torn on the left side.',                                'Maintenance', 'high',   'in_progress', 'Ravi',         current_date + 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000004', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000002', 'Refund request',                   'Priya requested a refund for a cancelled slot.',                'Billing',     'medium', 'in_progress', 'Accounts',     current_date + 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000005', '11111111-1111-4111-8111-000000000001', null,                                     'AC not cooling — Indoor Badminton', 'Reported by evening players.',                                 'Facilities',  'medium', 'resolved',    'Ravi',         current_date - 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000006', '11111111-1111-4111-8111-000000000001', null,                                     'Website booking glitch',           'Double-booking edge case on the public site.',                  'General',     'low',    'closed',      'Tech',         current_date - 5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000007', '11111111-1111-4111-8111-000000000002', null,                                     'Coach schedule conflict',          'Two coaches booked for the same slot.',                         'General',     'medium', 'open',        'Admin',        current_date + 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000008', '11111111-1111-4111-8111-000000000002', null,                                     'Locker room deep clean',           'Monthly deep clean scheduled.',                                 'Maintenance', 'low',    'resolved',    'Housekeeping', current_date - 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000009', '11111111-1111-4111-8111-000000000003', null,                                     'Sample support ticket',            'Demo ticket for the board.',                                    'General',     'low',    'open',        'Demo',         current_date + 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Staff bootstrap — run AFTER creating your first user in Supabase Auth.
-- Replace the email with that user's email.
--
--   insert into public.staff (id, full_name, email, employee_code, is_platform_admin)
--   select id, 'Vivek Tushir', email, 'PM-001', true
--   from auth.users where email = 'you@playmetric.in'
--   on conflict (id) do update set is_platform_admin = true;
--
-- A platform admin sees every organisation, so no org_members rows are needed
-- for them. Scoped staff get access like this:
--
--   insert into public.org_members (org_id, staff_id, role_key)
--   values ('11111111-1111-4111-8111-000000000001', '<staff-uuid>', 'owner');
-- ---------------------------------------------------------------------------
