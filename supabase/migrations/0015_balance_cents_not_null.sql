-- balance_cents is generated always as (total_cents - paid_cents), and both
-- of those are `integer not null`, so it can never actually be null — but
-- Postgres doesn't infer NOT NULL for generated columns automatically. Declare
-- it explicitly so application code doesn't have to handle an impossible case.
alter table bookings alter column balance_cents set not null;
