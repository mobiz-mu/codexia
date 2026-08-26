-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0035 (inspection
-- follow-up concurrency key).
--
-- Safe to run against the existing database (already at 0001–0034). Purely
-- additive and re-runnable: one nullable column (IF NOT EXISTS), one partial
-- unique index (IF NOT EXISTS) and one check constraint (dropped and
-- recreated so a rerun is idempotent).
--
-- Nothing is dropped, deleted or overwritten. No row is created, no existing
-- row is modified, and no monetary value is touched — the historical
-- maintenance total of 149977 MUR minor units is not read or written by any
-- statement here.
--
-- Both new objects are PARTIAL: they constrain only rows raised from an
-- inspection. Every maintenance record with source_inspection_id NULL —
-- which is every row that exists today — is entirely unaffected and cannot
-- be invalidated by this migration.
-- ============================================================================

begin;

alter table vehicle_maintenance_records
  add column if not exists source_inspection_followup_key text;

comment on column vehicle_maintenance_records.source_inspection_followup_key is
  'Canonical identity of an inspection follow-up: the selected checklist item_keys, deduplicated and sorted, joined by commas. Derived only from stable keys — never from labels or remarks, which are presentation and mutable. NULL on any maintenance record not raised from an inspection.';

create unique index if not exists vehicle_maintenance_records_inspection_followup_uniq
  on vehicle_maintenance_records (source_inspection_id, source_inspection_followup_key)
  where source_inspection_id is not null
    and source_inspection_followup_key is not null;

alter table vehicle_maintenance_records
  drop constraint if exists vehicle_maintenance_records_followup_key_needs_inspection;

alter table vehicle_maintenance_records
  add constraint vehicle_maintenance_records_followup_key_needs_inspection
  check (source_inspection_followup_key is null or source_inspection_id is not null);

commit;
