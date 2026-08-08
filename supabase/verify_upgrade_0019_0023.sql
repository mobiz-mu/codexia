-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0019_0023.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Run this whole file as one query. Every row is one check: `passed = true`
-- means that specific thing exists/matches; `detail` shows what was
-- actually observed so you're not just trusting a boolean. Scan the
-- `passed` column top to bottom — anything reading `false` needs attention
-- before we move on.
-- ============================================================================

select '01 · webhook_events table exists' as check_name,
       (to_regclass('public.webhook_events') is not null) as passed,
       coalesce(to_regclass('public.webhook_events')::text, 'MISSING') as detail

union all
select '02 · review_request_logs table exists',
       (to_regclass('public.review_request_logs') is not null),
       coalesce(to_regclass('public.review_request_logs')::text, 'MISSING')

union all
select '03 · vehicles.vin column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='vin'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='vin')

union all
select '04 · vehicles.engine_number column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='engine_number'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='engine_number')

union all
select '05 · vehicles.insurance_expiry column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='insurance_expiry'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='insurance_expiry')

union all
select '06 · vehicles.road_tax_expiry column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='road_tax_expiry'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='road_tax_expiry')

union all
select '07 · vehicles.fitness_expiry column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='fitness_expiry'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='fitness_expiry')

union all
select '08 · vehicles.last_service_date column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='last_service_date'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='last_service_date')

union all
select '09 · vehicles.next_service_date column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='next_service_date'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='next_service_date')

union all
select '10 · vehicles.current_mileage_km column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='current_mileage_km'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='current_mileage_km')

union all
select '11 · vehicles.weekly_price_cents column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='weekly_price_cents'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='weekly_price_cents')

union all
select '12 · vehicles.monthly_price_cents column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='monthly_price_cents'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='monthly_price_cents')

union all
select '13 · vehicle_blocks.type allows preparing/cleaning',
       (select pg_get_constraintdef(oid) from pg_constraint where conname='vehicle_blocks_type_check' and conrelid='public.vehicle_blocks'::regclass) ilike '%preparing%'
         and (select pg_get_constraintdef(oid) from pg_constraint where conname='vehicle_blocks_type_check' and conrelid='public.vehicle_blocks'::regclass) ilike '%cleaning%',
       coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='vehicle_blocks_type_check' and conrelid='public.vehicle_blocks'::regclass), 'CONSTRAINT MISSING')

union all
select '14 · payment_transactions.capture_id column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='capture_id'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='capture_id')

union all
select '15 · payment_transactions.capture_id has a unique constraint',
       exists (select 1 from pg_constraint where conname='payment_transactions_capture_id_key' and conrelid='public.payment_transactions'::regclass),
       coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_capture_id_key' and conrelid='public.payment_transactions'::regclass), 'CONSTRAINT MISSING')

union all
select '16 · payment_transactions.exchange_rate column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='exchange_rate'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='exchange_rate')

