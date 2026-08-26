-- ============================================================================
-- Codexia — Incremental production upgrade: migration 0036 (weekly inspection
-- programme start date).
--
-- Safe to run against the existing database (already at 0001-0035). Adds NO
-- schema: one site_settings row, inserted ON CONFLICT DO NOTHING so a rerun is
-- a no-op and an operator who has already adjusted the date keeps their value.
--
-- Nothing is dropped, deleted or overwritten. No table, column, index or
-- constraint changes. No vehicle, inspection, block or maintenance row is read
-- or written, so no monetary value can be affected.
-- ============================================================================

begin;

insert into site_settings (key, value, value_type, description)
values (
  'weekly_inspection_program_start_date',
  '"2026-08-24"',
  'string',
  'Weekly inspection programme start date (Monday, Mauritius). Weeks before this are never reported as missed. Changing this date changes which historical weeks are considered required or missed.'
)
on conflict (key) do nothing;

commit;
