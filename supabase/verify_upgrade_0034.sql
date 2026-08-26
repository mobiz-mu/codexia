-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0034.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Checks 04, 05 and 17 are the important ones.
--   04/05 prove approval is a separate layer from result, so the schema can
--         record FAILED · APPROVED without the sign-off erasing the failure.
--   17    proves the vehicle_blocks type change was a WIDENING: every value
--         accepted before 0034 is still accepted, so no existing block row
--         was invalidated by adding 'inspection'.
-- ============================================================================

select '01 · vehicle_inspections table exists' as check_name,
       exists (select 1 from information_schema.tables where table_name = 'vehicle_inspections') as passed,
       '' as detail

union all
select '02 · vehicle_inspection_items table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_inspection_items'),
       ''

union all
select '03 · vehicle_inspection_attachments table exists',
       exists (select 1 from information_schema.tables where table_name = 'vehicle_inspection_attachments'),
       ''

union all
select '04 · result enum excludes approved',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_inspections'::regclass
           and pg_get_constraintdef(oid) ilike '%result%'
           and pg_get_constraintdef(oid) ilike '%failed%'
           and pg_get_constraintdef(oid) not ilike '%''approved''%'
       ),
       'Approval must never overwrite the operational result'

union all
select '05 · approval columns exist and are separate from result',
       (
         select count(*) = 3 from information_schema.columns
         where table_name = 'vehicle_inspections'
           and column_name in ('approved_by', 'approved_at', 'approval_remarks')
       ),
       'FAILED and APPROVED must be representable together'

union all
select '06 · approval is all-or-nothing',
       exists (
         select 1 from pg_constraint
         where conname = 'vehicle_inspections_approval_complete'
       ),
       'An approver and a timestamp arrive together'

union all
select '07 · a draft inspection cannot be approved',
       exists (
         select 1 from pg_constraint
         where conname = 'vehicle_inspections_draft_not_approved'
       ),
       ''

union all
select '08 · checklist_version column exists',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_inspections' and column_name = 'checklist_version'
       ),
       'Pins which canonical checklist a historical sheet was taken against'

union all
select '09 · week_ending must be a Sunday',
       exists (select 1 from pg_constraint where conname = 'vehicle_inspections_week_ending_is_sunday'),
       'Mauritius operational week: Monday to Sunday'

union all
select '10 · inspection_date must fall inside its week',
       exists (select 1 from pg_constraint where conname = 'vehicle_inspections_date_within_week'),
       ''

union all
select '11 · odometer cannot be negative',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_inspections'::regclass
           and pg_get_constraintdef(oid) ilike '%odometer_km >= 0%'
       ),
       ''

union all
select '12 · identity snapshot columns exist',
       (
         select count(*) = 2 from information_schema.columns
         where table_name = 'vehicle_inspections'
           and column_name in ('vehicle_registration', 'vehicle_make_model')
       ),
       'Historical PDF evidence; vehicle_id stays authoritative'

union all
select '13 · item result enum is pass/attention/fail/na',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_inspection_items'::regclass
           and pg_get_constraintdef(oid) ilike '%pass%'
           and pg_get_constraintdef(oid) ilike '%attention%'
           and pg_get_constraintdef(oid) ilike '%fail%'
           and pg_get_constraintdef(oid) ilike '%na%'
       ),
       ''

union all
select '14 · item result is nullable, so unanswered is representable',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_inspection_items'
           and column_name = 'result' and is_nullable = 'YES'
       ),
       'NULL means not yet answered; items are never seeded as pass'

union all
select '15 · a checklist key cannot repeat inside one inspection',
       exists (select 1 from pg_constraint where conname = 'vehicle_inspection_items_unique_key'),
       ''

union all
select '16 · inspection downtime link is ON DELETE SET NULL',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_inspections'::regclass
           and contype = 'f' and confdeltype = 'n'
           and pg_get_constraintdef(oid) ilike '%vehicle_blocks%'
       ),
       'Releasing a block must never cascade away inspection history'

union all
select '17 · vehicle_blocks accepts inspection AND every prior type',
       (
         select bool_and(pg_get_constraintdef(oid) ilike '%' || t || '%')
         from pg_constraint,
              unnest(array['maintenance','internal','preparing','cleaning',
                           'incident','stop_sell','inspection']) as t
         where conname = 'vehicle_blocks_type_check'
       ),
       'Strict widening — no existing block row can be invalidated'

union all
select '18 · maintenance source_inspection_id exists',
       exists (
         select 1 from information_schema.columns
         where table_name = 'vehicle_maintenance_records'
           and column_name = 'source_inspection_id'
       ),
       ''

union all
select '19 · maintenance link is ON DELETE SET NULL, not CASCADE',
       exists (
         select 1 from pg_constraint
         where conrelid = 'vehicle_maintenance_records'::regclass
           and contype = 'f' and confdeltype = 'n'
           and pg_get_constraintdef(oid) ilike '%vehicle_inspections%'
       ),
       'Deleting an inspection must never delete real maintenance history'

union all
select '20 · maintenance link is NOT unique — one inspection, many jobs',
       not exists (
         select 1 from pg_indexes
         where tablename = 'vehicle_maintenance_records'
           and indexdef ilike '%unique%'
           and indexdef ilike '%source_inspection_id%'
       ),
       'A tyre job and an electrical job may both come from one inspection'

union all
select '21 · the three inspection permissions exist',
       (
         select count(*) = 3 from permissions
         where key in ('view_inspections', 'manage_inspections', 'approve_inspections')
       ),
       ''

union all
select '22 · permissions granted to exactly the three fleet roles',
       (
         select count(*) = 9
         from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where p.key in ('view_inspections', 'manage_inspections', 'approve_inspections')
           and r.key in ('super_admin', 'administrator', 'fleet_manager')
       ),
       'super_admin, administrator, fleet_manager'

union all
select '23 · no other role holds approve_inspections',
       not exists (
         select 1
         from role_permissions rp
         join roles r on r.id = rp.role_id
         join permissions p on p.id = rp.permission_id
         where p.key = 'approve_inspections'
           and r.key not in ('super_admin', 'administrator', 'fleet_manager')
       ),
       'Sign-off must not leak to a lower operational role'

union all
select '24 · RLS enabled on all three inspection tables',
       (
         select count(*) = 3 from pg_class
         where relname in ('vehicle_inspections', 'vehicle_inspection_items',
                           'vehicle_inspection_attachments')
           and relrowsecurity
       ),
       ''

union all
select '25 · inspection-documents bucket exists and is private',
       exists (select 1 from storage.buckets where id = 'inspection-documents' and public = false),
       'Signed URLs only'

union all
select '26 · required indexes exist',
       (
         select count(*) = 8 from pg_indexes
         where indexname in (
           'vehicle_inspections_vehicle_week_idx',
           'vehicle_inspections_week_ending_idx',
           'vehicle_inspections_result_idx',
           'vehicle_inspections_unapproved_idx',
           'vehicle_inspections_block_id_idx',
           'vehicle_inspection_items_inspection_id_idx',
           'vehicle_inspection_items_key_result_idx',
           'vehicle_inspection_attachments_inspection_id_idx'
         )
       ),
       ''

union all
select '27 · no inspection row was created by the migration',
       (select count(*) = 0 from vehicle_inspections),
       'Purely structural — 0034 seeds no data'

order by check_name;
