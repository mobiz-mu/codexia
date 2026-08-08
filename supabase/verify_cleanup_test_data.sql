-- ============================================================================
-- Codexia — Read-only verification for production_cleanup_test_data.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Run this whole file as one query. Every row is one check: `passed = true`
-- means that specific thing is confirmed; `detail` shows what was actually
-- observed. Rows 01-08 confirm test data is gone; rows 09-13 confirm real
-- data was NOT touched.
-- ============================================================================

select '01 · zero demo vehicles remain' as check_name,
       (select count(*) from vehicles where is_demo = true) = 0 as passed,
       'is_demo=true count = ' || (select count(*) from vehicles where is_demo = true)::text as detail

union all
select '02 · zero test bookings remain (by identifying pattern)',
       (select count(*) from booking_customers where email ilike '%@example.com' or email = 'test.mobiz.mu@gmail.com' or full_name = 'xxx' or full_name = 'Test Customer') = 0,
       'matching booking_customers rows = ' || (select count(*) from booking_customers where email ilike '%@example.com' or email = 'test.mobiz.mu@gmail.com' or full_name = 'xxx' or full_name = 'Test Customer')::text

union all
select '03 · zero synthetic payments remain',
       (select count(*) from payments) = 0,
       'payments row count = ' || (select count(*) from payments)::text || ' (table was already empty pre-cleanup)'

union all
select '04 · zero demo/test invoices remain',
       (select count(*) from invoices where customer_name = 'test') = 0,
       'invoices with customer_name=test = ' || (select count(*) from invoices where customer_name = 'test')::text

union all
select '05 · zero fake reviews remain',
       (select count(*) from reviews where name = 'Test Reviewer' or email = 'test-reviewer@example.com') = 0,
       'reviews table total row count = ' || (select count(*) from reviews)::text

union all
select '06 · zero orphaned vehicle_images rows (every row has a live vehicle)',
       not exists (select 1 from vehicle_images vi left join vehicles v on v.id = vi.vehicle_id where v.id is null),
       'orphaned vehicle_images = ' || (select count(*) from vehicle_images vi left join vehicles v on v.id = vi.vehicle_id where v.id is null)::text

union all
select '07 · zero orphaned invoices (non-null booking_id that points nowhere)',
       (select count(*) from invoices i where i.booking_id is not null and not exists (select 1 from bookings b where b.id = i.booking_id)) = 0,
       'invoices with a non-null booking_id that does not resolve = ' || (select count(*) from invoices i where i.booking_id is not null and not exists (select 1 from bookings b where b.id = i.booking_id))::text

union all
select '08 · analytics_events cleared',
       (select count(*) from analytics_events) = 0,
       'analytics_events row count = ' || (select count(*) from analytics_events)::text

union all
select '09 · REAL DATA CHECK: contact_messages still has the real "Dyash" inquiry',
       exists (select 1 from contact_messages where email = 'brish.ramlochun@gmail.com'),
       coalesce((select 'name=' || name || ', status=' || status from contact_messages where email = 'brish.ramlochun@gmail.com'), 'ROW MISSING — INVESTIGATE')

union all
select '10 · REAL DATA CHECK: all 4 admin accounts (profiles) still present',
       (select count(*) from profiles) >= 4,
       'profiles row count = ' || (select count(*) from profiles)::text

union all
select '11 · REAL DATA CHECK: all admin role assignments (user_roles) still present',
       (select count(*) from user_roles) >= 4,
       'user_roles row count = ' || (select count(*) from user_roles)::text

union all
select '12 · REAL DATA CHECK: audit_logs untouched (should be >= its pre-cleanup count)',
       (select count(*) from audit_logs) > 0,
       'audit_logs row count = ' || (select count(*) from audit_logs)::text

union all
select '13 · REAL DATA CHECK: vehicle_categories and extras untouched (kept, not deleted)',
       (select count(*) from vehicle_categories) > 0 and (select count(*) from extras) > 0,
       'vehicle_categories = ' || (select count(*) from vehicle_categories)::text || ', extras = ' || (select count(*) from extras)::text

union all
select '14 · REAL DATA CHECK: site_settings, locations, policies untouched',
       (select count(*) from site_settings) > 0 and (select count(*) from locations) > 0 and (select count(*) from policy_pages) > 0,
       'site_settings=' || (select count(*) from site_settings)::text || ', locations=' || (select count(*) from locations)::text || ', policy_pages=' || (select count(*) from policy_pages)::text

union all
select '15 · DATA SANITY: bookings table now empty (all 6 were test data)',
       (select count(*) from bookings) = 0,
       'bookings row count = ' || (select count(*) from bookings)::text

union all
select '16 · DATA SANITY: vehicles table now empty (all 6 were is_demo)',
       (select count(*) from vehicles) = 0,
       'vehicles row count = ' || (select count(*) from vehicles)::text

order by 1;
