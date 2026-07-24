-- ============================================================================
-- PlayMetric — 0002_leads
-- Public "Book a Demo" lead capture, moved off MongoDB onto Supabase.
--
-- Access model: the marketing site is unauthenticated, so the anonymous role
-- must be able to INSERT a lead — but nothing else. Reading, updating and
-- deleting leads is staff-only. This is the standard, safe pattern for a
-- public contact form on Supabase.
-- ============================================================================

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  academy_name  text default '',
  phone         text default '',
  message       text default '',
  source        text default 'hero-book-demo',
  status        text not null default 'new'
                  check (status in ('new','contacted','qualified','closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Anonymous visitors (and signed-in users) may submit a lead, nothing more.
create policy leads_insert_public on public.leads
  for insert to anon, authenticated
  with check (true);

-- Only staff can read and manage captured leads.
create policy leads_select_staff on public.leads
  for select to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid()));

create policy leads_update_staff on public.leads
  for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid()))
  with check (exists (select 1 from public.staff s where s.id = auth.uid()));
