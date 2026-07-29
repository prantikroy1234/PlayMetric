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
