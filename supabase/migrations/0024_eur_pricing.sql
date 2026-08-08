-- Migrate the platform from MUR-primary/EUR-converted-at-PayPal-time to a
-- fully EUR-native pricing architecture, on both locales.
--
-- Strategy: `vehicles`, `extras`, `payments`, and `payment_transactions`
-- already store a price/amount alongside an explicit `currency` text column
-- (added well before this migration). That per-row discriminator already
-- does the job a twin `_eur_cents` column scheme would exist to provide, so
-- those four tables get NO new columns here — only their `currency` default
-- flips back to EUR, so new records entered from today onward are EUR
-- without any admin currency picker. Existing MUR rows are untouched: their
-- `currency` stays 'MUR' and their cent values are never reinterpreted.
--
-- `bookings`, `invoices`, and `locations` have no currency concept at all
-- today, so those get a real new `currency` column each, explicitly
-- backfilled to the currency the historical data actually was (never
-- defaulted/guessed as EUR), with the default flipped to EUR for new rows
-- only after backfill completes.

alter table vehicles alter column currency set default 'EUR';
alter table extras alter column currency set default 'EUR';
alter table payments alter column currency set default 'EUR';
alter table payment_transactions alter column currency set default 'EUR';

-- bookings.currency: backfill from the booked vehicle's currency (the
-- actual currency its price was entered in at booking time); fall back to
-- 'MUR' only for rows with no resolvable vehicle, since that has been the
-- site-wide default since migration 0017. Never defaulted to EUR pre-backfill.
alter table bookings add column if not exists currency text;

update bookings b
set currency = v.currency
from vehicles v
where b.vehicle_id = v.id
  and b.currency is null;

update bookings set currency = 'MUR' where currency is null;

alter table bookings alter column currency set not null;
alter table bookings alter column currency set default 'EUR';

-- invoices.currency: backfill from the linked booking where one exists;
-- standalone invoices with no booking_id have no other signal, so they
-- backfill to 'MUR' (the currency every invoice has been issued in to date).
alter table invoices add column if not exists currency text;

update invoices i
set currency = b.currency
from bookings b
where i.booking_id = b.id
  and i.currency is null;

update invoices set currency = 'MUR' where currency is null;

alter table invoices alter column currency set not null;
alter table invoices alter column currency set default 'EUR';

-- locations.delivery_fee_currency: every existing delivery_fee_cents value
-- was entered under the site's MUR-default era, so it backfills to 'MUR'
-- explicitly rather than being silently treated as EUR. A location's fee
-- only becomes usable for EUR bookings once an admin re-enters it under the
-- new EUR-default form — same "not bookable until it has a real EUR price"
-- rule applied to vehicles.
alter table locations add column if not exists delivery_fee_currency text;

update locations set delivery_fee_currency = 'MUR' where delivery_fee_currency is null;

alter table locations alter column delivery_fee_currency set not null;
alter table locations alter column delivery_fee_currency set default 'EUR';

-- Site-wide default currency: flip forward from MUR (set in 0017) to EUR.
update site_settings set value = '"EUR"' where key = 'currency' and value = '"MUR"';

-- Admin-configurable deposit rule, replacing the hardcoded constants in
-- lib/pricing/deposit.ts. Seeded to the same €100 / €100 behavior that was
-- previously hardcoded, so this migration does not change deposit amounts
-- until an admin deliberately edits them in Settings.
insert into site_settings (key, value, value_type, description)
values (
  'deposit_threshold_eur_cents',
  '10000',
  'number',
  'Booking totals at or below this EUR amount (in cents) are paid in full via PayPal instead of a partial deposit.'
)
on conflict (key) do nothing;

insert into site_settings (key, value, value_type, description)
values (
  'deposit_amount_eur_cents',
  '10000',
  'number',
  'Fixed EUR deposit (in cents) charged via PayPal when the booking total exceeds the deposit threshold.'
)
on conflict (key) do nothing;

-- eur_exchange_rate is no longer read by the EUR-native booking/PayPal flow
-- (new bookings compute and store EUR amounts directly). Kept in the schema,
-- relabeled as legacy, solely to keep historical MUR-booking figures
-- auditable/displayable.
update site_settings
set description = 'LEGACY: MUR per 1 EUR. Used only to display/reconcile historical MUR bookings created before the EUR-native migration — no longer read by the live booking or PayPal flow.'
where key = 'eur_exchange_rate';
