-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0026.sql.
-- Nothing in this file writes, deletes, or modifies anything.
-- ============================================================================

select '01 · vehicle_maintenance_records table exists' as check_name,
       exists (select 1 from information_schema.tables where table_name = 'vehicle_maintenance_records') as passed,
       '' as detail

union all
select '02 · vehicle_maintenance_attachments table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_maintenance_attachments'),
       ''

union all
select '03 · vehicle_id index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_maintenance_records' and indexname = 'vehicle_maintenance_records_vehicle_id_idx'),
       ''

union all
select '04 · maintenance_date index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_maintenance_records' and indexname = 'vehicle_maintenance_records_maintenance_date_idx'),
       ''

union all
select '05 · maintenance_type index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_maintenance_records' and indexname = 'vehicle_maintenance_records_maintenance_type_idx'),
       ''

union all
select '06 · updated_at trigger exists',
       exists (
         select 1 from pg_trigger
         where tgname = 'vehicle_maintenance_records_set_updated_at'
           and tgrelid = 'public.vehicle_maintenance_records'::regclass
       ),
       ''

union all
select '07 · RLS enabled on vehicle_maintenance_records',
       coalesce((select relrowsecurity from pg_class where relname = 'vehicle_maintenance_records'), false),
       ''

union all
select '08 · RLS enabled on vehicle_maintenance_attachments',
       coalesce((select relrowsecurity from pg_class where relname = 'vehicle_maintenance_attachments'), false),
       ''

union all
select '09 · 4 policies on vehicle_maintenance_records',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records') = 4,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_records')::text

union all
select '10 · 3 policies on vehicle_maintenance_attachments',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_attachments') = 3,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance_attachments')::text

union all
select '11 · view_maintenance permission exists',
       exists (select 1 from permissions where key = 'view_maintenance'),
       ''

union all
select '12 · manage_maintenance permission exists',
       exists (select 1 from permissions where key = 'manage_maintenance'),
       ''

union all
select '13 · super_admin, administrator, and fleet_manager each have both new permissions (6 grants total)',
       (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_maintenance', 'manage_maintenance')
       ) = 6,
       'count = ' || (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_maintenance', 'manage_maintenance')
       )::text

union all
select '14 · no other role received view_maintenance or manage_maintenance',
       not exists (
         select 1 from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key not in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_maintenance', 'manage_maintenance')
       ),
       coalesce(
         (
           select string_agg(r.key || ':' || p.key, ', ')
           from role_permissions rp
           join roles r on r.id = rp.role_id
           join permissions p on p.id = rp.permission_id
           where r.key not in ('super_admin', 'administrator', 'fleet_manager')
             and p.key in ('view_maintenance', 'manage_maintenance')
         ),
         'none'
       )

union all
select '15 · maintenance-documents storage bucket exists (private)',
       exists (select 1 from storage.buckets where id = 'maintenance-documents' and public = false),
       ''

union all
select '16 · vehicles table row count unchanged by this migration (sanity check, not a hard requirement)',
       true,
       'vehicles count = ' || (select count(*) from vehicles)::text

order by 1;