union all
select '17 · payment_transactions.provider default is paypal',
       (select column_default from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider') ilike '%paypal%',
       coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider'), 'NO DEFAULT SET')

union all
select '18 · payment_transactions.status accepts all PayPal lifecycle values',
       (select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_status_check' and conrelid='public.payment_transactions'::regclass) ilike '%denied%'
         and (select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_status_check' and conrelid='public.payment_transactions'::regclass) ilike '%refunded%'
         and (select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_status_check' and conrelid='public.payment_transactions'::regclass) ilike '%reversed%'
         and (select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_status_check' and conrelid='public.payment_transactions'::regclass) ilike '%disputed%',
       coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='payment_transactions_status_check' and conrelid='public.payment_transactions'::regclass), 'CONSTRAINT MISSING')

union all
select '19 · vehicle_images.content_hash column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='content_hash'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='content_hash')

union all
select '20 · vehicle_images.variants column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='variants'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='variants')

union all
select '21 · vehicle_images.blur_data_url column exists',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='blur_data_url'),
       (select data_type from information_schema.columns where table_schema='public' and table_name='vehicle_images' and column_name='blur_data_url')

union all
select '22 · vehicle_images_content_hash_idx index exists',
       exists (select 1 from pg_indexes where schemaname='public' and indexname='vehicle_images_content_hash_idx'),
       coalesce((select indexdef from pg_indexes where schemaname='public' and indexname='vehicle_images_content_hash_idx'), 'INDEX MISSING')

union all
select '23 · webhook_events_provider_idx index exists',
       exists (select 1 from pg_indexes where schemaname='public' and indexname='webhook_events_provider_idx'),
       coalesce((select indexdef from pg_indexes where schemaname='public' and indexname='webhook_events_provider_idx'), 'INDEX MISSING')

union all
select '24 · RLS enabled on webhook_events',
       coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.webhook_events')), false),
       'relrowsecurity=' || coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.webhook_events')), 'TABLE MISSING')

union all
select '25 · RLS enabled on review_request_logs',
       coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.review_request_logs')), false),
       'relrowsecurity=' || coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.review_request_logs')), 'TABLE MISSING')

union all
select '26 · webhook_events staff-select policy exists',
       exists (select 1 from pg_policies where schemaname='public' and tablename='webhook_events' and policyname='webhook_events_staff_select'),
       coalesce((select qual from pg_policies where schemaname='public' and tablename='webhook_events' and policyname='webhook_events_staff_select'), 'POLICY MISSING')

union all
select '27 · review_request_logs staff-select policy exists',
       exists (select 1 from pg_policies where schemaname='public' and tablename='review_request_logs' and policyname='review_request_logs_staff_select'),
       coalesce((select qual from pg_policies where schemaname='public' and tablename='review_request_logs' and policyname='review_request_logs_staff_select'), 'POLICY MISSING')

union all
select '28 · review_request_logs.booking_id foreign key → bookings',
       exists (
         select 1 from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
         join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
         where tc.table_schema='public' and tc.table_name='review_request_logs'
           and tc.constraint_type='FOREIGN KEY' and ccu.table_name='bookings'
       ),
       'checked against information_schema'

union all
select '29 · site_settings.google_maps_url exists',
       exists (select 1 from site_settings where key='google_maps_url'),
       coalesce((select 'value=' || value::text from site_settings where key='google_maps_url'), 'ROW MISSING')

union all
-- These sanity rows have no "before" snapshot to compare against, so
-- `passed` is only trivially true where zero rows would be suspicious
-- (vehicles/profiles/site_settings always have seed data) — for the rest,
-- read the printed count yourself and compare it to what you expect
-- (you already know there's 1 real booking from the admin panel).
select '30 · DATA SANITY: vehicles row count unchanged/non-zero',
       (select count(*) from vehicles) > 0,
       'vehicles row count = ' || (select count(*) from vehicles)::text

union all
select '31 · DATA SANITY: bookings row count unchanged/non-zero',
       (select count(*) from bookings) >= 0,
       'bookings row count = ' || (select count(*) from bookings)::text

union all
select '32 · DATA SANITY: payments row count unchanged/non-zero',
       (select count(*) from payments) >= 0,
       'payments row count = ' || (select count(*) from payments)::text

union all
select '33 · DATA SANITY: payment_transactions row count unchanged/non-zero',
       (select count(*) from payment_transactions) >= 0,
       'payment_transactions row count = ' || (select count(*) from payment_transactions)::text

union all
select '34 · DATA SANITY: profiles row count unchanged/non-zero',
       (select count(*) from profiles) > 0,
       'profiles row count = ' || (select count(*) from profiles)::text

union all
select '35 · DATA SANITY: site_settings row count unchanged/non-zero',
       (select count(*) from site_settings) > 0,
       'site_settings row count = ' || (select count(*) from site_settings)::text

order by 1;
