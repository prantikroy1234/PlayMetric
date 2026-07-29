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
