-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0027 ONLY.
--
-- Safe to run against the existing database (already at 0001–0026). Purely
-- additive: three new tables (IF NOT EXISTS), one view (CREATE OR REPLACE —
-- safe to rerun, just redefines the same query), new indexes (IF NOT
-- EXISTS), a new trigger and RLS policies (guarded by catalog checks so a
-- partial prior run doesn't error), two new permission rows (ON CONFLICT DO
-- NOTHING), and one new private storage bucket (ON CONFLICT DO NOTHING).
-- Nothing here drops a table, drops a column, deletes a row, or overwrites
-- an existing value. Wrapped in a transaction — if anything fails, the
-- database is left exactly as it was before this script ran.
-- ============================================================================

begin;

create table if not exists vehicle_compliance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  document_type text not null check (document_type in ('road_tax', 'insurance', 'psvl', 'fitness', 'other')),
  custom_type text,
  reference_number text,
  provider text,
  issued_date date,
  expiry_date date not null,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  remarks text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_compliance_records_custom_type_required
    check (document_type <> 'other' or (custom_type is not null and length(trim(custom_type)) > 0)),
  constraint vehicle_compliance_records_issued_before_expiry
    check (issued_date is null or issued_date <= expiry_date)
);

create index if not exists vehicle_compliance_records_vehicle_type_expiry_idx
  on vehicle_compliance_records (vehicle_id, document_type, expiry_date desc);
create index if not exists vehicle_compliance_records_type_expiry_idx
  on vehicle_compliance_records (document_type, expiry_date);
create index if not exists vehicle_compliance_records_expiry_idx
  on vehicle_compliance_records (expiry_date);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'vehicle_compliance_records_set_updated_at'
      and tgrelid = 'public.vehicle_compliance_records'::regclass
  ) then
    create trigger vehicle_compliance_records_set_updated_at
      before update on vehicle_compliance_records
      for each row execute function set_updated_at();
  end if;
end $$;

create or replace view vehicle_compliance_current
  with (security_invoker = true) as
select distinct on (vehicle_id, document_type, coalesce(custom_type, ''))
  id, vehicle_id, document_type, custom_type, reference_number, provider,
  issued_date, expiry_date, cost_cents, remarks, created_by, created_at, updated_at
from vehicle_compliance_records
order by vehicle_id, document_type, coalesce(custom_type, ''), expiry_date desc, created_at desc;

create table if not exists vehicle_compliance_attachments (
  id uuid primary key default gen_random_uuid(),
  compliance_record_id uuid not null references vehicle_compliance_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_compliance_attachments_record_id_idx on vehicle_compliance_attachments (compliance_record_id);

create table if not exists vehicle_compliance_alert_logs (
  id uuid primary key default gen_random_uuid(),
  compliance_record_id uuid not null references vehicle_compliance_records (id) on delete cascade,
  alert_date date not null,
  status_at_alert text not null check (status_at_alert in ('warning', 'urgent', 'expires_today', 'expired')),
  created_at timestamptz not null default now(),
  unique (compliance_record_id, alert_date)
);

insert into permissions (key, description) values
  ('view_compliance', 'View vehicle compliance/document records'),
  ('manage_compliance', 'Create, edit, and delete vehicle compliance/document records')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_compliance', 'manage_compliance')
on conflict do nothing;

alter table vehicle_compliance_records enable row level security;
alter table vehicle_compliance_attachments enable row level security;
alter table vehicle_compliance_alert_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records' and policyname = 'vehicle_compliance_records_staff_select') then
    create policy vehicle_compliance_records_staff_select on vehicle_compliance_records
      for select using (has_permission(auth.uid(), 'view_compliance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records' and policyname = 'vehicle_compliance_records_staff_insert') then
    create policy vehicle_compliance_records_staff_insert on vehicle_compliance_records
      for insert with check (has_permission(auth.uid(), 'manage_compliance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records' and policyname = 'vehicle_compliance_records_staff_update') then
    create policy vehicle_compliance_records_staff_update on vehicle_compliance_records
      for update using (has_permission(auth.uid(), 'manage_compliance'))
      with check (has_permission(auth.uid(), 'manage_compliance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records' and policyname = 'vehicle_compliance_records_staff_delete') then
    create policy vehicle_compliance_records_staff_delete on vehicle_compliance_records
      for delete using (has_permission(auth.uid(), 'manage_compliance'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_attachments' and policyname = 'vehicle_compliance_attachments_staff_select') then
    create policy vehicle_compliance_attachments_staff_select on vehicle_compliance_attachments
      for select using (has_permission(auth.uid(), 'view_compliance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_attachments' and policyname = 'vehicle_compliance_attachments_staff_insert') then
    create policy vehicle_compliance_attachments_staff_insert on vehicle_compliance_attachments
      for insert with check (has_permission(auth.uid(), 'manage_compliance'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_attachments' and policyname = 'vehicle_compliance_attachments_staff_delete') then
    create policy vehicle_compliance_attachments_staff_delete on vehicle_compliance_attachments
      for delete using (has_permission(auth.uid(), 'manage_compliance'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_alert_logs' and policyname = 'vehicle_compliance_alert_logs_staff_select') then
    create policy vehicle_compliance_alert_logs_staff_select on vehicle_compliance_alert_logs
      for select using (has_permission(auth.uid(), 'view_compliance'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('compliance-documents', 'compliance-documents', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'storage_compliance_documents_staff'
  ) then
    create policy storage_compliance_documents_staff on storage.objects
      for all using (bucket_id = 'compliance-documents' and has_permission(auth.uid(), 'manage_compliance'))
      with check (bucket_id = 'compliance-documents' and has_permission(auth.uid(), 'manage_compliance'));
  end if;
end $$;

commit;
