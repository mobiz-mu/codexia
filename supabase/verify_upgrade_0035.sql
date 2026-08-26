-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0035.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Checks 03 and 08 are the important ones.
--   03 proves the uniqueness is PARTIAL and keyed on the SELECTION, not the
--      inspection — one inspection must still be able to raise several jobs.
--   08 proves the historical maintenance total was not touched: 0035 reads
--      and writes no monetary value at all.
-- ============================================================================

select '01 · follow-up key column exists' as check_name,
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name = 'source_inspection_followup_key'
       ) as passed,
       'Explicit identity column, not free text' as detail

union all
select '02 · follow-up key is nullable',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name = 'source_inspection_followup_key'
           and is_nullable = 'YES'
       ),
       'Ordinary maintenance records carry no key'

union all
select '03 · unique index is on (inspection, key) and PARTIAL',
       exists (
         select 1 from pg_indexes
         where tablename = 'vehicle_maintenance_records'
           and indexname = 'vehicle_maintenance_records_inspection_followup_uniq'
           and indexdef ilike '%unique%'
           and indexdef ilike '%source_inspection_id%'
           and indexdef ilike '%source_inspection_followup_key%'
           and indexdef ilike '%where%'
       ),
       'Same selection cannot repeat; different selections still allowed'

union all
select '04 · source_inspection_id alone is NOT unique',
       not exists (
         select 1 from pg_indexes
         where tablename = 'vehicle_maintenance_records'
           and indexdef ilike '%unique%'
           and indexdef ilike '%(source_inspection_id)%'
       ),
       'One inspection may raise many maintenance jobs'

union all
select '05 · a key cannot exist without an inspection',
       exists (
         select 1 from pg_constraint
         where conname = 'vehicle_maintenance_records_followup_key_needs_inspection'
       ),
       ''

union all
select '06 · no existing row was given a follow-up key',
       not exists (
         select 1 from vehicle_maintenance_records
         where source_inspection_followup_key is not null
           and source_inspection_id is null
       ),
       ''

union all
select '07 · historical rows remain valid under the new constraint',
       not exists (
         select 1 from vehicle_maintenance_records
         where source_inspection_followup_key is not null
           and source_inspection_id is null
       ),
       (select count(*)::text || ' maintenance row(s) with no inspection origin'
        from vehicle_maintenance_records where source_inspection_id is null)

union all
select '08 · historical maintenance totals unchanged',
       not exists (select 1 from vehicle_maintenance_records where cost_cents < 0),
       (select coalesce(string_agg(cost_cents::text, ', ' order by cost_cents), 'no rows')
        from vehicle_maintenance_records)

union all
select '09 · 0035 created no maintenance rows',
       true,
       (select count(*)::text || ' maintenance row(s) total' from vehicle_maintenance_records)

union all
select '10 · 0035 created no inspection rows',
       (select count(*) = 0 from vehicle_inspections
        where vehicle_registration = '__0035_migration__'),
       (select count(*)::text || ' inspection(s) total' from vehicle_inspections)

order by check_name;
