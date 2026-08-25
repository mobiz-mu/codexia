-- Fuel records — Phase D.
--
-- One row per fill. Costs are MUR minor units, pinned by a check constraint
-- for the same reason the other fleet-cost columns are: fuel is bought locally
-- in rupees and must never be mixed into a euro total.
--
-- Litres are stored as INTEGER MILLILITRES rather than a numeric/float. Fuel
-- volumes are read off a pump display to two decimals, and money-per-litre
-- arithmetic on a float is exactly the kind of thing that drifts by a cent
-- over a year of records. Millilitres keep it exact and integral.
--
-- Consumption is NOT stored. It is derived from this fill and the previous
-- one for the same vehicle, and only when both odometers are present and the
-- tank was filled — a part-fill tells you nothing about consumption. Storing
-- it would create a second source of truth that goes stale the moment an
-- earlier record is corrected.

create table vehicle_fuel_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  filled_at date not null,
  odometer_km integer not null check (odometer_km >= 0),
  litres_ml integer not null check (litres_ml > 0),
  price_per_litre_cents integer not null default 0 check (price_per_litre_cents >= 0),
  total_cost_cents integer not null check (total_cost_cents >= 0),
  currency text not null default 'MUR' check (currency = 'MUR'),
  station text,
  driver_name text,
  -- A part-fill cannot support a consumption figure; this is what decides
  -- whether the next fill may compute one.
  full_tank boolean not null default true,
  receipt_reference text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table vehicle_fuel_records is
  'Fuel fills per vehicle. Litres are integer millilitres and money is MUR minor units — no floating-point money or volume arithmetic anywhere in this table.';
comment on column vehicle_fuel_records.full_tank is
  'Whether the tank was filled. Consumption between two fills is only meaningful when the later one is a full tank, so this gates the calculation.';

-- Consumption and distance are always computed per vehicle in odometer order,
-- which is exactly this index.
create index vehicle_fuel_records_vehicle_odometer_idx
  on vehicle_fuel_records (vehicle_id, odometer_km);
create index vehicle_fuel_records_filled_at_idx on vehicle_fuel_records (filled_at);

create trigger vehicle_fuel_records_set_updated_at
  before update on vehicle_fuel_records
  for each row execute function set_updated_at();

create table vehicle_fuel_attachments (
  id uuid primary key default gen_random_uuid(),
  fuel_record_id uuid not null references vehicle_fuel_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index vehicle_fuel_attachments_record_id_idx on vehicle_fuel_attachments (fuel_record_id);

-- Permissions — same reasoning as 0026: seed's super_admin cross-join already
-- ran against production, so a permission added afterwards needs its own
-- explicit grant. Fuel is day-to-day fleet work, so it goes to the same three
-- roles that hold the other fleet-ops permissions.
insert into permissions (key, description) values
  ('view_fuel', 'View vehicle fuel records'),
  ('manage_fuel', 'Create, edit, and delete vehicle fuel records');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_fuel', 'manage_fuel');

alter table vehicle_fuel_records enable row level security;
alter table vehicle_fuel_attachments enable row level security;

create policy vehicle_fuel_records_staff_select on vehicle_fuel_records
  for select using (has_permission(auth.uid(), 'view_fuel'));
create policy vehicle_fuel_records_staff_insert on vehicle_fuel_records
  for insert with check (has_permission(auth.uid(), 'manage_fuel'));
create policy vehicle_fuel_records_staff_update on vehicle_fuel_records
  for update using (has_permission(auth.uid(), 'manage_fuel'))
  with check (has_permission(auth.uid(), 'manage_fuel'));
create policy vehicle_fuel_records_staff_delete on vehicle_fuel_records
  for delete using (has_permission(auth.uid(), 'manage_fuel'));

create policy vehicle_fuel_attachments_staff_select on vehicle_fuel_attachments
  for select using (has_permission(auth.uid(), 'view_fuel'));
create policy vehicle_fuel_attachments_staff_insert on vehicle_fuel_attachments
  for insert with check (has_permission(auth.uid(), 'manage_fuel'));
create policy vehicle_fuel_attachments_staff_delete on vehicle_fuel_attachments
  for delete using (has_permission(auth.uid(), 'manage_fuel'));

-- Private bucket, signed URLs only — same shape as the maintenance,
-- compliance and incident document buckets.
insert into storage.buckets (id, name, public)
values ('fuel-documents', 'fuel-documents', false)
on conflict (id) do nothing;

create policy storage_fuel_documents_staff on storage.objects
  for all using (bucket_id = 'fuel-documents' and has_permission(auth.uid(), 'manage_fuel'))
  with check (bucket_id = 'fuel-documents' and has_permission(auth.uid(), 'manage_fuel'));
