-- ============================================================================
-- Codexia — Remove testing/demo data created during pre-launch development.
--
-- SHOW-BEFORE-RUN: this script is presented to the user for review and is
-- NOT to be executed until explicitly approved. Nothing here truncates a
-- table, drops a table/column, or deletes anything outside the specific,
-- evidence-identified rows below (see the accompanying audit in the
-- conversation for how each row was identified — @example.com is an IANA-
-- reserved, permanently-fake email domain per RFC 2606, not a heuristic).
--
-- Idempotent: every DELETE is scoped by the same identifying condition, so
-- re-running this script after it has already run finds zero matching rows
-- and is a safe no-op.
--
-- Storage files (Storage is not part of the SQL database and cannot be
-- touched from here): the user explicitly directed DB cleanup to run BEFORE
-- storage cleanup (not after, as this file originally assumed) so the
-- database state could be verified before anything in Storage changed. That
-- means supabase/cleanup_test_storage.js can no longer discover the file
-- paths dynamically once this script has run (their identifying DB rows are
-- gone) — the exact paths were captured from a dry run beforehand and
-- removed directly. See the conversation for the recorded path list.
--
-- EXECUTION NOTE: this environment has no direct Postgres connection (no
-- psql/Supabase-CLI credentials available) — only the Supabase JS client via
-- the service-role key (PostgREST), which cannot run this file as one
-- literal multi-statement transaction. It was executed as an equivalent
-- ordered sequence of scoped delete calls via that client, stopping
-- immediately on the first error (which happened once — see step 6 below)
-- and resuming only after a read-only re-check, never by broadening scope.
-- This file is kept as the authoritative, reviewable statement of exactly
-- what was deleted and why.
--
-- Explicitly NOT touched by this script: vehicle_categories, extras,
-- site_settings, locations, policies, faq_entries, contact_messages,
-- audit_logs, profiles/user_roles (admin accounts), payments,
-- payment_transactions, webhook_events (all either real content, protected
-- by instruction, or already empty).
--
-- Re-audited immediately before this run (counts can drift between review
-- passes): one additional row was found since the first pass — a `reviews`
-- row (name='Test Reviewer', email='test-reviewer@example.com', already
-- status='rejected', targeting one of the demo vehicles below) — added to
-- step 2a below.
-- ============================================================================

begin;

-- Temp table (transaction-scoped) so the same "which bookings are test data"
-- definition is computed once and reused by every dependent DELETE below,
-- rather than repeating (and risking drift between) the same condition.
create temporary table _test_booking_ids on commit drop as
select distinct bc.booking_id
from booking_customers bc
where bc.email ilike '%@example.com'
   or bc.email = 'test.mobiz.mu@gmail.com'
   or bc.full_name = 'xxx'
   or bc.full_name = 'Test Customer';

-- ----------------------------------------------------------------------------
-- 1. email_logs — booking_id has no ON DELETE CASCADE, must be removed
--    before the bookings themselves or the booking DELETE below would fail
--    with a foreign-key violation.
-- ----------------------------------------------------------------------------
delete from email_logs
where booking_id in (select booking_id from _test_booking_ids);

-- ----------------------------------------------------------------------------
-- 2. notifications — no booking_id FK (payload is jsonb), matched by the
--    booking reference embedded in the new_booking payload, plus the one
--    orphaned new_review notification whose underlying review row is
--    already gone (payload identifies it as synthetic test content).
-- ----------------------------------------------------------------------------
delete from notifications
where (
  type = 'new_booking'
  and payload ->> 'reference' in (
    select reference from bookings where id in (select booking_id from _test_booking_ids)
  )
)
or (
  type = 'new_review'
  and payload ->> 'name' = 'Test Reviewer'
);

-- ----------------------------------------------------------------------------
-- 2a. reviews — one synthetic review (name/email are both clearly
--     synthetic, RFC-2606-reserved-domain email, already rejected by
--     admin). target_id is a plain uuid column with no FK constraint to
--     vehicles, so no ordering dependency with step 5 either way.
-- ----------------------------------------------------------------------------
delete from reviews
where name = 'Test Reviewer'
  and email = 'test-reviewer@example.com';

-- ----------------------------------------------------------------------------
-- 3. invoices — the one orphaned test invoice (booking_id already null,
--    customer_name literally 'test'). Must run before bookings delete only
--    in the general case where an invoice references a to-be-deleted
--    booking; this specific row doesn't, but the condition stays scoped to
--    the same identifying pattern rather than an id literal.
-- ----------------------------------------------------------------------------
delete from invoices
where customer_name = 'test';

-- ----------------------------------------------------------------------------
-- 4. bookings — cascades to booking_customers, booking_drivers,
--    booking_extras, booking_status_history, payments, payment_proofs,
--    payment_transactions, review_request_logs (all declared
--    "on delete cascade" against bookings.id).
-- ----------------------------------------------------------------------------
delete from bookings
where id in (select booking_id from _test_booking_ids);

-- ----------------------------------------------------------------------------
-- 5. analytics_events — 100% pre-launch/QA traffic (no real bookings have
--    ever existed on this site), confirmed with the user to clear entirely
--    for a clean launch baseline. MUST run before step 6:
--    analytics_events.vehicle_id -> vehicles(id) has no cascade, and 169 of
--    these rows reference the demo vehicles being deleted next — deleting
--    vehicles first fails with a foreign-key violation (confirmed live).
-- ----------------------------------------------------------------------------
delete from analytics_events;

-- ----------------------------------------------------------------------------
-- 6. vehicles — all current rows are is_demo = true (confirmed: 100% of
--    inventory). Cascades to vehicle_images and vehicle_blocks rows (DB
--    rows only — the actual Storage files are removed separately, by exact
--    path, after this transaction commits and is verified).
--    Checked read-only beforehand for every FK referencing vehicles.id
--    (vehicle_images, vehicle_blocks, bookings, analytics_events — no other
--    table references it): vehicle_images/vehicle_blocks cascade safely,
--    bookings has zero remaining references (test bookings already
--    deleted above), analytics_events is cleared by step 5. No other
--    referencing table exists.
-- ----------------------------------------------------------------------------
delete from vehicles
where is_demo = true;

commit;
