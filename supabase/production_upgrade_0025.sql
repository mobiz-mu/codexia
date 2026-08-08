-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0025 ONLY.
--
-- Safe to run against the existing database (already at 0001–0024, i.e.
-- production_upgrade_0024.sql has already been applied — deposit_threshold_
-- eur_cents and deposit_amount_eur_cents already exist). Purely additive:
-- inserts 3 new site_settings rows (on-conflict-do-nothing — a value an
-- admin has already customized is left untouched) and relabels one existing
-- row's description. Nothing is deleted, no value is overwritten, no table
-- or column is added/removed. Wrapped in a transaction — if anything fails,
-- the database is left exactly as it was before this script ran.
-- ============================================================================

begin;

insert into site_settings (key, value, value_type, description)
values (
  'deposit_mid_tier_max_eur_cents',
  '40000',
  'number',
  'Upper bound (in EUR cents) of the mid-tier deposit band — bookings from deposit_threshold_eur_cents up to and including this amount pay deposit_mid_tier_amount_eur_cents.'
)
on conflict (key) do nothing;

insert into site_settings (key, value, value_type, description)
values (
  'deposit_mid_tier_amount_eur_cents',
  '10000',
  'number',
  'Fixed EUR deposit (in cents) for bookings in the mid tier (from deposit_threshold_eur_cents up to deposit_mid_tier_max_eur_cents).'
)
on conflict (key) do nothing;

insert into site_settings (key, value, value_type, description)
values (
  'deposit_high_tier_amount_eur_cents',
  '20000',
  'number',
  'Fixed EUR deposit (in cents) for bookings above deposit_mid_tier_max_eur_cents.'
)
on conflict (key) do nothing;

update site_settings
set description = 'LEGACY: superseded by deposit_mid_tier_amount_eur_cents — the flat single-tier deposit amount is no longer read by the live booking or PayPal flow.'
where key = 'deposit_amount_eur_cents';

commit;
