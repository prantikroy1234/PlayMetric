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
