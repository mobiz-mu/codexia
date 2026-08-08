-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0026 ONLY.
--
-- Safe to run against the existing database (already at 0001–0025). Purely
-- additive: two new tables (IF NOT EXISTS), new indexes (IF NOT EXISTS), a
-- new trigger and RLS policies (guarded by catalog checks so a partial prior
-- run doesn't error), two new permission rows (ON CONFLICT DO NOTHING), and
-- one new private storage bucket (ON CONFLICT DO NOTHING). Nothing here
-- drops a table, drops a column, deletes a row, or overwrites an existing
-- value. Wrapped in a transaction — if anything fails, the database is left
-- exactly as it was before this script ran.
-- ============================================================================

begin;

create table if not exists vehicle_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  maintenance_date date not null,
  maintenance_type text not null check (
    maintenance_type in (
      'scheduled_service',
      'repair',
      'tyre_change',
      'battery_change',
      'oil_filter_change',
      'brake_work',
      'suspension_work',
      'electrical_work',
      'other'
    )
  ),
  custom_type text,
  repairs_performed text,
  parts_changed text,
  tyre_changes text,
  battery_changes text,
  servicing_details text,
  oil_filter_changes text,
  brake_work text,
  suspension_work text,
  electrical_work text,
  mileage_km integer check (mileage_km is null or mileage_km >= 0),
  service_provider text,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  remarks text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_maintenance_records_custom_type_required
    check (maintenance_type <> 'other' or (custom_type is not null and length(trim(custom_type)) > 0))
);

create index if not exists vehicle_maintenance_records_vehicle_id_idx on vehicle_maintenance_records (vehicle_id);
create index if not exists vehicle_maintenance_records_maintenance_date_idx on vehicle_maintenance_records (maintenance_date);
create index if not exists vehicle_maintenance_records_maintenance_type_idx on vehicle_maintenance_records (maintenance_type);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'vehicle_maintenance_records_set_updated_at'
      and tgrelid = 'public.vehicle_maintenance_records'::regclass
  ) then
    create trigger vehicle_maintenance_records_set_updated_at
      before update on vehicle_maintenance_records
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists vehicle_maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null references vehicle_maintenance_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_maintenance_attachments_record_id_idx on vehicle_maintenance_attachments (maintenance_record_id);

insert into permissions (key, description) values
  ('view_maintenance', 'View vehicle maintenance records'),
  ('manage_maintenance', 'Create, edit, and delete vehicle maintenance records')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_maintenance', 'manage_maintenance')
on conflict do nothing;

alter table vehicle_maintenance_records enable row level security;
alter table vehicle_maintenance_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records' and policyname = 'vehicle_maintenance_records_staff_select') then
    create policy vehicle_maintenance_records_staff_select on vehicle_maintenance_records
      for select using (has_permission(auth.uid(), 'view_maintenance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records' and policyname = 'vehicle_maintenance_records_staff_insert') then
    create policy vehicle_maintenance_records_staff_insert on vehicle_maintenance_records
      for insert with check (has_permission(auth.uid(), 'manage_maintenance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records' and policyname = 'vehicle_maintenance_records_staff_update') then
    create policy vehicle_maintenance_records_staff_update on vehicle_maintenance_records
      for update using (has_permission(auth.uid(), 'manage_maintenance'))
      with check (has_permission(auth.uid(), 'manage_maintenance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records' and policyname = 'vehicle_maintenance_records_staff_delete') then
    create policy vehicle_maintenance_records_staff_delete on vehicle_maintenance_records
      for delete using (has_permission(auth.uid(), 'manage_maintenance'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_attachments' and policyname = 'vehicle_maintenance_attachments_staff_select') then
    create policy vehicle_maintenance_attachments_staff_select on vehicle_maintenance_attachments
      for select using (has_permission(auth.uid(), 'view_maintenance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_attachments' and policyname = 'vehicle_maintenance_attachments_staff_insert') then
    create policy vehicle_maintenance_attachments_staff_insert on vehicle_maintenance_attachments
      for insert with check (has_permission(auth.uid(), 'manage_maintenance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_attachments' and policyname = 'vehicle_maintenance_attachments_staff_delete') then
    create policy vehicle_maintenance_attachments_staff_delete on vehicle_maintenance_attachments
      for delete using (has_permission(auth.uid(), 'manage_maintenance'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('maintenance-documents', 'maintenance-documents', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'storage_maintenance_documents_staff'
  ) then
    create policy storage_maintenance_documents_staff on storage.objects
      for all using (bucket_id = 'maintenance-documents' and has_permission(auth.uid(), 'manage_maintenance'))
      with check (bucket_id = 'maintenance-documents' and has_permission(auth.uid(), 'manage_maintenance'));
  end if;
end $$;

commit;
