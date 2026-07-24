-- ============================================================================
-- PlayMetric — 0003_onboarding
-- Self-serve academy signup. When an academy signs up on the marketing site,
-- Supabase creates an auth user — but the console shows data via RLS keyed on
-- a staff row + an organisation. A brand-new signup has neither, so it would
-- land in the console and see nothing.
--
-- This trigger closes that gap: on signup it auto-creates the academy's
-- organisation, a staff row for the signing-up user, and an org_members link
-- making them the OWNER of that org. Runs SECURITY DEFINER so it can write to
-- tables the public anon role can't.
--
-- Guard: only fires when the signup carried an `academy_name` in its metadata
-- (i.e. a real academy self-signup). Users created without it — e.g. platform
-- admins added by hand in the dashboard — are skipped and provisioned manually.
-- ============================================================================

create or replace function public.handle_new_academy_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academy   text;
  v_full_name text;
  v_slug      text;
  v_org_id    uuid;
begin
  v_academy := nullif(trim(new.raw_user_meta_data ->> 'academy_name'), '');

  -- Not an academy self-signup — leave it for manual provisioning.
  if v_academy is null then
    return new;
  end if;

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Slug from the academy name; append a short id fragment if it collides.
  v_slug := lower(regexp_replace(v_academy, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'academy';
  end if;
  if exists (select 1 from public.organisations where subdomain = v_slug) then
    v_slug := v_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into public.organisations (name, subdomain, domain, office_location, accent)
  values (v_academy, v_slug, v_slug || '.playmetric.in', '', 'cyan')
  returning id into v_org_id;

  insert into public.staff (id, full_name, email, is_platform_admin)
  values (new.id, v_full_name, new.email, false);

  insert into public.org_members (org_id, staff_id, role_key)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_academy_signup();
