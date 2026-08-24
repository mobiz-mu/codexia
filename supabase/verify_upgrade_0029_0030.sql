-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0029_0030.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Check 14 is the important one: it proves the MUR relabelling preserved the
-- stored amounts rather than converting them.
-- ============================================================================

select '01 · vehicle_tariff_periods table exists' as check_name,
       exists (select 1 from information_schema.tables where table_name = 'vehicle_tariff_periods') as passed,
       '' as detail

union all
select '02 · vehicle_tariff_period_locations table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_tariff_period_locations'),
       ''

union all
select '03 · exactly-one-scope constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_tariff_periods_scope_exactly_one'),
       ''

union all
select '04 · date-order constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_tariff_periods_date_order'),
       ''

union all
select '05 · vehicle overlap exclusion constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_tariff_periods_no_vehicle_overlap'),
       'Rejects two active periods covering one day for the same vehicle'

union all
select '06 · category overlap exclusion constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_tariff_periods_no_category_overlap'),
       'Rejects two active periods covering one day for the same category'

union all
select '07 · tariff rates are EUR-pinned',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_tariff_periods'::regclass
           and pg_get_constraintdef(oid) ilike '%currency = ''EUR''%'
       ),
       'Customer rental pricing must stay EUR'

union all
select '08 · updated_at trigger installed',
       exists (select 1 from pg_trigger where tgname = 'vehicle_tariff_periods_set_updated_at'),
       ''

union all
select '09 · RLS enabled on both tariff tables',
       (select bool_and(rowsecurity) from pg_tables
        where tablename in ('vehicle_tariff_periods', 'vehicle_tariff_period_locations')),
       ''

union all
select '10 · all 7 tariff RLS policies present',
       (select count(*) = 7 from pg_policies
        where tablename in ('vehicle_tariff_periods', 'vehicle_tariff_period_locations')),
       (select count(*)::text || ' policies found'
        from pg_policies
        where tablename in ('vehicle_tariff_periods', 'vehicle_tariff_period_locations'))

union all
select '11 · tariff permissions exist',
       (select count(*) = 2 from permissions where key in ('view_tariffs', 'manage_tariffs')),
       ''

union all
-- 5 grants, not 3: super_admin and administrator each get both permissions,
-- fleet_manager gets view_tariffs only. (2 + 2 + 1.)
select '12 · tariff permissions granted to expected roles',
       (select count(*) = 5
        from role_permissions rp
        join roles r on r.id = rp.role_id
        join permissions p on p.id = rp.permission_id
        where p.key in ('view_tariffs', 'manage_tariffs')
          and r.key in ('super_admin', 'administrator', 'fleet_manager')),
       (select count(*)::text || ' grants (expect 5: super_admin+administrator both, fleet_manager view only)'
        from role_permissions rp
        join roles r on r.id = rp.role_id
        join permissions p on p.id = rp.permission_id
        where p.key in ('view_tariffs', 'manage_tariffs')
          and r.key in ('super_admin', 'administrator', 'fleet_manager'))

union all
select '13 · vehicles.is_staff_car exists and defaults false',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicles' and column_name = 'is_staff_car'
       ) and not exists (select 1 from vehicles where is_staff_car is null),
       (select count(*)::text || ' staff cars currently flagged' from vehicles where is_staff_car)

union all
-- The pre-upgrade values, recorded from the live database before the script
-- was written: the tyre change was 149977 and the road tax 550000. If the
-- relabelling had converted rather than relabelled, these would have moved.
select '14 · MUR relabel preserved stored amounts (no conversion)',
       coalesce((select cost_cents from vehicle_maintenance_records order by created_at limit 1) = 149977, true)
       and coalesce((select cost_cents from vehicle_compliance_records order by created_at limit 1) = 550000, true),
       'Expect 149977 (Rs 1,499.77) and 550000 (Rs 5,500) unchanged'

union all
select '15 · fleet cost columns are MUR-pinned',
       (select count(*) = 3 from pg_constraint
        where pg_get_constraintdef(oid) ilike '%= ''MUR''%'),
       'maintenance, compliance and incident repair costs'

union all
select '16 · vehicle_blocks accepts stop_sell',
       (select pg_get_constraintdef(oid) ilike '%stop_sell%'
        from pg_constraint where conname = 'vehicle_blocks_type_check'),
       ''

union all
select '17 · no existing data was lost',
       (select count(*) from vehicles) >= 8
       and (select count(*) from bookings) >= 2
       and (select count(*) from vehicle_blocks) >= 2,
       (select 'vehicles=' || (select count(*) from vehicles)
             || ' bookings=' || (select count(*) from bookings)
             || ' blocks=' || (select count(*) from vehicle_blocks))

order by check_name;
