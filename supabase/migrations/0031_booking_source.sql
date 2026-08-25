-- Booking channel and internal notes — Phase C (manual/admin booking).
--
-- The planning board distinguishes a reservation taken on the website from
-- one entered by staff at the counter, exactly as the reference does. That
-- distinction has to be recorded on the booking rather than inferred: today
-- every booking arrives through the public wizard, so "no payment yet" or
-- "no access token" would be a guess, not a channel.
--
-- Existing rows default to 'website', which is accurate — the manual path
-- did not exist before this migration, so every booking already in the
-- table came through the public site.

alter table bookings
  add column if not exists source text not null default 'website'
    check (source in ('website', 'admin'));

comment on column bookings.source is
  'Channel the booking arrived through: website (public wizard) or admin (entered by staff). Drives the planning board colour and the departures list, and is never inferred from payment state.';

-- The board filters by channel over a bounded date window, so the useful
-- index pairs the channel with the window column rather than standing alone.
create index if not exists bookings_source_pickup_at_idx
  on bookings (source, pickup_at);

-- Distinct from special_requests, which is what the CUSTOMER wrote and may be
-- shown back to them. This is staff-only: counter notes, an agency reference,
-- a purchase order number.
alter table bookings
  add column if not exists internal_notes text;

comment on column bookings.internal_notes is
  'Staff-only notes and internal/agency reference. Never rendered on a customer-facing page or in an email — see special_requests for customer-supplied text.';
