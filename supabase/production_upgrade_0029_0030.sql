-- ============================================================================
-- Codexia — Incremental production upgrade: migrations 0029 + 0030.
--
-- Safe to run against the existing database (already at 0001–0028). Purely
-- additive: two new tables (IF NOT EXISTS), new indexes (IF NOT EXISTS), a
-- new trigger and RLS policies (guarded by catalog checks so a partial prior
-- run doesn't error), two new permission rows (ON CONFLICT DO NOTHING),
-- three new columns on existing tables (IF NOT EXISTS), one new column on
-- vehicles (IF NOT EXISTS), and one CHECK-constraint widening on the
-- EXISTING vehicle_blocks table (drop-then-add is idempotent by
-- construction).
--
-- Nothing here drops a table, drops a column, deletes a row, or overwrites
-- an existing value. In particular the MUR relabelling adds a currency
-- column with a default and DOES NOT touch any stored amount — the numbers
-- operators already entered are rupee amounts and are left exactly as they
-- are. Wrapped in a transaction: if anything fails, the database is left
-- exactly as it was before this script ran.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- 0029 ----

create table if not exists vehicle_tariff_periods (
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

create index if not exists vehicle_tariff_periods_vehicle_id_idx
  on vehicle_tariff_periods (vehicle_id) where vehicle_id is not null;
create index if not exists vehicle_tariff_periods_category_id_idx
  on vehicle_tariff_periods (category_id) where category_id is not null;
create index if not exists vehicle_tariff_periods_effective_from_idx
  on vehicle_tariff_periods (effective_from);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'vehicle_tariff_periods_set_updated_at') then
    create trigger vehicle_tariff_periods_set_updated_at
      before update on vehicle_tariff_periods
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists vehicle_tariff_period_locations (
  tariff_period_id uuid not null references vehicle_tariff_periods (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  primary key (tariff_period_id, location_id)
);

create index if not exists vehicle_tariff_period_locations_location_id_idx
  on vehicle_tariff_period_locations (location_id);

insert into permissions (key, description) values
  ('view_tariffs', 'View seasonal duration-tier tariff periods'),
  ('manage_tariffs', 'Create, edit, and delete tariff periods and rates')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator')
  and p.key in ('view_tariffs', 'manage_tariffs')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key = 'fleet_manager'
  and p.key = 'view_tariffs'
on conflict do nothing;

alter table vehicle_tariff_periods enable row level security;
alter table vehicle_tariff_period_locations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_periods_staff_select') then
    create policy vehicle_tariff_periods_staff_select on vehicle_tariff_periods
      for select using (has_permission(auth.uid(), 'view_tariffs'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_periods_staff_insert') then
    create policy vehicle_tariff_periods_staff_insert on vehicle_tariff_periods
      for insert with check (has_permission(auth.uid(), 'manage_tariffs'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_periods_staff_update') then
    create policy vehicle_tariff_periods_staff_update on vehicle_tariff_periods
      for update using (has_permission(auth.uid(), 'manage_tariffs'))
      with check (has_permission(auth.uid(), 'manage_tariffs'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_periods_staff_delete') then
    create policy vehicle_tariff_periods_staff_delete on vehicle_tariff_periods
      for delete using (has_permission(auth.uid(), 'manage_tariffs'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_period_locations_staff_select') then
    create policy vehicle_tariff_period_locations_staff_select on vehicle_tariff_period_locations
      for select using (has_permission(auth.uid(), 'view_tariffs'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_period_locations_staff_insert') then
    create policy vehicle_tariff_period_locations_staff_insert on vehicle_tariff_period_locations
      for insert with check (has_permission(auth.uid(), 'manage_tariffs'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_tariff_period_locations_staff_delete') then
    create policy vehicle_tariff_period_locations_staff_delete on vehicle_tariff_period_locations
      for delete using (has_permission(auth.uid(), 'manage_tariffs'));
  end if;
end $$;

-- ---------------------------------------------------------------- 0030 ----

alter table vehicles
  add column if not exists is_staff_car boolean not null default false;

comment on column vehicles.is_staff_car is
  'Internal/staff vehicle: excluded from all public inventory and booking queries, but retains full fleet-ops history. Not downtime (see vehicle_blocks) and not a lifecycle state (see status).';

create index if not exists vehicles_rentable_idx
  on vehicles (status) where is_staff_car = false;

-- Relabel only. No stored amount is read, written or converted here.
alter table vehicle_maintenance_records
  add column if not exists currency text not null default 'MUR'
    check (currency = 'MUR');

alter table vehicle_compliance_records
  add column if not exists currency text not null default 'MUR'
    check (currency = 'MUR');

alter table vehicle_incident_records
  add column if not exists repair_cost_currency text not null default 'MUR'
    check (repair_cost_currency = 'MUR');

comment on column vehicle_maintenance_records.currency is
  'Always MUR. Internal fleet operating expenses are rupee-denominated; customer rental pricing is EUR and lives in bookings/vehicles.';
comment on column vehicle_compliance_records.currency is
  'Always MUR. Road tax, insurance premiums and fitness fees are paid locally in rupees.';
comment on column vehicle_incident_records.repair_cost_currency is
  'Always MUR. Applies to both estimated_repair_cost_cents and actual_repair_cost_cents.';

alter table vehicle_blocks
  drop constraint if exists vehicle_blocks_type_check;

alter table vehicle_blocks
  add constraint vehicle_blocks_type_check
  check (type in ('maintenance', 'internal', 'preparing', 'cleaning', 'incident', 'stop_sell'));

commit;
