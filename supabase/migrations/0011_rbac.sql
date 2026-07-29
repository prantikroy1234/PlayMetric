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
