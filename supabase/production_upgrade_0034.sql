-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0034 (Weekly Vehicle
-- Inspections).
--
-- Safe to run against the existing database (already at 0001–0033). Purely
-- additive and re-runnable: three new tables (IF NOT EXISTS), one new nullable
-- column on vehicle_maintenance_records (IF NOT EXISTS), new indexes
-- (IF NOT EXISTS), triggers and policies guarded by catalog checks, three
-- permission rows (ON CONFLICT DO NOTHING) and one private storage bucket
-- (ON CONFLICT DO NOTHING).
--
-- The one non-additive statement is the vehicle_blocks type check, which is
-- dropped and recreated to add 'inspection'. It is a strict WIDENING: every
-- previously accepted value is still accepted, so no existing row can be
-- invalidated by it. Nothing is dropped, deleted or overwritten anywhere else.
--
-- Verified against an embedded PostgreSQL 18 cluster: applies cleanly, reruns
-- cleanly, and produces a schema identical to a fresh install from
-- apply_all.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- header ----

create table if not exists vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,

  checklist_version integer not null default 1 check (checklist_version >= 1),

  week_ending date not null,
  inspection_date date not null,

  odometer_km integer not null check (odometer_km >= 0),

  company_name text,
  vehicle_registration text,
  vehicle_make_model text,

  driver_name text,
  driver_acknowledged_on date,

  inspector_name text,
  inspected_by uuid references profiles (id),
  inspector_acknowledged_on date,

  approved_by uuid references profiles (id),
  approved_at timestamptz,
  approval_remarks text,

  result text not null default 'draft'
    check (result in ('draft', 'completed', 'attention_required', 'failed')),

  defects_notes text,

  availability_block_id uuid references vehicle_blocks (id) on delete set null,

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicle_inspections_week_ending_is_sunday
    check (extract(isodow from week_ending) = 7),
  constraint vehicle_inspections_date_within_week
    check (inspection_date <= week_ending
           and inspection_date > week_ending - interval '7 days'),
  constraint vehicle_inspections_approval_complete
    check ((approved_by is null) = (approved_at is null)),
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

create index if not exists vehicle_inspections_vehicle_week_idx
  on vehicle_inspections (vehicle_id, week_ending desc);
create index if not exists vehicle_inspections_week_ending_idx
  on vehicle_inspections (week_ending desc);
create index if not exists vehicle_inspections_result_idx
  on vehicle_inspections (result);
create index if not exists vehicle_inspections_unapproved_idx
  on vehicle_inspections (week_ending desc)
  where approved_at is null;
create index if not exists vehicle_inspections_block_id_idx
  on vehicle_inspections (availability_block_id)
  where availability_block_id is not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'vehicle_inspections_set_updated_at') then
    create trigger vehicle_inspections_set_updated_at
      before update on vehicle_inspections
      for each row execute function set_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------- items ----

create table if not exists vehicle_inspection_items (
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

  constraint vehicle_inspection_items_unique_key unique (inspection_id, item_key)
);

comment on column vehicle_inspection_items.result is
  'pass, attention, fail or na. NULL means not yet answered, which keeps the inspection in draft. na never counts as a defect.';
comment on column vehicle_inspection_items.item_key is
  'Stable key from the canonical checklist in lib/fleet/inspection-checklist.ts. Append-only: renaming a key would orphan historical rows, so a changed checklist ships as a new checklist_version instead.';

create index if not exists vehicle_inspection_items_inspection_id_idx
  on vehicle_inspection_items (inspection_id);
create index if not exists vehicle_inspection_items_key_result_idx
  on vehicle_inspection_items (item_key, result);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'vehicle_inspection_items_set_updated_at') then
    create trigger vehicle_inspection_items_set_updated_at
      before update on vehicle_inspection_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------- attachments ----

