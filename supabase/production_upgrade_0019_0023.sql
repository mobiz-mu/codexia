-- ============================================================================
-- Codexia — Incremental production upgrade: migrations 0019–0023 ONLY.
--
-- Safe to run against the existing database (already at 0001–0018). Every
-- statement is defensive: additive-only, IF NOT EXISTS / IF EXISTS guarded,
-- or wrapped in a DO block that checks catalog state before acting where
-- Postgres has no native IF NOT EXISTS for that object type (constraints
-- added via DROP+ADD, policies). Nothing here drops a table, drops a
-- column, deletes a row, truncates data, or overwrites an existing value.
--
-- Wrapped in a single transaction — if anything fails, Postgres rolls the
-- whole thing back and the database is left exactly as it was before this
-- script ran (the same property that made the earlier apply_all.sql
-- failure safe).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0019_paypal_verification.sql
-- ----------------------------------------------------------------------------

-- payment_transactions.capture_id — PayPal's capture id is a different
-- identifier from the order id already stored in idempotency_key/provider_ref.
alter table payment_transactions
  add column if not exists capture_id text;

-- Unique constraint on capture_id, added separately from the column so this
-- is correct even if capture_id already exists without it (e.g. a prior
-- partial run of this exact script).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_transactions_capture_id_key'
      and conrelid = 'public.payment_transactions'::regclass
  ) then
    alter table payment_transactions
      add constraint payment_transactions_capture_id_key unique (capture_id);
  end if;
end $$;

-- payment_transactions.exchange_rate — the MUR-per-EUR rate actually applied
-- to this payment at capture time, for auditing after site_settings changes.
alter table payment_transactions
  add column if not exists exchange_rate numeric;

-- Widen the status CHECK constraint to cover the full PayPal capture
-- lifecycle. Existing rows only ever used ('pending','succeeded','failed',
-- 'cancelled') — a strict subset of the new list — so this cannot reject
-- any value already stored. Drop-then-add is idempotent by construction:
-- re-running this finds the new constraint already in place, drops it, and
-- re-adds the identical definition.
alter table payment_transactions
  drop constraint if exists payment_transactions_status_check;
alter table payment_transactions
  add constraint payment_transactions_status_check
    check (status in ('created', 'pending', 'succeeded', 'failed', 'denied', 'cancelled', 'refunded', 'reversed', 'disputed'));

-- Only changes the default for FUTURE inserts — does not touch existing rows.
alter table payment_transactions
  alter column provider set default 'paypal';

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_provider_idx on webhook_events (provider);

alter table webhook_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'webhook_events' and policyname = 'webhook_events_staff_select'
  ) then
    create policy webhook_events_staff_select on webhook_events
      for select using (has_permission(auth.uid(), 'manage_payments'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 0020_review_requests.sql
-- ----------------------------------------------------------------------------

create table if not exists review_request_logs (
  booking_id uuid primary key references bookings (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table review_request_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_request_logs' and policyname = 'review_request_logs_staff_select'
  ) then
    create policy review_request_logs_staff_select on review_request_logs
      for select using (has_permission(auth.uid(), 'view_analytics'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 0021_fleet_operational_fields.sql
-- ----------------------------------------------------------------------------
-- Column names match lib/actions/admin/vehicles.ts and components/admin/
-- VehicleForm.tsx exactly (current_mileage_km, weekly_price_cents, etc.).
-- All nullable — no backfill needed, no NOT NULL is introduced by this
-- migration, so there is nothing to backfill before applying constraints.

alter table vehicles
  add column if not exists vin text,
  add column if not exists engine_number text,
  add column if not exists insurance_expiry date,
  add column if not exists road_tax_expiry date,
  add column if not exists fitness_expiry date,
  add column if not exists last_service_date date,
  add column if not exists next_service_date date,
  add column if not exists current_mileage_km integer,
  add column if not exists weekly_price_cents integer,
  add column if not exists monthly_price_cents integer;

-- CHECK constraints added separately (same reasoning as capture_id above) so
-- this is correct even if the columns already exist without them.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_current_mileage_km_check' and conrelid = 'public.vehicles'::regclass
  ) then
    alter table vehicles add constraint vehicles_current_mileage_km_check check (current_mileage_km >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_weekly_price_cents_check' and conrelid = 'public.vehicles'::regclass
  ) then
    alter table vehicles add constraint vehicles_weekly_price_cents_check check (weekly_price_cents >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_monthly_price_cents_check' and conrelid = 'public.vehicles'::regclass
  ) then
    alter table vehicles add constraint vehicles_monthly_price_cents_check check (monthly_price_cents >= 0);
  end if;
end $$;

-- Widen vehicle_blocks.type to add 'preparing'/'cleaning' alongside the
-- existing 'maintenance'/'internal'. Existing rows only ever used the
-- original two values — a strict subset of the new list — so this cannot
-- reject any value already stored.
alter table vehicle_blocks
  drop constraint if exists vehicle_blocks_type_check;
alter table vehicle_blocks
  add constraint vehicle_blocks_type_check
    check (type in ('maintenance', 'internal', 'preparing', 'cleaning'));

-- ----------------------------------------------------------------------------
-- 0022_vehicle_image_variants.sql
-- ----------------------------------------------------------------------------
-- Column names match lib/images/process-vehicle-image.ts and
-- lib/actions/admin/vehicles.ts exactly. `variants` is one jsonb column
-- holding all size×format paths (thumb/card/hero/gallery × webp/avif) —
-- see the comment in the source migration for why it's jsonb rather than
-- one column per size/format combination. The original upload is untouched,
-- still referenced by the pre-existing `path` column.

alter table vehicle_images
  add column if not exists content_hash text,
  add column if not exists variants jsonb,
  add column if not exists blur_data_url text;

create index if not exists vehicle_images_content_hash_idx on vehicle_images (vehicle_id, content_hash);

-- ----------------------------------------------------------------------------
-- 0023_google_maps_setting.sql
-- ----------------------------------------------------------------------------
-- Already idempotent in its original form (on conflict do nothing) — if a
-- real value has already been entered via /admin/settings, this leaves it
-- untouched. Only inserts the row if the key is completely absent.

insert into site_settings (key, value, value_type, description)
values ('google_maps_url', '""', 'string', 'Google Maps link to the Codexia office/counter, shown in email footers. Leave empty to hide the Maps button.')
on conflict (key) do nothing;

commit;
