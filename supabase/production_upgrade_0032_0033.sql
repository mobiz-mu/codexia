-- ============================================================================
-- Codexia — Incremental production upgrade: migrations 0032 + 0033.
--
-- Safe to run against the existing database (already at 0001–0031). Purely
-- additive: seven new columns on vehicle_maintenance_records (IF NOT EXISTS),
-- two new tables, new indexes (IF NOT EXISTS), two permission rows
-- (ON CONFLICT DO NOTHING), one private storage bucket (ON CONFLICT DO
-- NOTHING), and RLS policies guarded by catalog checks.
--
-- Nothing is dropped, deleted, or overwritten. In particular cost_cents is
-- deliberately NOT converted into a generated column: the existing row holds
-- a total with no breakdown (149977 = Rs 1,499.77) and a generated column
-- would silently rewrite it to zero. Verified against an embedded Postgres.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- 0032 ----

alter table vehicle_maintenance_records
  add column if not exists availability_block_id uuid references vehicle_blocks (id) on delete set null;

comment on column vehicle_maintenance_records.availability_block_id is
  'Optional link to the canonical vehicle_blocks row taking this vehicle off the road for the work. Null means the record is history only and does not affect availability. Never populated automatically — the operator opts in.';

create index if not exists vehicle_maintenance_records_block_id_idx
  on vehicle_maintenance_records (availability_block_id)
  where availability_block_id is not null;

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

create index if not exists vehicle_maintenance_records_next_service_date_idx
  on vehicle_maintenance_records (next_service_date)
  where next_service_date is not null;

-- ---------------------------------------------------------------- 0033 ----

create table if not exists vehicle_fuel_records (
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
  full_tank boolean not null default true,
  receipt_reference text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_fuel_records_vehicle_odometer_idx
  on vehicle_fuel_records (vehicle_id, odometer_km);
create index if not exists vehicle_fuel_records_filled_at_idx on vehicle_fuel_records (filled_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'vehicle_fuel_records_set_updated_at') then
    create trigger vehicle_fuel_records_set_updated_at
      before update on vehicle_fuel_records
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists vehicle_fuel_attachments (
  id uuid primary key default gen_random_uuid(),
  fuel_record_id uuid not null references vehicle_fuel_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_fuel_attachments_record_id_idx on vehicle_fuel_attachments (fuel_record_id);

insert into permissions (key, description) values
  ('view_fuel', 'View vehicle fuel records'),
  ('manage_fuel', 'Create, edit, and delete vehicle fuel records')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_fuel', 'manage_fuel')
on conflict do nothing;

alter table vehicle_fuel_records enable row level security;
alter table vehicle_fuel_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_records_staff_select') then
    create policy vehicle_fuel_records_staff_select on vehicle_fuel_records
      for select using (has_permission(auth.uid(), 'view_fuel'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_records_staff_insert') then
    create policy vehicle_fuel_records_staff_insert on vehicle_fuel_records
      for insert with check (has_permission(auth.uid(), 'manage_fuel'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_records_staff_update') then
    create policy vehicle_fuel_records_staff_update on vehicle_fuel_records
      for update using (has_permission(auth.uid(), 'manage_fuel'))
      with check (has_permission(auth.uid(), 'manage_fuel'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_records_staff_delete') then
    create policy vehicle_fuel_records_staff_delete on vehicle_fuel_records
      for delete using (has_permission(auth.uid(), 'manage_fuel'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_attachments_staff_select') then
    create policy vehicle_fuel_attachments_staff_select on vehicle_fuel_attachments
      for select using (has_permission(auth.uid(), 'view_fuel'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_attachments_staff_insert') then
    create policy vehicle_fuel_attachments_staff_insert on vehicle_fuel_attachments
      for insert with check (has_permission(auth.uid(), 'manage_fuel'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_fuel_attachments_staff_delete') then
    create policy vehicle_fuel_attachments_staff_delete on vehicle_fuel_attachments
      for delete using (has_permission(auth.uid(), 'manage_fuel'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('fuel-documents', 'fuel-documents', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'storage_fuel_documents_staff') then
    create policy storage_fuel_documents_staff on storage.objects
      for all using (bucket_id = 'fuel-documents' and has_permission(auth.uid(), 'manage_fuel'))
      with check (bucket_id = 'fuel-documents' and has_permission(auth.uid(), 'manage_fuel'));
  end if;
end $$;

commit;
