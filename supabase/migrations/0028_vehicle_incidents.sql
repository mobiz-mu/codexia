-- Accident & Damage History — Phase 4.
--
-- vehicle_incident_records is a single normalized row per incident (not a
-- historical/renewal table like maintenance or compliance — an incident is
-- a one-time event, not something that gets "renewed"). Every attachment
-- category the spec lists (photos, police report, insurance documents,
-- repair quotations/invoices) shares ONE normalized attachment table with a
-- `category` discriminator, rather than four near-duplicate tables or a
-- JSON array on the record itself.
--
-- booking_id links an incident to the booking that was active when it
-- happened, when applicable — `on delete set null` so a booking's later
-- deletion (never actually done in this codebase today, but the FK is
-- defensive) can't cascade-delete incident/legal history.
--
-- availability_block_id optionally links to a row this module created in
-- the EXISTING vehicle_blocks table (never a second availability
-- mechanism) when the admin explicitly opts to take the vehicle off the
-- calendar for this incident.

create table vehicle_incident_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  availability_block_id uuid references vehicle_blocks (id) on delete set null,
  incident_date date not null,
  incident_time text,
  location text,
  driver_customer_name text,
  incident_type text not null check (
    incident_type in (
      'collision', 'parking_damage', 'windscreen', 'tyre_wheel', 'vandalism',
      'theft_attempt', 'weather_damage', 'mechanical_damage', 'other'
    )
  ),
  custom_type text,
  accident_description text,
  damage_description text,
  affected_areas text,
  police_report_reference text,
  insurance_claim_reference text,
  third_party_details text,
  estimated_repair_cost_cents integer check (estimated_repair_cost_cents is null or estimated_repair_cost_cents >= 0),
  actual_repair_cost_cents integer check (actual_repair_cost_cents is null or actual_repair_cost_cents >= 0),
  vehicle_operational_status text not null check (vehicle_operational_status in ('operational', 'limited_operation', 'not_operational')),
  repair_status text not null default 'reported' check (
    repair_status in (
      'reported', 'under_assessment', 'awaiting_insurance', 'approved_for_repair',
      'under_repair', 'repaired', 'closed'
    )
  ),
  severity text not null check (severity in ('minor', 'moderate', 'major', 'write_off')),
  date_reported date,
  date_repair_started date,
  date_repaired date,
  downtime_start date,
  downtime_end date,
  remarks text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_incident_records_custom_type_required
    check (incident_type <> 'other' or (custom_type is not null and length(trim(custom_type)) > 0)),
  constraint vehicle_incident_records_reported_not_before_incident
    check (date_reported is null or date_reported >= incident_date),
  constraint vehicle_incident_records_repair_started_not_before_incident
    check (date_repair_started is null or date_repair_started >= incident_date),
  constraint vehicle_incident_records_repaired_not_before_incident
    check (date_repaired is null or date_repaired >= incident_date),
  constraint vehicle_incident_records_repaired_not_before_started
    check (date_repaired is null or date_repair_started is null or date_repaired >= date_repair_started),
  constraint vehicle_incident_records_downtime_start_not_before_incident
    check (downtime_start is null or downtime_start >= incident_date),
  constraint vehicle_incident_records_downtime_end_not_before_start
    check (downtime_end is null or downtime_start is null or downtime_end >= downtime_start)
);

-- Query-pattern-driven index set: 5 of the 6 match the ones you suggested
-- (vehicle_id, incident_date, severity, repair_status, booking_id) — each
-- traced to a specific query below; date_repaired is added because the
-- dashboard's "repair cost this month" KPI filters on it specifically and
-- none of the other 5 would serve that scan.
--   (vehicle_id, incident_date desc) -> vehicle-detail "recent incidents"
--     compact section and per-vehicle history/filtered list queries.
--   (incident_date)                 -> default list sort / date-range filter
--     with no vehicle constraint.
--   (severity)                      -> severity filter, "major incidents" KPI.
--   (repair_status)                 -> repair-status filter, "open cases" and
--     "vehicles under repair" KPIs.
--   (booking_id)                    -> "find incidents for this booking"
--     lookup (sparse — most rows have a null booking_id, which is fine for
--     a btree index used only to look up specific non-null values).
--   (date_repaired)                 -> "repair cost this month" aggregation.
create index vehicle_incident_records_vehicle_date_idx on vehicle_incident_records (vehicle_id, incident_date desc);
create index vehicle_incident_records_incident_date_idx on vehicle_incident_records (incident_date);
create index vehicle_incident_records_severity_idx on vehicle_incident_records (severity);
create index vehicle_incident_records_repair_status_idx on vehicle_incident_records (repair_status);
create index vehicle_incident_records_booking_id_idx on vehicle_incident_records (booking_id);
create index vehicle_incident_records_date_repaired_idx on vehicle_incident_records (date_repaired);

create trigger vehicle_incident_records_set_updated_at
  before update on vehicle_incident_records
  for each row execute function set_updated_at();

create table vehicle_incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references vehicle_incident_records (id) on delete cascade,
  category text not null check (category in ('photo', 'police_report', 'insurance_document', 'repair_quotation', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index vehicle_incident_attachments_incident_id_idx on vehicle_incident_attachments (incident_id);

-- Reuses the EXISTING vehicle_blocks table/mechanism (see
-- lib/actions/admin/availability.ts) rather than inventing a second
-- availability system — this migration only widens the type CHECK,
-- following the exact same pattern 0021 used to add 'preparing'/'cleaning'.
alter table vehicle_blocks
  drop constraint vehicle_blocks_type_check,
  add constraint vehicle_blocks_type_check
    check (type in ('maintenance', 'internal', 'preparing', 'cleaning', 'incident'));

insert into permissions (key, description) values
  ('view_incidents', 'View vehicle accident/damage incident records'),
  ('manage_incidents', 'Create, edit, and delete vehicle accident/damage incident records');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_incidents', 'manage_incidents');

alter table vehicle_incident_records enable row level security;
alter table vehicle_incident_attachments enable row level security;

create policy vehicle_incident_records_staff_select on vehicle_incident_records
  for select using (has_permission(auth.uid(), 'view_incidents'));
create policy vehicle_incident_records_staff_insert on vehicle_incident_records
  for insert with check (has_permission(auth.uid(), 'manage_incidents'));
create policy vehicle_incident_records_staff_update on vehicle_incident_records
  for update using (has_permission(auth.uid(), 'manage_incidents'))
  with check (has_permission(auth.uid(), 'manage_incidents'));
create policy vehicle_incident_records_staff_delete on vehicle_incident_records
  for delete using (has_permission(auth.uid(), 'manage_incidents'));

create policy vehicle_incident_attachments_staff_select on vehicle_incident_attachments
  for select using (has_permission(auth.uid(), 'view_incidents'));
create policy vehicle_incident_attachments_staff_insert on vehicle_incident_attachments
  for insert with check (has_permission(auth.uid(), 'manage_incidents'));
create policy vehicle_incident_attachments_staff_delete on vehicle_incident_attachments
  for delete using (has_permission(auth.uid(), 'manage_incidents'));

-- Private bucket for incident photos/police reports/insurance docs/repair
-- quotations — same shape as compliance-documents/maintenance-documents
-- (private, signed-URL only).
insert into storage.buckets (id, name, public)
values ('incident-documents', 'incident-documents', false)
on conflict (id) do nothing;

create policy storage_incident_documents_staff on storage.objects
  for all using (bucket_id = 'incident-documents' and has_permission(auth.uid(), 'manage_incidents'))
  with check (bucket_id = 'incident-documents' and has_permission(auth.uid(), 'manage_incidents'));
