-- Staff-car flag, MUR relabelling of internal fleet costs, stop-sell blocks.
-- Phase A (fleet-ops upgrade). Purely additive — no data is rewritten.
--
-- 1. STAFF CARS -----------------------------------------------------------
-- A staff car stays a first-class fleet vehicle (it accrues maintenance,
-- fuel, compliance and inspection history) but is never rentable by the
-- public. This is deliberately NOT modelled as vehicles.status: status is a
-- publication lifecycle (draft/active/archived) and a staff car is an active,
-- in-service vehicle. It is also distinct from a vehicle_blocks row, which
-- expresses temporary downtime with a start and end; staff use is an
-- open-ended property of the vehicle itself.

alter table vehicles
  add column if not exists is_staff_car boolean not null default false;

comment on column vehicles.is_staff_car is
  'Internal/staff vehicle: excluded from all public inventory and booking queries, but retains full fleet-ops history. Not downtime (see vehicle_blocks) and not a lifecycle state (see status).';

-- Partial index: public availability queries filter on NOT is_staff_car, so
-- the useful index is over the rentable rows only.
create index if not exists vehicles_rentable_idx
  on vehicles (status) where is_staff_car = false;

-- 2. INTERNAL FLEET COSTS ARE MUR ----------------------------------------
-- Migrations 0026/0027/0028 declared these cost columns EUR. That was wrong
-- in practice: the values operators actually entered are rupee amounts (the
-- live tyre-change row reads 149977 = Rs 1,499.77, which is a realistic
-- Mauritian price where EUR 1,499.77 plainly is not; the road-tax row reads
-- 550000 = Rs 5,500, likewise).
--
-- The stored NUMBERS ARE CORRECT AND ARE NOT TOUCHED. Only the label is
-- fixed. No arithmetic conversion is applied to any row — doing so would
-- corrupt genuine data on the strength of a mislabelled column.
--
-- The check constraint pins these to MUR so an EUR amount can never later be
-- written into a rupee column and silently mixed into a fleet-cost total.
-- Customer rental pricing remains strictly EUR in its own tables.

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

-- 3. STOP-SELL ------------------------------------------------------------
-- Stop-sell is commercial withdrawal from sale, not a fault. It belongs in
-- the existing canonical unavailability engine rather than a parallel
-- mechanism, so this only widens the existing type check — exactly as 0028
-- did when it added 'incident'.

alter table vehicle_blocks
  drop constraint if exists vehicle_blocks_type_check;

alter table vehicle_blocks
  add constraint vehicle_blocks_type_check
  check (type in ('maintenance', 'internal', 'preparing', 'cleaning', 'incident', 'stop_sell'));
