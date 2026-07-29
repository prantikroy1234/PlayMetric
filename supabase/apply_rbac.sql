-- ============================================================================
-- PlayMetric — apply_rbac.sql
-- Run ONCE in the Supabase SQL Editor to enable the last three modules
-- (Users & Staff, User Role, Actions & Hierarchy) plus partner-booking import.
--
-- Contains:  0011_rbac.sql  +  0012_booking_external_ref.sql  +  RBAC seed rows
-- Safe to re-run: every statement is guarded (if not exists / on conflict).
-- ============================================================================

-- >>> migrations/0011_rbac.sql
-- ============================================================================
-- PlayMetric — 0011_rbac
-- The app-RBAC backbone that layers ON TOP of RLS:
--   RLS  = which ORG's rows you can touch (already enforced everywhere)
--   RBAC = which SCREENS/ACTIONS a role may open, via action codes (ac-101…)
--
-- Three pieces:
--   1. `actions`          — the 4-level capability catalogue:
--                           Subsystem → Module → Submodule → Action (ac-NNN).
--                           GLOBAL (not per-org): it describes the product
--                           itself, so every tenant sees the same tree.
--                           Read: any authenticated staff. Write: platform admin.
--   2. `roles`            — org_id null = system template shared by all tenants;
--                           org_id set  = a tenant's own custom role.
--   3. `role_permissions` — role × action allow/deny matrix.
--
-- Also widens two 0001 policies that were too tight for a Users screen (an
-- academy owner could previously only see THEMSELVES in `staff`, and only a
-- platform admin could assign org membership).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- org_members: add a surrogate id so the console's generic CRUD repo (which
-- addresses rows by `id`) can update/delete memberships. The composite PK
-- (org_id, staff_id) stays as the real uniqueness guarantee.
-- ---------------------------------------------------------------------------
alter table public.org_members
  add column if not exists id uuid not null default gen_random_uuid();

create unique index if not exists org_members_id_key on public.org_members (id);

-- ---------------------------------------------------------------------------
-- 1. Action catalogue (self-referencing 4-level tree)
-- ---------------------------------------------------------------------------
create table if not exists public.actions (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.actions(id) on delete cascade,
  -- subsystem | module | submodule | action
  level       text not null,
  -- Only the leaf 'action' level carries a code like 'ac-101'.
  code        text unique,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint actions_level_check
    check (level in ('subsystem', 'module', 'submodule', 'action'))
);

create index if not exists actions_parent_id_idx on public.actions (parent_id);

-- ---------------------------------------------------------------------------
-- 2. Roles
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  -- null = system template available to every tenant
  org_id      uuid references public.organisations(id) on delete cascade,
  key         text not null,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Nulls compare as distinct in Postgres, so system roles need their own
-- partial unique index; tenant roles are unique within their org.
create unique index if not exists roles_system_key_idx
  on public.roles (key) where org_id is null;
