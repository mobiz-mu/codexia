-- Weekly Vehicle Inspections — Phase E.
--
-- A weekly inspection is a normalized sheet: one vehicle_inspections header
-- plus one vehicle_inspection_items row per checklist item. The checklist is
-- deliberately NOT a JSON blob — the questions we need to answer later
-- ("which vehicles keep failing tyre checks?", "how many brake defects this
-- month?") are ordinary indexed queries on item_key and result, and a blob
-- would make each of them a full scan and a parse.
--
-- The canonical 40-item checklist lives in code
-- (lib/fleet/inspection-checklist.ts), not in a table. checklist_version on
-- the header pins which definition a historical sheet was taken against, so
-- the checklist can evolve without making old inspections unreadable. This
-- phase ships version 1 only; there is no user-configurable checklist.

-- 1. HEADER ------------------------------------------------------------------
--
-- Identity snapshot: vehicle_id remains the authoritative relationship, but
-- registration and make/model are also copied onto the row. The inspection
-- PDF is a signed sheet carrying a driver and an inspector acknowledgement,
-- and a printed record whose registration silently changes because somebody
-- later edited the vehicle is not defensible as evidence. Only those two
-- identity fields are snapshotted; nothing mutable and operational is.
--
-- Result and approval are separate columns on purpose. Approval must never
-- overwrite a defect, so the schema can represent FAILED · APPROVED: `result`
-- stays 'failed' while approved_by/approved_at are set.

create table vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,

  checklist_version integer not null default 1 check (checklist_version >= 1),

  -- Mauritius operational week: Monday 00:00 → Sunday 23:59:59, identified by
  -- its Sunday. isodow 7 = Sunday.
  week_ending date not null,
  inspection_date date not null,

  odometer_km integer not null check (odometer_km >= 0),

  -- Historical evidence snapshot — see note above.
  company_name text,
  vehicle_registration text,
  vehicle_make_model text,

  -- Driver is free text: a driver is not necessarily an admin user, and there
  -- is no drivers table. Fuel records already treat drivers this way.
  driver_name text,
  driver_acknowledged_on date,

  -- The inspector IS expected to be a staff user; the free-text name is kept
  -- alongside so the printed sheet survives a profile being removed.
  inspector_name text,
  inspected_by uuid references profiles (id),
  inspector_acknowledged_on date,

  -- Approval, written only by the approve path. Never client-supplied: the
  -- server sets approved_by from the authenticated user.
  approved_by uuid references profiles (id),
  approved_at timestamptz,
  approval_remarks text,

  -- Derived from the items by the application, never sent by the UI.
  -- 'approved' is deliberately NOT a value here.
  result text not null default 'draft'
    check (result in ('draft', 'completed', 'attention_required', 'failed')),

  defects_notes text,

  -- Optional downtime, through the canonical vehicle_blocks engine. Set null
  -- on delete so releasing a block never cascades away inspection history —
  -- identical to the incident and maintenance links.
  availability_block_id uuid references vehicle_blocks (id) on delete set null,

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicle_inspections_week_ending_is_sunday
    check (extract(isodow from week_ending) = 7),

  -- The sheet must belong to the week it claims: inspected on or before the
  -- Sunday, and no earlier than that week's Monday.
  constraint vehicle_inspections_date_within_week
    check (inspection_date <= week_ending
           and inspection_date > week_ending - interval '7 days'),

  -- Approval is all-or-nothing: an approver and a timestamp arrive together.
  constraint vehicle_inspections_approval_complete
    check ((approved_by is null) = (approved_at is null)),

  -- A sheet still being filled in cannot have been signed off.
  constraint vehicle_inspections_draft_not_approved
    check (result <> 'draft' or approved_at is null)
);

comment on table vehicle_inspections is
  'Weekly vehicle inspection header. One per vehicle per Mauritius week in normal operation, though a re-inspection after repair in the same week is allowed and is not an error.';
comment on column vehicle_inspections.result is
  'Operational outcome derived from the items: draft, completed, attention_required or failed. Approval is a SEPARATE layer (approved_by/approved_at) precisely so signing off cannot overwrite a failure.';
comment on column vehicle_inspections.checklist_version is
  'Which canonical checklist definition this sheet was taken against. Lets the 40-item list evolve without making historical inspections unreadable.';
