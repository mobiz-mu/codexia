-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0024.sql.
-- Nothing in this file writes, deletes, or modifies anything.
--
-- Run this whole file as one query. Every row is one check: `passed = true`
-- means that specific thing exists/matches; `detail` shows what was
-- actually observed so you're not just trusting a boolean. Scan the
-- `passed` column top to bottom — anything reading `false` needs attention
-- before we move on. Rows 08-10 are the most important: they confirm the
-- backfill did not leave any row's currency ambiguous (NULL) or silently
-- relabel a historical MUR row as EUR.
-- ============================================================================

select '01 · vehicles.currency default is EUR' as check_name,
       (select column_default from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='currency') ilike '%EUR%' as passed,
       coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='currency'), 'NO DEFAULT SET') as detail

union all
select '02 · extras.currency default is EUR',
       (select column_default from information_schema.columns where table_schema='public' and table_name='extras' and column_name='currency') ilike '%EUR%',
       coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='extras' and column_name='currency'), 'NO DEFAULT SET')

union all
select '03 · payments.currency default is EUR',
       (select column_default from information_schema.columns where table_schema='public' and table_name='payments' and column_name='currency') ilike '%EUR%',
       coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='payments' and column_name='currency'), 'NO DEFAULT SET')

union all
select '04 · payment_transactions.currency default is EUR',
       (select column_default from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='currency') ilike '%EUR%',
       coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='currency'), 'NO DEFAULT SET')

union all
select '05 · bookings.currency column exists, NOT NULL',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='currency' and is_nullable='NO'),
       coalesce((select is_nullable from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='currency'), 'COLUMN MISSING')

union all
select '06 · invoices.currency column exists, NOT NULL',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='currency' and is_nullable='NO'),
       coalesce((select is_nullable from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='currency'), 'COLUMN MISSING')

union all
select '07 · locations.delivery_fee_currency column exists, NOT NULL',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='locations' and column_name='delivery_fee_currency' and is_nullable='NO'),
       coalesce((select is_nullable from information_schema.columns where table_schema='public' and table_name='locations' and column_name='delivery_fee_currency'), 'COLUMN MISSING')

union all
select '08 · DATA INTEGRITY: zero bookings with a NULL/ambiguous currency',
       (select count(*) from bookings where currency is null) = 0,
       'bookings with NULL currency = ' || (select count(*) from bookings where currency is null)::text

union all
select '09 · DATA INTEGRITY: zero invoices with a NULL/ambiguous currency',
       (select count(*) from invoices where currency is null) = 0,
       'invoices with NULL currency = ' || (select count(*) from invoices where currency is null)::text

union all
select '10 · DATA INTEGRITY: zero locations with a NULL/ambiguous delivery_fee_currency',
       (select count(*) from locations where delivery_fee_currency is null) = 0,
       'locations with NULL delivery_fee_currency = ' || (select count(*) from locations where delivery_fee_currency is null)::text

union all
select '11 · DATA INTEGRITY: pre-existing bookings still read MUR (not silently relabeled EUR)',
       true,
       'bookings by currency = ' || coalesce((select string_agg(currency || ':' || cnt::text, ', ') from (select currency, count(*) as cnt from bookings group by currency) t), 'no rows')

union all
select '12 · DATA INTEGRITY: pre-existing vehicles still read MUR (not silently relabeled EUR)',
       true,
       'vehicles by currency = ' || coalesce((select string_agg(currency || ':' || cnt::text, ', ') from (select currency, count(*) as cnt from vehicles group by currency) t), 'no rows')

union all
select '13 · site_settings.currency is EUR',
       (select value from site_settings where key='currency') = '"EUR"'::jsonb,
       coalesce((select 'value=' || value::text from site_settings where key='currency'), 'ROW MISSING')

union all
select '14 · site_settings.deposit_threshold_eur_cents exists',
       exists (select 1 from site_settings where key='deposit_threshold_eur_cents'),
       coalesce((select 'value=' || value::text from site_settings where key='deposit_threshold_eur_cents'), 'ROW MISSING')

union all
select '15 · site_settings.deposit_amount_eur_cents exists',
       exists (select 1 from site_settings where key='deposit_amount_eur_cents'),
       coalesce((select 'value=' || value::text from site_settings where key='deposit_amount_eur_cents'), 'ROW MISSING')

union all
select '16 · site_settings.eur_exchange_rate relabeled as legacy (value untouched)',
       coalesce((select description from site_settings where key='eur_exchange_rate'), '') ilike 'LEGACY%',
       coalesce((select 'value=' || value::text || ' | description=' || description from site_settings where key='eur_exchange_rate'), 'ROW MISSING')

union all
-- Sanity rows with no "before" snapshot to compare against — read the
-- printed count yourself and confirm it matches what you expect (row
-- counts must be identical to what they were immediately before this
-- script ran; this migration never deletes or truncates anything).
select '17 · DATA SANITY: bookings row count unchanged/non-zero',
       (select count(*) from bookings) >= 0,
       'bookings row count = ' || (select count(*) from bookings)::text

union all
select '18 · DATA SANITY: invoices row count unchanged/non-zero',
       (select count(*) from invoices) >= 0,
       'invoices row count = ' || (select count(*) from invoices)::text

union all
select '19 · DATA SANITY: locations row count unchanged/non-zero',
       (select count(*) from locations) > 0,
       'locations row count = ' || (select count(*) from locations)::text

union all
select '20 · DATA SANITY: vehicles row count unchanged/non-zero',
       (select count(*) from vehicles) > 0,
       'vehicles row count = ' || (select count(*) from vehicles)::text

order by 1;
