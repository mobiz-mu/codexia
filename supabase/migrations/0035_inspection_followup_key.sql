-- Inspection follow-up concurrency guarantee — Phase E3.5.
--
-- Raising a maintenance job from inspection defects was guarded only in the
-- application: read the existing follow-ups, compare, then insert. That stops
-- a double-click, and did so during live verification, but two genuinely
-- concurrent requests can both pass the read before either inserts. The
-- database has to be the final authority.
--
-- The obvious fix — making source_inspection_id unique — is wrong. One
-- inspection may legitimately raise several jobs: a tyre defect and an
-- electrical defect can go to different garages. What must be unique is the
-- SELECTION, not the inspection.
--
-- Hence an explicit key column rather than hiding identity inside free text.
-- The previous guard compared repairs_performed, which is the wrong identity
-- on three counts: it embeds display labels (presentation, and translatable),
-- it embeds per-item remarks (an operator edits one and the same selection
-- silently stops matching itself), and its formatting is a rendering choice.
-- The key is derived only from canonical checklist item_keys, sorted and
-- deduplicated, so [brakes, wipers] and [wipers, brakes] are one follow-up
-- while [brakes] and [wipers] remain two.

alter table vehicle_maintenance_records
  add column if not exists source_inspection_followup_key text;

comment on column vehicle_maintenance_records.source_inspection_followup_key is
  'Canonical identity of an inspection follow-up: the selected checklist item_keys, deduplicated and sorted, joined by commas. Derived only from stable keys — never from labels or remarks, which are presentation and mutable. NULL on any maintenance record not raised from an inspection.';

-- The concurrency guarantee. Partial, so it constrains nothing except rows
-- that actually came from an inspection:
--
--   * two requests for the same selection  -> second raises SQLSTATE 23505
--   * different selections, same inspection -> both allowed
--   * same selection, different inspections -> both allowed
--   * ordinary maintenance (both columns null) -> entirely unaffected,
--     including every historical row, which predates both columns
create unique index if not exists vehicle_maintenance_records_inspection_followup_uniq
  on vehicle_maintenance_records (source_inspection_id, source_inspection_followup_key)
  where source_inspection_id is not null
    and source_inspection_followup_key is not null;

-- A follow-up key without an inspection behind it would be identity with
-- nothing to identify, and would sit outside the partial index entirely.
alter table vehicle_maintenance_records
  drop constraint if exists vehicle_maintenance_records_followup_key_needs_inspection;

alter table vehicle_maintenance_records
  add constraint vehicle_maintenance_records_followup_key_needs_inspection
  check (source_inspection_followup_key is null or source_inspection_id is not null);
