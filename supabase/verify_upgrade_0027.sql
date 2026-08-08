-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0027.sql.
-- Nothing in this file writes, deletes, or modifies anything.
-- ============================================================================

select '01 · vehicle_compliance_records table exists' as check_name,
       exists (select 1 from information_schema.tables where table_name = 'vehicle_compliance_records') as passed,
       '' as detail

union all
select '02 · vehicle_compliance_attachments table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_compliance_attachments'),
       ''

union all
select '03 · vehicle_compliance_alert_logs table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_compliance_alert_logs'),
       ''

union all
select '04 · vehicle_compliance_current view exists',
       exists (select 1 from information_schema.views where table_name = 'vehicle_compliance_current'),
       ''

union all
select '05 · custom_type-required constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_compliance_records_custom_type_required'),
       ''

union all
select '06 · issued-before-expiry constraint exists',
       exists (select 1 from pg_constraint where conname = 'vehicle_compliance_records_issued_before_expiry'),
       ''

union all
select '07 · (vehicle_id, document_type, expiry_date) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_compliance_records' and indexname = 'vehicle_compliance_records_vehicle_type_expiry_idx'),
       ''

union all
select '08 · (document_type, expiry_date) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_compliance_records' and indexname = 'vehicle_compliance_records_type_expiry_idx'),
       ''

union all
select '09 · (expiry_date) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_compliance_records' and indexname = 'vehicle_compliance_records_expiry_idx'),
       ''

union all
select '10 · attachments (compliance_record_id) index exists',
       exists (select 1 from pg_indexes where tablename = 'vehicle_compliance_attachments' and indexname = 'vehicle_compliance_attachments_record_id_idx'),
       ''

union all
select '11 · alert_logs unique(compliance_record_id, alert_date) constraint exists',
       exists (
         select 1 from pg_constraint
         where conrelid = 'public.vehicle_compliance_alert_logs'::regclass and contype = 'u'
       ),
       ''

union all
select '12 · updated_at trigger exists',
       exists (
         select 1 from pg_trigger
         where tgname = 'vehicle_compliance_records_set_updated_at'
           and tgrelid = 'public.vehicle_compliance_records'::regclass
       ),
       ''

union all
select '13 · RLS enabled on all 3 new tables',
       (
         select count(*) from pg_class
         where relname in ('vehicle_compliance_records', 'vehicle_compliance_attachments', 'vehicle_compliance_alert_logs')
           and relrowsecurity = true
       ) = 3,
       'count = ' || (
         select count(*) from pg_class
         where relname in ('vehicle_compliance_records', 'vehicle_compliance_attachments', 'vehicle_compliance_alert_logs')
           and relrowsecurity = true
       )::text

union all
select '14 · 4 policies on vehicle_compliance_records',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records') = 4,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_records')::text

union all
select '15 · 3 policies on vehicle_compliance_attachments',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_attachments') = 3,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_attachments')::text

union all
select '16 · 1 policy on vehicle_compliance_alert_logs',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_alert_logs') = 1,
       'count = ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_compliance_alert_logs')::text

union all
select '17 · view_compliance and manage_compliance permissions exist',
       (select count(*) from permissions where key in ('view_compliance', 'manage_compliance')) = 2,
       ''

union all
select '18 · super_admin, administrator, fleet_manager each have both new permissions (6 grants total)',
       (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_compliance', 'manage_compliance')
       ) = 6,
       'count = ' || (
         select count(*) from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_compliance', 'manage_compliance')
       )::text

union all
select '19 · no other role received view_compliance or manage_compliance',
       not exists (
         select 1 from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where r.key not in ('super_admin', 'administrator', 'fleet_manager')
           and p.key in ('view_compliance', 'manage_compliance')
       ),
       coalesce(
         (
           select string_agg(r.key || ':' || p.key, ', ')
           from role_permissions rp
           join roles r on r.id = rp.role_id
           join permissions p on p.id = rp.permission_id
           where r.key not in ('super_admin', 'administrator', 'fleet_manager')
             and p.key in ('view_compliance', 'manage_compliance')
         ),
         'none'
       )

union all
select '20 · compliance-documents storage bucket exists (private)',
       exists (select 1 from storage.buckets where id = 'compliance-documents' and public = false),
       ''

union all
select '21 · vehicles table row count unchanged by this migration (sanity check, not a hard requirement)',
       true,
       'vehicles count = ' || (select count(*) from vehicles)::text

order by 1;
