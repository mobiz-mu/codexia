-- ============================================================================
-- Codexia — Read-only verification for production_upgrade_0025.sql.
-- Nothing in this file writes, deletes, or modifies anything.
-- ============================================================================

select '01 · deposit_threshold_eur_cents still present (untouched, from 0024)' as check_name,
       exists (select 1 from site_settings where key = 'deposit_threshold_eur_cents') as passed,
       coalesce((select 'value=' || value::text from site_settings where key = 'deposit_threshold_eur_cents'), 'ROW MISSING') as detail

union all
select '02 · deposit_mid_tier_max_eur_cents exists',
       exists (select 1 from site_settings where key = 'deposit_mid_tier_max_eur_cents'),
       coalesce((select 'value=' || value::text from site_settings where key = 'deposit_mid_tier_max_eur_cents'), 'ROW MISSING')

union all
select '03 · deposit_mid_tier_amount_eur_cents exists',
       exists (select 1 from site_settings where key = 'deposit_mid_tier_amount_eur_cents'),
       coalesce((select 'value=' || value::text from site_settings where key = 'deposit_mid_tier_amount_eur_cents'), 'ROW MISSING')

union all
select '04 · deposit_high_tier_amount_eur_cents exists',
       exists (select 1 from site_settings where key = 'deposit_high_tier_amount_eur_cents'),
       coalesce((select 'value=' || value::text from site_settings where key = 'deposit_high_tier_amount_eur_cents'), 'ROW MISSING')

union all
select '05 · deposit_amount_eur_cents relabeled as legacy (value untouched)',
       coalesce((select description from site_settings where key = 'deposit_amount_eur_cents'), '') ilike 'LEGACY%',
       coalesce((select 'value=' || value::text || ' | description=' || description from site_settings where key = 'deposit_amount_eur_cents'), 'ROW MISSING')

union all
select '06 · site_settings row count did not shrink (nothing deleted)',
       (select count(*) from site_settings) >= 28,
       'site_settings row count = ' || (select count(*) from site_settings)::text

order by 1;
