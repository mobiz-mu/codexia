-- Fleet Documents, Compliance & Expiry Alarm System — Phase 3.
--
-- vehicle_compliance_records is a historical table: renewing a document
-- means inserting a NEW row for the same vehicle_id + document_type, never
-- overwriting the previous one — so past renewals stay visible. "Current"
-- status is always derived live from whichever row has the latest
-- expiry_date for a given (vehicle_id, document_type[, custom_type]) —
-- never a stored status column, so it can never go stale.
--
-- document_type is a fixed 5-value classification (Road Tax / Insurance /
-- PSVL / Fitness / Other). The compact vehicle-detail summary only shows
-- the first 4 (a single "current" slot each); "Other" documents can be
-- multiple concurrent, distinct records for the same vehicle (e.g. an
-- emissions certificate and a permit), disambiguated by custom_type — which
-- is why the "current" view below dedupes on custom_type too, not just
-- document_type.

create table vehicle_compliance_records (
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

-- Query-pattern-driven index set (not a blind default):
--   1. (vehicle_id, document_type, expiry_date desc) — serves the "current"
--      view's DISTINCT ON below, the per-vehicle "View history" query, and
--      vehicle+type filtered list queries.
--   2. (document_type, expiry_date) — type-filtered global list/status-range
--      queries (e.g. "all Insurance documents expiring soon").
--   3. (expiry_date) — global status-range scans with no type/vehicle filter
--      (default list sort, dashboard aggregate counts, the daily cron scan).
create index vehicle_compliance_records_vehicle_type_expiry_idx
  on vehicle_compliance_records (vehicle_id, document_type, expiry_date desc);
create index vehicle_compliance_records_type_expiry_idx
  on vehicle_compliance_records (document_type, expiry_date);
create index vehicle_compliance_records_expiry_idx
  on vehicle_compliance_records (expiry_date);

create trigger vehicle_compliance_records_set_updated_at
  before update on vehicle_compliance_records
  for each row execute function set_updated_at();

-- The single shared "what's current right now" query, implemented once as a
-- view and reused everywhere (vehicle-detail compact section, dashboard
-- aggregates, sidebar badge, daily cron) rather than four ad-hoc queries.
-- security_invoker = true means this view enforces the querying role's own
-- RLS on vehicle_compliance_records rather than running with the view
-- owner's privileges — it does not bypass RLS.
create view vehicle_compliance_current
  with (security_invoker = true) as
select distinct on (vehicle_id, document_type, coalesce(custom_type, ''))
  id, vehicle_id, document_type, custom_type, reference_number, provider,
  issued_date, expiry_date, cost_cents, remarks, created_by, created_at, updated_at
from vehicle_compliance_records
order by vehicle_id, document_type, coalesce(custom_type, ''), expiry_date desc, created_at desc;

create table vehicle_compliance_attachments (
  id uuid primary key default gen_random_uuid(),
  compliance_record_id uuid not null references vehicle_compliance_records (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index vehicle_compliance_attachments_record_id_idx on vehicle_compliance_attachments (compliance_record_id);

-- Idempotent daily-alert dedup log — mirrors reminder_logs' proven shape.
-- The unique constraint is what actually guarantees "at most one alert per
-- document per calendar day", the same insert-first-then-act pattern already
-- used by the reminders/review-requests crons. No "resolved" bookkeeping is
-- stored here: resolution is derived (a renewed document simply stops
-- appearing in vehicle_compliance_current's alarm range), and any lingering
-- notification rows for a superseded record are archived directly by the
-- create/update actions at the moment of renewal.
create table vehicle_compliance_alert_logs (
  id uuid primary key default gen_random_uuid(),
  compliance_record_id uuid not null references vehicle_compliance_records (id) on delete cascade,
  alert_date date not null,
  status_at_alert text not null check (status_at_alert in ('warning', 'urgent', 'expires_today', 'expired')),
  created_at timestamptz not null default now(),
  unique (compliance_record_id, alert_date)
);

insert into permissions (key, description) values
  ('view_compliance', 'View vehicle compliance/document records'),
  ('manage_compliance', 'Create, edit, and delete vehicle compliance/document records');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_compliance', 'manage_compliance');

alter table vehicle_compliance_records enable row level security;
alter table vehicle_compliance_attachments enable row level security;
alter table vehicle_compliance_alert_logs enable row level security;

create policy vehicle_compliance_records_staff_select on vehicle_compliance_records
  for select using (has_permission(auth.uid(), 'view_compliance'));
create policy vehicle_compliance_records_staff_insert on vehicle_compliance_records
  for insert with check (has_permission(auth.uid(), 'manage_compliance'));
create policy vehicle_compliance_records_staff_update on vehicle_compliance_records
  for update using (has_permission(auth.uid(), 'manage_compliance'))
  with check (has_permission(auth.uid(), 'manage_compliance'));
create policy vehicle_compliance_records_staff_delete on vehicle_compliance_records
  for delete using (has_permission(auth.uid(), 'manage_compliance'));

create policy vehicle_compliance_attachments_staff_select on vehicle_compliance_attachments
  for select using (has_permission(auth.uid(), 'view_compliance'));
create policy vehicle_compliance_attachments_staff_insert on vehicle_compliance_attachments
  for insert with check (has_permission(auth.uid(), 'manage_compliance'));
create policy vehicle_compliance_attachments_staff_delete on vehicle_compliance_attachments
  for delete using (has_permission(auth.uid(), 'manage_compliance'));

create policy vehicle_compliance_alert_logs_staff_select on vehicle_compliance_alert_logs
  for select using (has_permission(auth.uid(), 'view_compliance'));

-- Private bucket for compliance documents (policy/certificate scans etc.) —
-- same shape as maintenance-documents/invoices (private, signed-URL only).
insert into storage.buckets (id, name, public)
values ('compliance-documents', 'compliance-documents', false)
on conflict (id) do nothing;

create policy storage_compliance_documents_staff on storage.objects
  for all using (bucket_id = 'compliance-documents' and has_permission(auth.uid(), 'manage_compliance'))
  with check (bucket_id = 'compliance-documents' and has_permission(auth.uid(), 'manage_compliance'));