comment on column vehicle_inspections.vehicle_registration is
  'Registration as printed on this inspection. Snapshot for historical evidence only — vehicle_id is the authoritative relationship.';
comment on column vehicle_inspections.availability_block_id is
  'Optional link to the canonical vehicle_blocks row holding the vehicle off the road as a result of this inspection. Never populated automatically: a failed safety item prompts the operator, who decides.';

-- Vehicle history panel and the weekly due calculation both read newest-first
-- per vehicle.
create index vehicle_inspections_vehicle_week_idx
  on vehicle_inspections (vehicle_id, week_ending desc);
-- Main list default ordering and the dashboard week view.
create index vehicle_inspections_week_ending_idx
  on vehicle_inspections (week_ending desc);
-- "Failed" / "attention required" filters.
create index vehicle_inspections_result_idx
  on vehicle_inspections (result);
-- Awaiting-approval queue. Partial, so it indexes only the rows that queue.
create index vehicle_inspections_unapproved_idx
  on vehicle_inspections (week_ending desc)
  where approved_at is null;
-- Reverse lookup from a released block, mirroring the maintenance index.
create index vehicle_inspections_block_id_idx
  on vehicle_inspections (availability_block_id)
  where availability_block_id is not null;

create trigger vehicle_inspections_set_updated_at
  before update on vehicle_inspections
  for each row execute function set_updated_at();

-- 2. ITEMS -------------------------------------------------------------------
--
-- result is NULLABLE and null means "not yet answered". Seeding forty rows as
-- 'pass' would manufacture a clean inspection nobody performed; bulk-pass is
-- an explicit operator action in the UI, never a storage default. The header
-- stays 'draft' until every item has an answer.

create table vehicle_inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references vehicle_inspections (id) on delete cascade,

  section text not null check (
    section in ('exterior', 'tyres_wheels', 'engine_fluids',
                'interior', 'safety_equipment', 'road_test')
  ),
  item_key text not null check (length(trim(item_key)) > 0),
  display_order integer not null check (display_order >= 0),

  result text check (result in ('pass', 'attention', 'fail', 'na')),
  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per checklist item per inspection. This is what makes a
  -- duplicated key impossible rather than merely unlikely.
  constraint vehicle_inspection_items_unique_key unique (inspection_id, item_key)
);

comment on column vehicle_inspection_items.result is
  'pass, attention, fail or na. NULL means not yet answered, which keeps the inspection in draft. na never counts as a defect.';
comment on column vehicle_inspection_items.item_key is
  'Stable key from the canonical checklist in lib/fleet/inspection-checklist.ts. Append-only: renaming a key would orphan historical rows, so a changed checklist ships as a new checklist_version instead.';

create index vehicle_inspection_items_inspection_id_idx
  on vehicle_inspection_items (inspection_id);
-- "Which vehicles repeatedly fail tyre checks?" reads key + result directly.
create index vehicle_inspection_items_key_result_idx
  on vehicle_inspection_items (item_key, result);

create trigger vehicle_inspection_items_set_updated_at
  before update on vehicle_inspection_items
  for each row execute function set_updated_at();

-- 3. ATTACHMENTS -------------------------------------------------------------
--
-- Same shape as the maintenance, compliance, incident and fuel attachment
-- tables. inspection_item_id is optional and pins a photo to the exact item
-- it evidences (a tyre, a windscreen crack, a warning light); it is set null
-- rather than cascaded so re-answering an item cannot delete its photo.

