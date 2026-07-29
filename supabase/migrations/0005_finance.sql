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
