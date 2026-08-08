-- Replace the flat "≤€100 full payment, else fixed €100 deposit" rule from
-- migration 0024 with a three-tier rule:
--   total < deposit_threshold_eur_cents              -> pay the full total
--   threshold <= total <= deposit_mid_tier_max        -> pay the mid-tier amount
--   total > deposit_mid_tier_max                      -> pay the high-tier amount
--
-- `deposit_threshold_eur_cents` already exists (added in 0024) and keeps
-- its exact meaning — only three new settings are added alongside it.
-- `deposit_amount_eur_cents` (the old flat deposit amount) is superseded by
-- `deposit_mid_tier_amount_eur_cents` — its value is not touched, only its
-- description is updated to mark it legacy, so historical bookings whose
-- pricing snapshot referenced it stay fully readable.

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
