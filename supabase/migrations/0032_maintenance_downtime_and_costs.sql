-- Maintenance downtime + itemised MUR costs — Phase D.
--
-- 1. DOWNTIME --------------------------------------------------------------
-- A maintenance record may optionally take the vehicle off the road. It does
-- so through the SAME vehicle_blocks table incidents already use — there is
-- one unavailability engine and this adds a second caller to it, not a
-- second system. The link mirrors vehicle_incident_records.availability_block_id
-- exactly, including the on-delete-set-null so removing a block never
-- cascades away the service history that references it.
--
-- Downtime is OPT-IN. Logging that a car had its oil changed last Tuesday
-- must not retroactively mark it unavailable, so nothing here creates a block
-- automatically; the admin ticks "Mark vehicle unavailable" and supplies the
-- window.

alter table vehicle_maintenance_records
  add column if not exists availability_block_id uuid references vehicle_blocks (id) on delete set null;

comment on column vehicle_maintenance_records.availability_block_id is
  'Optional link to the canonical vehicle_blocks row taking this vehicle off the road for the work. Null means the record is history only and does not affect availability. Never populated automatically — the operator opts in.';

create index if not exists vehicle_maintenance_records_block_id_idx
  on vehicle_maintenance_records (availability_block_id)
  where availability_block_id is not null;

-- 2. ITEMISED COSTS --------------------------------------------------------
-- cost_cents remains the authoritative TOTAL and is deliberately not turned
-- into a generated column: the existing row holds a total with no breakdown
-- (149977 = Rs 1,499.77), and a generated column would silently rewrite it to
-- zero. The three components are an optional itemisation the form sums into
-- the total when they are used.
--
-- All amounts are MUR integer minor units, pinned by the 0030 currency check.

alter table vehicle_maintenance_records
  add column if not exists parts_cost_cents integer not null default 0 check (parts_cost_cents >= 0),
  add column if not exists labour_cost_cents integer not null default 0 check (labour_cost_cents >= 0),
  add column if not exists other_cost_cents integer not null default 0 check (other_cost_cents >= 0),
  add column if not exists invoice_reference text,
  add column if not exists next_service_date date,
  add column if not exists next_service_mileage_km integer
    check (next_service_mileage_km is null or next_service_mileage_km >= 0);

comment on column vehicle_maintenance_records.cost_cents is
  'Total cost in MUR minor units. Authoritative: the parts/labour/other columns are an optional breakdown, and pre-existing rows carry a total with no breakdown at all.';
comment on column vehicle_maintenance_records.next_service_date is
  'When this vehicle is next due in. Drives the service-due view; distinct from vehicles.next_service_date, which 0021 left behind and no current code writes.';

-- Service-due lookups scan forward from today over a small table, so a plain
-- index on the date is the right shape.
create index if not exists vehicle_maintenance_records_next_service_date_idx
  on vehicle_maintenance_records (next_service_date)
  where next_service_date is not null;
