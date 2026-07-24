-- ============================================================================
-- PlayMetric — 0001_init
-- Tenancy root (organisations) + facility configuration
-- (venues, sports, courts, time_slots), plus the minimum staff/role
-- scaffolding required for RLS to mean anything.
--
-- Tenancy model: an organisation IS the tenant. Every tenant-owned table
-- carries org_id and is guarded by RLS. Staff are granted access to an org
-- via org_members. A platform admin (PlayMetric's own team) sees everything.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff (console users). Mirrors auth.users; clients are a separate concern
-- and deliberately do NOT live here.
-- ---------------------------------------------------------------------------
create table public.staff (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  email             text not null unique,
  phone             text,
  employee_code     text unique,
  department        text not null default 'General',
  -- PlayMetric's own team: can see and administer every organisation.
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.organisations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- Chip shown in the directory; also the basis for the tenant subdomain.
  subdomain       text not null unique,
  -- Full host. Defaults to <subdomain>.playmetric.in but stays editable,
  -- because live data already has cases where they diverge.
  domain          text,
  code            text,
  office_location text,
  -- Deterministic avatar tint in the UI.
  accent          text not null default 'cyan',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Which staff can act inside which organisation.
create table public.org_members (
  org_id     uuid not null references public.organisations(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  role_key   text not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (org_id, staff_id)
);

-- ---------------------------------------------------------------------------
-- Facility configuration
-- ---------------------------------------------------------------------------
create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  name       text not null,
  location   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table public.sports (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  -- Nullable: a sport can be configured before it's pinned to a venue.
  venue_id   uuid references public.venues(id) on delete set null,
  name       text not null,
  icon       text not null default 'racket',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  venue_id   uuid not null references public.venues(id) on delete cascade,
  sport_id   uuid references public.sports(id) on delete set null,
  name       text not null,
  surface    text,
  capacity   integer,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name)
);

-- Global booking intervals, defined per organisation.
create table public.time_slots (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  label      text not null,
  start_time time not null,
  end_time   time not null,
  -- 0=Sunday .. 6=Saturday. Empty array means "every day".
  days       smallint[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_slots_valid_range check (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- Indexes (every tenant table is filtered by org_id constantly)
-- ---------------------------------------------------------------------------
create index on public.org_members (staff_id);
create index on public.venues (org_id);
create index on public.sports (org_id);
create index on public.sports (venue_id);
create index on public.courts (org_id);
create index on public.courts (venue_id);
create index on public.courts (sport_id);
create index on public.time_slots (org_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'staff','organisations','venues','sports','courts','time_slots'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Access helpers.
-- SECURITY DEFINER so that policies on org_members don't recurse when a
-- policy on another table needs to consult membership.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.is_platform_admin
  );
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.org_members m
    where m.org_id = target_org and m.staff_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Nothing is readable without an authenticated staff identity. Tenant tables
-- are gated on org membership; platform admins bypass via is_org_member().
-- ---------------------------------------------------------------------------
alter table public.staff         enable row level security;
alter table public.organisations enable row level security;
alter table public.org_members   enable row level security;
alter table public.venues        enable row level security;
alter table public.sports        enable row level security;
alter table public.courts        enable row level security;
alter table public.time_slots    enable row level security;

-- staff: you can always read yourself; platform admins read everyone.
create policy staff_select on public.staff
  for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy staff_update_self on public.staff
  for update to authenticated
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

-- org_members: visible to fellow members of that org.
create policy org_members_select on public.org_members
  for select to authenticated
  using (public.is_org_member(org_id));

create policy org_members_write on public.org_members
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- organisations: members read their own; only platform admins create/remove.
create policy organisations_select on public.organisations
  for select to authenticated
  using (public.is_org_member(id));

create policy organisations_insert on public.organisations
  for insert to authenticated
  with check (public.is_platform_admin());

create policy organisations_update on public.organisations
  for update to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

create policy organisations_delete on public.organisations
  for delete to authenticated
  using (public.is_platform_admin());

-- Tenant-owned facility tables: uniform membership gate.
do $$
declare t text;
begin
  foreach t in array array['venues','sports','courts','time_slots'] loop
    execute format(
      'create policy %I_select on public.%I for select to authenticated
         using (public.is_org_member(org_id))', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated
         with check (public.is_org_member(org_id))', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated
         using (public.is_org_member(org_id))
         with check (public.is_org_member(org_id))', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated
         using (public.is_org_member(org_id))', t, t);
  end loop;
end $$;
