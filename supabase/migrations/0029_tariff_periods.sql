-- Duration-tier seasonal tariffs — Phase A (fleet-ops upgrade).
--
-- Replaces reliance on the single flat vehicles.daily_price_cents with an
-- admin-managed grid of PER-DAY rates banded by rental duration, scoped to a
-- date range and to either one vehicle or one whole category.
--
-- THE CANONICAL PRICING RULE (implemented in lib/pricing/tariff.ts):
--
--   1. Take the period covering the booking's PICKUP date. A rental that
--      crosses a season boundary is priced entirely at the pickup period's
--      rates — deterministic, and explainable to a customer at quote time.
--   2. Within that period pick the highest duration tier <= rental days:
--        1-2 days -> rate_1_day, 3 -> rate_3_day, 4-6 -> rate_4_day,
--        7-13 -> rate_7_day, 14-20 -> rate_14_day, 21+ -> rate_21_plus_day.
--   3. total = chosen per-day rate x days.
--
-- A tier stored as 0 does NOT mean "free". It means that rental length is
-- NOT OFFERED for this period — the vehicle is withheld from public search
-- for durations landing in that band. This is how a peak-season minimum
-- (e.g. "4 nights minimum in July/August") is expressed, mirroring the
-- operator's existing practice. Note this is distinct from, and stacks with,
-- the pre-existing vehicles.min_rental_days floor.
--
-- SCOPE + PRIORITY: exactly one of vehicle_id / category_id is set. A
-- vehicle-scoped period always beats a category-scoped one for the same
-- date, so those two are deliberately allowed to overlap — that overlap IS
-- the override mechanism. What is forbidden (by exclusion constraint) is two
-- active periods at the SAME scope level covering the same date, which would
-- make resolution ambiguous.
--
-- Rates are EUR integer cents. Customer-facing rental pricing stays strictly
-- EUR; internal fleet operating costs are MUR and live in other tables.

create table vehicle_tariff_periods (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles (id) on delete cascade,
  category_id uuid references vehicle_categories (id) on delete cascade,
  label text,
  effective_from date not null,
  effective_to date not null,
  rate_1_day_cents integer not null default 0 check (rate_1_day_cents >= 0),
  rate_3_day_cents integer not null default 0 check (rate_3_day_cents >= 0),
  rate_4_day_cents integer not null default 0 check (rate_4_day_cents >= 0),
  rate_7_day_cents integer not null default 0 check (rate_7_day_cents >= 0),
  rate_14_day_cents integer not null default 0 check (rate_14_day_cents >= 0),
  rate_21_plus_day_cents integer not null default 0 check (rate_21_plus_day_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicle_tariff_periods_scope_exactly_one
    check (num_nonnulls(vehicle_id, category_id) = 1),
  constraint vehicle_tariff_periods_date_order
    check (effective_to >= effective_from),

  -- Ambiguity is rejected at the database, not merely in the form: two
  -- active vehicle-scoped periods may not cover the same day for one
  -- vehicle. '[]' makes the end date inclusive, so 01-31 Aug and 01-30 Sep
  -- are adjacent rather than overlapping.
  constraint vehicle_tariff_periods_no_vehicle_overlap
    exclude using gist (
      vehicle_id with =,
      daterange(effective_from, effective_to, '[]') with &&
    ) where (active and vehicle_id is not null),

  constraint vehicle_tariff_periods_no_category_overlap
    exclude using gist (
      category_id with =,
      daterange(effective_from, effective_to, '[]') with &&
    ) where (active and category_id is not null)
);

-- Resolution always filters by scope + date + active, so those are the
-- columns worth indexing; the exclusion constraints already provide GiST
-- indexes on (scope, daterange) which serve the covering-date lookup.
create index vehicle_tariff_periods_vehicle_id_idx on vehicle_tariff_periods (vehicle_id) where vehicle_id is not null;
create index vehicle_tariff_periods_category_id_idx on vehicle_tariff_periods (category_id) where category_id is not null;
create index vehicle_tariff_periods_effective_from_idx on vehicle_tariff_periods (effective_from);

create trigger vehicle_tariff_periods_set_updated_at
  before update on vehicle_tariff_periods
  for each row execute function set_updated_at();

-- Optional pickup-location applicability ("lier la grille à un ou plusieurs
-- points de retrait"). NO rows for a period means it applies at EVERY
-- location — the common case — so the default costs nothing to express.
create table vehicle_tariff_period_locations (
  tariff_period_id uuid not null references vehicle_tariff_periods (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  primary key (tariff_period_id, location_id)
);

create index vehicle_tariff_period_locations_location_id_idx
  on vehicle_tariff_period_locations (location_id);

-- Permissions — inserted here rather than seed.sql for the same reason as
-- 0026: seed's super_admin cross-join already ran against production, so a
-- permission added afterwards needs its own explicit role_permissions grant.
-- Pricing is commercially sensitive, so manage_tariffs goes to super_admin
-- and administrator only; fleet_manager gets read access alongside the other
-- fleet views it already holds.
insert into permissions (key, description) values
  ('view_tariffs', 'View seasonal duration-tier tariff periods'),
  ('manage_tariffs', 'Create, edit, and delete tariff periods and rates');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator')
  and p.key in ('view_tariffs', 'manage_tariffs');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key = 'fleet_manager'
  and p.key = 'view_tariffs';

alter table vehicle_tariff_periods enable row level security;
alter table vehicle_tariff_period_locations enable row level security;

create policy vehicle_tariff_periods_staff_select on vehicle_tariff_periods
  for select using (has_permission(auth.uid(), 'view_tariffs'));
create policy vehicle_tariff_periods_staff_insert on vehicle_tariff_periods
  for insert with check (has_permission(auth.uid(), 'manage_tariffs'));
create policy vehicle_tariff_periods_staff_update on vehicle_tariff_periods
  for update using (has_permission(auth.uid(), 'manage_tariffs'))
  with check (has_permission(auth.uid(), 'manage_tariffs'));
create policy vehicle_tariff_periods_staff_delete on vehicle_tariff_periods
  for delete using (has_permission(auth.uid(), 'manage_tariffs'));

create policy vehicle_tariff_period_locations_staff_select on vehicle_tariff_period_locations
  for select using (has_permission(auth.uid(), 'view_tariffs'));
create policy vehicle_tariff_period_locations_staff_insert on vehicle_tariff_period_locations
  for insert with check (has_permission(auth.uid(), 'manage_tariffs'));
create policy vehicle_tariff_period_locations_staff_delete on vehicle_tariff_period_locations
  for delete using (has_permission(auth.uid(), 'manage_tariffs'));
