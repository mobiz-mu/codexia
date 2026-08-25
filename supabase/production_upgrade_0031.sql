-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0031.
--
-- Safe to run against the existing database (already at 0001–0030). Purely
-- additive: two new columns on bookings (IF NOT EXISTS) and one index
-- (IF NOT EXISTS). Nothing is dropped, deleted, or overwritten.
--
-- Existing rows take source = 'website', which is accurate rather than a
-- guess: the manual/admin booking path did not exist before this migration,
-- so every booking already in the table came through the public wizard.
-- ============================================================================

begin;

alter table bookings
  add column if not exists source text not null default 'website'
    check (source in ('website', 'admin'));

comment on column bookings.source is
  'Channel the booking arrived through: website (public wizard) or admin (entered by staff). Drives the planning board colour and the departures list, and is never inferred from payment state.';

create index if not exists bookings_source_pickup_at_idx
  on bookings (source, pickup_at);

alter table bookings
  add column if not exists internal_notes text;

comment on column bookings.internal_notes is
  'Staff-only notes and internal/agency reference. Never rendered on a customer-facing page or in an email — see special_requests for customer-supplied text.';

commit;
