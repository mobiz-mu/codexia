-- The view was originally created with security_invoker = true, which made it
-- return zero rows for anon/authenticated visitors: those roles have no RLS
-- SELECT policy on the base `reviews` table (only staff do), and a
-- security_invoker view enforces the invoking role's RLS on the underlying
-- table before its own WHERE clause is even applied. Recreate it as a
-- security-definer view (the default), which is the standard pattern for a
-- public, column-limited view over an RLS-protected table.
drop view if exists public_reviews;

create view public_reviews as
  select id, target_type, target_id, name, country, rating, body, admin_reply, featured, created_at
  from reviews
  where status = 'approved';

grant select on public_reviews to anon, authenticated;
