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
