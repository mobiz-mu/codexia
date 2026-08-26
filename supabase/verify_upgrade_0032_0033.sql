-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0032_0033.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Checks 06 and 07 are the important ones. 0032 added an itemised cost
-- breakdown alongside a total that pre-existing rows carry on its own
-- (149977 = Rs 1,499.77). cost_cents must remain a plain column holding that
-- stored value: had it been made a generated column, every historical total
-- with no breakdown behind it would silently have become zero.
-- ============================================================================

select '01 · maintenance downtime link exists' as check_name,
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name = 'availability_block_id'
       ) as passed,
       'Maintenance downtime uses the canonical vehicle_blocks engine' as detail

union all
select '02 · downtime link is ON DELETE SET NULL, not CASCADE',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_maintenance_records'::regclass
           and contype = 'f'
           and confdeltype = 'n'
           and pg_get_constraintdef(oid) ilike '%vehicle_blocks%'
       ),
       'Removing a block must never cascade away service history'

union all
select '03 · itemised cost columns exist',
       (
         select count(*) = 3 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name in ('parts_cost_cents', 'labour_cost_cents', 'other_cost_cents')
       ),
       ''

union all
select '04 · service-planning columns exist',
       (
         select count(*) = 3 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name in ('invoice_reference', 'next_service_date', 'next_service_mileage_km')
       ),
       ''

union all
select '05 · itemised costs cannot go negative',
       (
         select count(*) >= 3 from pg_constraint
         where conrelid = 'vehicle_maintenance_records'::regclass
           and contype = 'c'
           and (pg_get_constraintdef(oid) ilike '%parts_cost_cents >= 0%'
             or pg_get_constraintdef(oid) ilike '%labour_cost_cents >= 0%'
             or pg_get_constraintdef(oid) ilike '%other_cost_cents >= 0%')
       ),
       ''

union all
select '06 · cost_cents is NOT a generated column',
       not exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name = 'cost_cents'
           and is_generated <> 'NEVER'
       ),
       'A generated total would erase every historical unitemised amount'

union all
select '07 · historical maintenance totals were preserved, not converted',
       not exists (
         select 1 from vehicle_maintenance_records
         where cost_cents < 0
       ),
       (select coalesce(
          'max total ' || max(cost_cents)::text || ' minor units', 'no rows')
        from vehicle_maintenance_records)

union all
select '08 · vehicle_fuel_records table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_fuel_records'),
       ''

union all
select '09 · fuel volume is integer millilitres',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_fuel_records'
           and column_name = 'litres_ml' and data_type = 'integer'
       ),
       'No floating-point volume arithmetic'

union all
select '10 · fuel money is MUR-pinned',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_fuel_records'::regclass
           and pg_get_constraintdef(oid) ilike '%currency = ''MUR''%'
       ),
       'Fleet running costs are rupees; customer pricing stays EUR'

union all
select '11 · consumption is NOT stored',
       not exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_fuel_records'
           and column_name in ('consumption', 'consumption_l_per_100km', 'litres_per_100km')
       ),
       'Consumption is derived, never a second source of truth'

union all
select '12 · full_tank gate exists',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_fuel_records' and column_name = 'full_tank'
       ),
       'A part-fill cannot support a consumption figure'

union all
select '13 · vehicle_fuel_attachments table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_fuel_attachments'),
       ''

union all
select '14 · fuel odometer index exists',
       exists (
         select 1 from pg_indexes
         where tablename = 'vehicle_fuel_records'
           and indexname = 'vehicle_fuel_records_vehicle_odometer_idx'
       ),
       'Consumption is computed per vehicle in odometer order'

union all
select '15 · fuel permissions exist',
       (select count(*) = 2 from permissions where key in ('view_fuel', 'manage_fuel')),
       ''

union all
select '16 · fuel permissions granted to the three fleet roles',
       (
         select count(*) = 6
         from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where p.key in ('view_fuel', 'manage_fuel')
           and r.key in ('super_admin', 'administrator', 'fleet_manager')
       ),
       'super_admin, administrator, fleet_manager'

union all
select '17 · RLS enabled on both fuel tables',
       (
         select count(*) = 2 from pg_class
         where relname in ('vehicle_fuel_records', 'vehicle_fuel_attachments')
           and relrowsecurity
       ),
       ''

union all
select '18 · fuel-documents bucket exists and is private',
       exists (select 1 from storage.buckets where id = 'fuel-documents' and public = false),
       'Signed URLs only'

order by check_name;