create unique index if not exists roles_org_key_idx
  on public.roles (org_id, key) where org_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Role × action matrix
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id    uuid not null references public.roles(id) on delete cascade,
  action_id  uuid not null references public.actions(id) on delete cascade,
  allowed    boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (role_id, action_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['actions','roles'] loop
    if not exists (
      select 1 from pg_trigger where tgname = t || '_set_updated_at'
    ) then
      execute format(
        'create trigger %I_set_updated_at before update on public.%I
           for each row execute function public.set_updated_at()', t, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

-- Do I share an organisation with this staff member?
create or replace function public.shares_org_with(target_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members me
    join public.org_members them on them.org_id = me.org_id
    where me.staff_id = auth.uid() and them.staff_id = target_staff
  );
$$;

-- May I see/manage this role? (system roles are visible to everyone)
create or replace function public.can_access_role(target_role uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.roles r
    where r.id = target_role
      and (r.org_id is null or public.is_org_member(r.org_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Widen two 0001 policies that blocked a working Users screen
-- ---------------------------------------------------------------------------

-- Was: you could only ever see YOURSELF unless platform admin. Now colleagues
-- in the same org are visible too, which is what a staff directory needs.
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_platform_admin()
    or public.shares_org_with(id)
  );

-- Was: only platform admins could grant org membership, so an academy owner
-- could never assign a role to their own staff.
drop policy if exists org_members_write on public.org_members;
create policy org_members_write on public.org_members
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.actions          enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;

-- actions: the product's own capability map — everyone reads, platform admin writes.
drop policy if exists actions_select on public.actions;
create policy actions_select on public.actions
  for select to authenticated using (true);

drop policy if exists actions_write on public.actions;
create policy actions_write on public.actions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- roles: system templates readable by all; tenant roles gated on membership.
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (org_id is null or public.is_org_member(org_id));

-- A tenant may manage its OWN roles; only platform admins touch system roles.
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (
    case when org_id is null then public.is_platform_admin()
         else public.is_org_member(org_id) end
  )
  with check (
    case when org_id is null then public.is_platform_admin()
         else public.is_org_member(org_id) end
  );

-- role_permissions: follows the role's visibility; system-role edits are
-- platform-admin only.
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (public.can_access_role(role_id));

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and case when r.org_id is null then public.is_platform_admin()
                 else public.is_org_member(r.org_id) end
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and case when r.org_id is null then public.is_platform_admin()
                 else public.is_org_member(r.org_id) end
    )
  );

-- >>> migrations/0012_booking_external_ref.sql
-- ============================================================================
-- PlayMetric — 0012_booking_external_ref
-- Lets a booking remember the partner reference it came from (Hudle / Playo /
-- District), so an import or webhook can run repeatedly without creating
-- duplicates: the same partner reference always maps to the same row.
--
-- `source` (from 0004) already records WHICH partner; this records WHICH
-- booking on their side. Manual bookings leave it null.
--
-- Safe to re-run.
-- ============================================================================

alter table public.bookings
  add column if not exists external_ref text;

-- Unique per tenant, and only for rows that actually carry a reference, so
-- manual bookings (null) are unaffected.
create unique index if not exists bookings_org_external_ref_idx
  on public.bookings (org_id, external_ref)
  where external_ref is not null;

-- ---------------------------------------------------------------------------
-- RBAC catalogue: actions (4-level tree), system roles, and the role x action
-- permission matrix. Generated from console/src/lib/data/seedData.js.
--
-- NOTE: `staff` / `org_members` are NOT seeded here — staff.id is a FK to
-- auth.users, so those rows appear when people actually sign up.
-- ---------------------------------------------------------------------------
insert into public.actions (id, parent_id, level, code, name, sort_order) values
  ('eeeeeeee-eeee-4eee-8eee-000000000001', null, 'subsystem', null, 'CRM', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Dashboard', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000002', 'submodule', null, 'Overview', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000003', 'action', 'ac-101', 'View dashboard', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Booking Management', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000006', 'eeeeeeee-eeee-4eee-8eee-000000000005', 'submodule', null, 'Calendar', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000007', 'eeeeeeee-eeee-4eee-8eee-000000000006', 'action', 'ac-201', 'View calendar', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000008', 'eeeeeeee-eeee-4eee-8eee-000000000006', 'action', 'ac-202', 'Create booking', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000009', 'eeeeeeee-eeee-4eee-8eee-000000000006', 'action', 'ac-203', 'Edit booking', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000010', 'eeeeeeee-eeee-4eee-8eee-000000000006', 'action', 'ac-204', 'Cancel booking', 3),
  ('eeeeeeee-eeee-4eee-8eee-000000000011', 'eeeeeeee-eeee-4eee-8eee-000000000005', 'submodule', null, 'Transactions', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000012', 'eeeeeeee-eeee-4eee-8eee-000000000011', 'action', 'ac-205', 'View transactions', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000013', 'eeeeeeee-eeee-4eee-8eee-000000000011', 'action', 'ac-206', 'Export transactions', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000014', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Financial Management', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000015', 'eeeeeeee-eeee-4eee-8eee-000000000014', 'submodule', null, 'Overview', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000016', 'eeeeeeee-eeee-4eee-8eee-000000000015', 'action', 'ac-301', 'View financial overview', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000017', 'eeeeeeee-eeee-4eee-8eee-000000000014', 'submodule', null, 'Ledger', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000018', 'eeeeeeee-eeee-4eee-8eee-000000000017', 'action', 'ac-302', 'View ledger', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000019', 'eeeeeeee-eeee-4eee-8eee-000000000017', 'action', 'ac-303', 'Add entry', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000020', 'eeeeeeee-eeee-4eee-8eee-000000000017', 'action', 'ac-304', 'Edit entry', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000021', 'eeeeeeee-eeee-4eee-8eee-000000000017', 'action', 'ac-305', 'Export CSV', 3),
  ('eeeeeeee-eeee-4eee-8eee-000000000022', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Configuration', 3),
  ('eeeeeeee-eeee-4eee-8eee-000000000023', 'eeeeeeee-eeee-4eee-8eee-000000000022', 'submodule', null, 'Academy', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000024', 'eeeeeeee-eeee-4eee-8eee-000000000023', 'action', 'ac-401', 'View academy', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000025', 'eeeeeeee-eeee-4eee-8eee-000000000023', 'action', 'ac-402', 'Edit academy', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000026', 'eeeeeeee-eeee-4eee-8eee-000000000022', 'submodule', null, 'Facility', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000027', 'eeeeeeee-eeee-4eee-8eee-000000000026', 'action', 'ac-403', 'Manage venues', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000028', 'eeeeeeee-eeee-4eee-8eee-000000000026', 'action', 'ac-404', 'Manage courts', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000029', 'eeeeeeee-eeee-4eee-8eee-000000000026', 'action', 'ac-405', 'Manage sports', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000030', 'eeeeeeee-eeee-4eee-8eee-000000000026', 'action', 'ac-406', 'Manage time slots', 3),
  ('eeeeeeee-eeee-4eee-8eee-000000000031', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Operations', 4),
  ('eeeeeeee-eeee-4eee-8eee-000000000032', 'eeeeeeee-eeee-4eee-8eee-000000000031', 'submodule', null, 'Clients', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000033', 'eeeeeeee-eeee-4eee-8eee-000000000032', 'action', 'ac-501', 'View clients', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000034', 'eeeeeeee-eeee-4eee-8eee-000000000032', 'action', 'ac-502', 'Manage clients', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000035', 'eeeeeeee-eeee-4eee-8eee-000000000031', 'submodule', null, 'Contracts', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000036', 'eeeeeeee-eeee-4eee-8eee-000000000035', 'action', 'ac-503', 'View contracts', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000037', 'eeeeeeee-eeee-4eee-8eee-000000000035', 'action', 'ac-504', 'Manage contracts', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000038', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Insights & Support', 5),
  ('eeeeeeee-eeee-4eee-8eee-000000000039', 'eeeeeeee-eeee-4eee-8eee-000000000038', 'submodule', null, 'Analytics', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000040', 'eeeeeeee-eeee-4eee-8eee-000000000039', 'action', 'ac-601', 'View analytics', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000041', 'eeeeeeee-eeee-4eee-8eee-000000000038', 'submodule', null, 'Reviews', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000042', 'eeeeeeee-eeee-4eee-8eee-000000000041', 'action', 'ac-602', 'View reviews', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000043', 'eeeeeeee-eeee-4eee-8eee-000000000041', 'action', 'ac-603', 'Manage reviews', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000044', 'eeeeeeee-eeee-4eee-8eee-000000000038', 'submodule', null, 'Tickets', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000045', 'eeeeeeee-eeee-4eee-8eee-000000000044', 'action', 'ac-604', 'View tickets', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000046', 'eeeeeeee-eeee-4eee-8eee-000000000044', 'action', 'ac-605', 'Manage tickets', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000047', 'eeeeeeee-eeee-4eee-8eee-000000000001', 'module', null, 'Permissions', 6),
  ('eeeeeeee-eeee-4eee-8eee-000000000048', 'eeeeeeee-eeee-4eee-8eee-000000000047', 'submodule', null, 'Users', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000049', 'eeeeeeee-eeee-4eee-8eee-000000000048', 'action', 'ac-701', 'View users', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000050', 'eeeeeeee-eeee-4eee-8eee-000000000048', 'action', 'ac-702', 'Manage users', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000051', 'eeeeeeee-eeee-4eee-8eee-000000000047', 'submodule', null, 'Roles', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000052', 'eeeeeeee-eeee-4eee-8eee-000000000051', 'action', 'ac-703', 'View roles', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000053', 'eeeeeeee-eeee-4eee-8eee-000000000051', 'action', 'ac-704', 'Manage roles', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000054', 'eeeeeeee-eeee-4eee-8eee-000000000047', 'submodule', null, 'Actions', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000055', 'eeeeeeee-eeee-4eee-8eee-000000000054', 'action', 'ac-705', 'View actions', 0),
  ('eeeeeeee-eeee-4eee-8eee-000000000056', 'eeeeeeee-eeee-4eee-8eee-000000000054', 'action', 'ac-706', 'Manage actions', 1)
on conflict (id) do nothing;

insert into public.roles (id, org_id, key, name, description, is_system) values
  ('dddddddd-dddd-4ddd-8ddd-000000000001', null, 'owner', 'Owner', 'Full access, including permissions', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', null, 'manager', 'Manager', 'Day-to-day operations; cannot change permissions', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', null, 'front_desk', 'Front Desk', 'Bookings, clients, and support tickets', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', null, 'accountant', 'Accountant', 'Financial records and contracts', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', null, 'coach', 'Coach', 'Read-only schedule and feedback', true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, action_id, allowed) values
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000004', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000007', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000008', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000009', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000010', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000012', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000013', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000016', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000018', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000019', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000020', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000021', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000024', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000025', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000027', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000028', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000029', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000030', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000033', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000034', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000036', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000037', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000040', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000042', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000043', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000045', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000046', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000049', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000050', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000052', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000053', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000055', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000001', 'eeeeeeee-eeee-4eee-8eee-000000000056', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000004', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000007', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000008', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000009', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000010', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000012', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000013', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000016', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000018', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000019', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000020', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000021', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000024', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000025', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000027', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000028', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000029', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000030', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000033', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000034', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000036', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000037', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000040', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000042', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000043', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000045', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000046', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000049', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000050', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000052', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000053', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000055', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000002', 'eeeeeeee-eeee-4eee-8eee-000000000056', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000004', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000007', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000008', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000009', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000010', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000012', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000013', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000016', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000018', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000019', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000020', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000021', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000024', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000025', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000027', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000028', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000029', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000030', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000033', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000034', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000036', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000037', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000040', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000042', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000043', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000045', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000046', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000049', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000050', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000052', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000053', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000055', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000003', 'eeeeeeee-eeee-4eee-8eee-000000000056', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000004', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000007', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000008', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000009', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000010', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000012', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000013', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000016', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000018', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000019', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000020', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000021', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000024', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000025', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000027', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000028', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000029', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000030', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000033', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000034', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000036', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000037', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000040', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000042', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000043', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000045', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000046', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000049', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000050', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000052', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000053', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000055', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000004', 'eeeeeeee-eeee-4eee-8eee-000000000056', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000004', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000007', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000008', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000009', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000010', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000012', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000013', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000016', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000018', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000019', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000020', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000021', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000024', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000025', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000027', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000028', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000029', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000030', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000033', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000034', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000036', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000037', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000040', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000042', true),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000043', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000045', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000046', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000049', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000050', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000052', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000053', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000055', false),
  ('dddddddd-dddd-4ddd-8ddd-000000000005', 'eeeeeeee-eeee-4eee-8eee-000000000056', false)
on conflict (role_id, action_id) do nothing;
