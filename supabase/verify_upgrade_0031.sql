-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0031.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Check 05 is the important one: 0031 defaulted every pre-existing booking to
-- 'website', which is accurate because the manual/admin path did not exist
-- before it. If any row is not classified, the additive default did not run.
-- ============================================================================

select '01 · bookings.source column exists' as check_name,
       exists (
         select 1 from information_schema.columns
         where table_name = 'bookings' and column_name = 'source'
       ) as passed,
       '' as detail

union all
select '02 · bookings.source is NOT NULL with a default',
       exists (
         select 1 from information_schema.columns
         where table_name = 'bookings' and column_name = 'source'
           and is_nullable = 'NO' and column_default is not null
       ),
       'Every booking must carry a channel'

union all
select '03 · source is constrained to website/admin',
       exists (
         select 1 from pg_constraint
         where conrelid = 'bookings'::regclass
           and pg_get_constraintdef(oid) ilike '%source%'
           and pg_get_constraintdef(oid) ilike '%website%'
           and pg_get_constraintdef(oid) ilike '%admin%'
       ),
       ''

union all
select '04 · bookings.internal_notes column exists',
       exists (
         select 1 from information_schema.columns
         where table_name = 'bookings' and column_name = 'internal_notes'
       ),
       'Staff-only notes; distinct from customer special_requests'

union all
select '05 · every existing booking is classified',
       not exists (select 1 from bookings where source is null),
       (select count(*) filter (where source = 'website') || ' website / '
             || count(*) filter (where source = 'admin')   || ' admin'
        from bookings)

union all
select '06 · channel/window index exists',
       exists (
         select 1 from pg_indexes
         where tablename = 'bookings' and indexname = 'bookings_source_pickup_at_idx'
       ),
       'Planning board filters channel over a date window'

order by check_name;