create table vehicle_inspection_attachments (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references vehicle_inspections (id) on delete cascade,
  inspection_item_id uuid references vehicle_inspection_items (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index vehicle_inspection_attachments_inspection_id_idx
  on vehicle_inspection_attachments (inspection_id);

-- 4. MAINTENANCE FOLLOW-UP ---------------------------------------------------
--
-- One inspection may raise SEVERAL maintenance jobs — a tyre defect, an
-- air-conditioning defect and a wiper defect can legitimately go to different
-- garages — so this is deliberately not unique. Duplicate submission is
-- prevented in the action, not by a constraint that would forbid the second
-- legitimate job.
--
-- on delete set null, never cascade: real maintenance history and its costs
-- must survive somebody deleting the inspection that prompted the work.

alter table vehicle_maintenance_records
  add column if not exists source_inspection_id uuid
    references vehicle_inspections (id) on delete set null;

comment on column vehicle_maintenance_records.source_inspection_id is
  'Set when this job was raised from a weekly inspection defect. One inspection may have many maintenance records. ON DELETE SET NULL: deleting an inspection must never delete real maintenance history.';

create index if not exists vehicle_maintenance_records_source_inspection_idx
  on vehicle_maintenance_records (source_inspection_id)
  where source_inspection_id is not null;

-- 5. CANONICAL BLOCK TYPE ----------------------------------------------------
--
-- Inspection downtime reuses vehicle_blocks. There is one availability
-- engine; this adds a caller and a label to it, not a second system. The
-- distinct type lets the planning board say WHY a vehicle is off the road.

alter table vehicle_blocks
  drop constraint if exists vehicle_blocks_type_check;

alter table vehicle_blocks
  add constraint vehicle_blocks_type_check
  check (type in ('maintenance', 'internal', 'preparing', 'cleaning',
                  'incident', 'stop_sell', 'inspection'));

-- 6. PERMISSIONS -------------------------------------------------------------
--
-- Same reasoning as 0026/0033: seed's super_admin cross-join already ran
-- against production, so a permission added afterwards needs its own explicit
-- grant. approve_inspections is separate from manage_inspections so sign-off
-- is its own authority rather than something every inspector inherits — the
-- three fleet roles hold it today, and no lower operational role gains it.

insert into permissions (key, description) values
  ('view_inspections', 'View weekly vehicle inspections'),
  ('manage_inspections', 'Create and edit weekly vehicle inspections'),
  ('approve_inspections', 'Approve/sign off weekly vehicle inspections as fleet manager')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('super_admin', 'administrator', 'fleet_manager')
  and p.key in ('view_inspections', 'manage_inspections', 'approve_inspections')
on conflict do nothing;

-- 7. RLS ---------------------------------------------------------------------

alter table vehicle_inspections enable row level security;
alter table vehicle_inspection_items enable row level security;
alter table vehicle_inspection_attachments enable row level security;

create policy vehicle_inspections_staff_select on vehicle_inspections
  for select using (has_permission(auth.uid(), 'view_inspections'));
create policy vehicle_inspections_staff_insert on vehicle_inspections
  for insert with check (has_permission(auth.uid(), 'manage_inspections'));
create policy vehicle_inspections_staff_update on vehicle_inspections
  for update using (has_permission(auth.uid(), 'manage_inspections'))
  with check (has_permission(auth.uid(), 'manage_inspections'));
create policy vehicle_inspections_staff_delete on vehicle_inspections
  for delete using (has_permission(auth.uid(), 'manage_inspections'));

create policy vehicle_inspection_items_staff_select on vehicle_inspection_items
  for select using (has_permission(auth.uid(), 'view_inspections'));
create policy vehicle_inspection_items_staff_insert on vehicle_inspection_items
  for insert with check (has_permission(auth.uid(), 'manage_inspections'));
create policy vehicle_inspection_items_staff_update on vehicle_inspection_items
  for update using (has_permission(auth.uid(), 'manage_inspections'))
  with check (has_permission(auth.uid(), 'manage_inspections'));
create policy vehicle_inspection_items_staff_delete on vehicle_inspection_items
  for delete using (has_permission(auth.uid(), 'manage_inspections'));

create policy vehicle_inspection_attachments_staff_select on vehicle_inspection_attachments
  for select using (has_permission(auth.uid(), 'view_inspections'));
create policy vehicle_inspection_attachments_staff_insert on vehicle_inspection_attachments
  for insert with check (has_permission(auth.uid(), 'manage_inspections'));
create policy vehicle_inspection_attachments_staff_delete on vehicle_inspection_attachments
  for delete using (has_permission(auth.uid(), 'manage_inspections'));

-- 8. STORAGE -----------------------------------------------------------------
-- Private bucket, signed URLs only — same shape as the maintenance,
-- compliance, incident and fuel document buckets.

insert into storage.buckets (id, name, public)
values ('inspection-documents', 'inspection-documents', false)
on conflict (id) do nothing;

create policy storage_inspection_documents_staff on storage.objects
  for all using (bucket_id = 'inspection-documents' and has_permission(auth.uid(), 'manage_inspections'))
  with check (bucket_id = 'inspection-documents' and has_permission(auth.uid(), 'manage_inspections'));
