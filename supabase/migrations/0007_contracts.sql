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
