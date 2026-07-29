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
