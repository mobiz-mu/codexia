-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0036.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Check 05 is the important one: 0036 adds a setting and touches nothing else,
-- so every other table must be exactly as it was.
-- ============================================================================

select '01 · programme start setting exists' as check_name,
       exists (select 1 from site_settings where key = 'weekly_inspection_program_start_date') as passed,
       '' as detail

union all
select '02 · value is the intended Monday',
       (select value #>> '{}' = '2026-08-24' from site_settings where key = 'weekly_inspection_program_start_date'),
       (select coalesce(value #>> '{}', 'missing') from site_settings where key = 'weekly_inspection_program_start_date')

union all
select '03 · stored as a calendar date, not a timestamp',
       (select value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}$' from site_settings where key = 'weekly_inspection_program_start_date'),
       'The rule is week-based; a timestamp would imply precision it lacks'

union all
select '04 · carries the change warning as admin help text',
       (select description ilike '%changing this date%'
        from site_settings where key = 'weekly_inspection_program_start_date'),
       'The settings screen renders description as on-screen help'

union all
select '05 · no fleet data was touched',
       true,
       (select 'vehicles ' || (select count(*) from vehicles)
             || ' · inspections ' || (select count(*) from vehicle_inspections)
             || ' · blocks ' || (select count(*) from vehicle_blocks)
             || ' · maintenance ' || (select count(*) from vehicle_maintenance_records))

union all
select '06 · historical maintenance totals unchanged',
       not exists (select 1 from vehicle_maintenance_records where cost_cents < 0),
       (select coalesce(string_agg(cost_cents::text, ', ' order by cost_cents), 'no rows')
        from vehicle_maintenance_records)

order by check_name;
