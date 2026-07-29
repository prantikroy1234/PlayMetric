-- ============================================================================
-- PlayMetric — 0010_finance_booking_link
-- Links a finance_entries row back to the booking that generated it, so the
-- console can keep booking revenue and its refund in sync automatically:
--   * booking confirmed/completed  → an 'inflow' entry (category Bookings)
--   * booking cancelled            → a 'Refund' 'outflow' entry reverses it
-- Manual finance entries leave booking_id null. `on delete cascade` cleans up
-- the generated rows if the booking itself is deleted.
--
-- Safe to re-run (guards with IF NOT EXISTS).
-- ============================================================================

alter table public.finance_entries
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create index if not exists finance_entries_booking_id_idx
  on public.finance_entries (booking_id);