create table if not exists vehicle_inspection_attachments (
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

create index if not exists vehicle_inspection_attachments_inspection_id_idx
  on vehicle_inspection_attachments (inspection_id);

-- ----------------------------------------------- maintenance follow-up ------

alter table vehicle_maintenance_records
  add column if not exists source_inspection_id uuid
    references vehicle_inspections (id) on delete set null;

comment on column vehicle_maintenance_records.source_inspection_id is
  'Set when this job was raised from a weekly inspection defect. One inspection may have many maintenance records. ON DELETE SET NULL: deleting an inspection must never delete real maintenance history.';

create index if not exists vehicle_maintenance_records_source_inspection_idx
  on vehicle_maintenance_records (source_inspection_id)
  where source_inspection_id is not null;

-- ------------------------------------------------- canonical block type -----
-- Strict widening of the existing constraint: every value accepted before is
-- still accepted, so no existing vehicle_blocks row can be invalidated.

alter table vehicle_blocks
  drop constraint if exists vehicle_blocks_type_check;

alter table vehicle_blocks
  add constraint vehicle_blocks_type_check
  check (type in ('maintenance', 'internal', 'preparing', 'cleaning',
                  'incident', 'stop_sell', 'inspection'));

-- ----------------------------------------------------------- permissions ----

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

-- ------------------------------------------------------------------- RLS ----

alter table vehicle_inspections enable row level security;
alter table vehicle_inspection_items enable row level security;
alter table vehicle_inspection_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspections_staff_select') then
    create policy vehicle_inspections_staff_select on vehicle_inspections
      for select using (has_permission(auth.uid(), 'view_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspections_staff_insert') then
    create policy vehicle_inspections_staff_insert on vehicle_inspections
      for insert with check (has_permission(auth.uid(), 'manage_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspections_staff_update') then
    create policy vehicle_inspections_staff_update on vehicle_inspections
      for update using (has_permission(auth.uid(), 'manage_inspections'))
      with check (has_permission(auth.uid(), 'manage_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspections_staff_delete') then
    create policy vehicle_inspections_staff_delete on vehicle_inspections
      for delete using (has_permission(auth.uid(), 'manage_inspections'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_items_staff_select') then
    create policy vehicle_inspection_items_staff_select on vehicle_inspection_items
      for select using (has_permission(auth.uid(), 'view_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_items_staff_insert') then
    create policy vehicle_inspection_items_staff_insert on vehicle_inspection_items
      for insert with check (has_permission(auth.uid(), 'manage_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_items_staff_update') then
    create policy vehicle_inspection_items_staff_update on vehicle_inspection_items
      for update using (has_permission(auth.uid(), 'manage_inspections'))
      with check (has_permission(auth.uid(), 'manage_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_items_staff_delete') then
    create policy vehicle_inspection_items_staff_delete on vehicle_inspection_items
      for delete using (has_permission(auth.uid(), 'manage_inspections'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_attachments_staff_select') then
    create policy vehicle_inspection_attachments_staff_select on vehicle_inspection_attachments
      for select using (has_permission(auth.uid(), 'view_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_attachments_staff_insert') then
    create policy vehicle_inspection_attachments_staff_insert on vehicle_inspection_attachments
      for insert with check (has_permission(auth.uid(), 'manage_inspections'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'vehicle_inspection_attachments_staff_delete') then
    create policy vehicle_inspection_attachments_staff_delete on vehicle_inspection_attachments
      for delete using (has_permission(auth.uid(), 'manage_inspections'));
  end if;
end $$;

-- --------------------------------------------------------------- storage ----

insert into storage.buckets (id, name, public)
values ('inspection-documents', 'inspection-documents', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'storage_inspection_documents_staff') then
    create policy storage_inspection_documents_staff on storage.objects
      for all using (bucket_id = 'inspection-documents' and has_permission(auth.uid(), 'manage_inspections'))
      with check (bucket_id = 'inspection-documents' and has_permission(auth.uid(), 'manage_inspections'));
  end if;
end $$;

commit;
