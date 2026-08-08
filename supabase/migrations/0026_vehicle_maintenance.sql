-- Vehicle Maintenance Records — Phase 2 (fleet-ops module #1 of 3).
--
-- vehicle_maintenance_records is a single normalized row per maintenance
-- event. maintenance_type is a fixed classification (9 values incl. "other")
-- used for filtering; the individual *_work/*_changes/*_details text columns
-- are optional free-text notes that can be filled in regardless of which
-- type was selected, since a single visit can touch more than one system
-- (e.g. a scheduled service that also included a tyre change).
--
-- Costs are EUR integer cents only (no currency column) — this module has
-- no MUR-legacy concern the way vehicles/extras/locations did, so there is
-- nothing to migrate away from.
--
-- vehicle_maintenance_attachments is a separate child table (not the shared
-- fleet_document_attachments design sketched in earlier planning) since this
-- phase is scoped to Maintenance Records only; if Compliance/Incident
-- modules need the same shape later, that's a decision for those phases.

create table vehicle_maintenance_records (
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

create index vehicle_maintenance_records_vehicle_id_idx on vehicle_maintenance_records (vehicle_id);
create index vehicle_maintenance_records_maintenance_date_idx on vehicle_maintenance_records (maintenance_date);
create index vehicle_maintenance_records_maintenance_type_idx on vehicle_maintenance_records (maintenance_type);

create trigger vehicle_maintenance_records_set_updated_at
  before update on vehicle_maintenance_records
  for each row execute function set_updated_at();

create table vehicle_maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null references vehicle_maintenance_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index vehicle_maintenance_attachments_record_id_idx on vehicle_maintenance_attachments (maintenance_record_id);

-- Permissions — inserted directly here (not seed.sql) since seed's
-- super_admin cross-join already ran once against production; a permission
-- added after that point needs its own explicit role_permissions grant.
-- Granted to super_admin, administrator, and fleet_manager only — these are
-- the three roles with a real operational need to log/view maintenance;
-- every other existing role (booking_manager, accountant, content_editor,
-- support_agent) is deliberately left out.
insert into permissions (key, description) values
  ('view_maintenance', 'View vehicle maintenance records'),
  ('manage_maintenance', 'Create, edit, and delete vehicle maintenance records');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_maintenance', 'manage_maintenance');

alter table vehicle_maintenance_records enable row level security;
alter table vehicle_maintenance_attachments enable row level security;

create policy vehicle_maintenance_records_staff_select on vehicle_maintenance_records
  for select using (has_permission(auth.uid(), 'view_maintenance'));
create policy vehicle_maintenance_records_staff_insert on vehicle_maintenance_records
  for insert with check (has_permission(auth.uid(), 'manage_maintenance'));
create policy vehicle_maintenance_records_staff_update on vehicle_maintenance_records
  for update using (has_permission(auth.uid(), 'manage_maintenance'))
  with check (has_permission(auth.uid(), 'manage_maintenance'));
create policy vehicle_maintenance_records_staff_delete on vehicle_maintenance_records
  for delete using (has_permission(auth.uid(), 'manage_maintenance'));

create policy vehicle_maintenance_attachments_staff_select on vehicle_maintenance_attachments
  for select using (has_permission(auth.uid(), 'view_maintenance'));
create policy vehicle_maintenance_attachments_staff_insert on vehicle_maintenance_attachments
  for insert with check (has_permission(auth.uid(), 'manage_maintenance'));
create policy vehicle_maintenance_attachments_staff_delete on vehicle_maintenance_attachments
  for delete using (has_permission(auth.uid(), 'manage_maintenance'));

-- Private bucket for maintenance receipts/invoices/photos — same shape as
-- the existing invoices/payment-proofs buckets (private, signed-URL only).
insert into storage.buckets (id, name, public)
values ('maintenance-documents', 'maintenance-documents', false)
on conflict (id) do nothing;

create policy storage_maintenance_documents_staff on storage.objects
  for all using (bucket_id = 'maintenance-documents' and has_permission(auth.uid(), 'manage_maintenance'))
  with check (bucket_id = 'maintenance-documents' and has_permission(auth.uid(), 'manage_maintenance'));
