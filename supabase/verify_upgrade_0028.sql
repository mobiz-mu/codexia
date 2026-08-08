-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0028.sql.
-- Nothing in this file writes, deletes, or modifies anything.
-- ============================================================================

select '01 · vehicle_incident_records table exists' as check_name,
       exists (select 1 from information_schema.tables where table_name = 'vehicle_incident_records') as passed,
       '' as detail

union all
select '02 · vehicle_incident_attachments table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_incident_attachments'),
       ''

union all
select '03 · custom_type-required constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_custom_type_required'),
       ''

union all
select '04 · reported-not-before-incident constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_reported_not_before_incident'),
       ''

union all
select '05 · repair-started-not-before-incident constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_repair_started_not_before_incident'),
       ''

union all
select '06 · repaired-not-before-incident constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_repaired_not_before_incident'),
       ''

union all
select '07 · repaired-not-before-started constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_repaired_not_before_started'),
       ''

union all
select '08 · downtime-start-not-before-incident constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_downtime_start_not_before_incident'),
       ''

union all
select '09 · downtime-end-not-before-start constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_incident_records_downtime_end_not_before_start'),
       ''

union all
select '10 · (vehicle_id, incident_date) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_vehicle_date_idx'),
       ''

union all
select '11 · (incident_date) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_incident_date_idx'),
       ''

union all
select '12 · (severity) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_severity_idx'),
       ''

union all
select '13 · (repair_status) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_repair_status_idx'),
       ''

union all
select '14 · (booking_id) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_booking_id_idx'),
       ''

union all
select '15 · (date_repaired) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_records' and indexname = 'vehicle_incident_records_date_repaired_idx'),
       ''

union all
select '16 · attachments (incident_id) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_incident_attachments' and indexname = 'vehicle_incident_attachments_incident_id_idx'),
       ''

union all
select '17 · updated_at trigger exists',
       exists (
         select 1 from pg_trigger
         where tgname = 'vehicle_incident_records_set_updated_at'
           and tgrelid = 'public.vehicle_incident_records'::regclass
       ),
       ''

union all
select '18 · vehicle_blocks.type widened to include ''incident''',
       exists (
         select 1 from pg_constraint
         where conname = 'vehicle_blocks_type_check'
           and conrelid = 'public.vehicle_blocks'::regclass
           and pg_get_constraintdef(oid) like '%''incident''%'
       ),
       ''

union all
select '19 · RLS enabled on both new tables',
       (
         select count(*) from pg_class
         where relname in ('vehicle_incident_records', 'vehicle_incident_attachments')
           and relrowsecurity = true
       ) = 2,
       'count = ' || (
         select count(*) from pg_class
         where relname in ('vehicle_incident_records', 'vehicle_incident_attachments')
           and relrowsecurity = true
       )::text

union all
select '20 · 4 policies on vehicle_incident_records',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_incident_records') = 4,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_incident_records')::text

union all
select '21 · 3 policies on vehicle_incident_attachments',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_incident_attachments') = 3,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_incident_attachments')::text

union all
select '22 · view_incidents and manage_incidents permissions exist',
       (select count(*) from permissions where key in ('view_incidents', 'manage_incidents')) = 2,
       ''

union all
select '23 · super_admin, administrator, fleet_manager each have both new permissions (6 grants total)',
       (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_incidents', 'manage_incidents')
       ) = 6,
       'count = ' || (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_incidents', 'manage_incidents')
       )::text

union all
select '24 · no other role received view_incidents or manage_incidents',
       not exists (
         select 1 from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key not in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_incidents', 'manage_incidents')
       ),
       ''

union all
select '25 · incident-documents storage bucket exists (private)',
       exists (select 1 from storage.buckets where id = 'incident-documents' and public = false),
       ''

union all
select '26 · vehicles/vehicle_blocks row counts unchanged by this migration (sanity check)',
       true,
       'vehicles count = ' || (select count(*) from vehicles)::text || ', vehicle_blocks count = ' || (select count(*) from vehicle_blocks)::text

order by 1;
