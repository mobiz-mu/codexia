-- Server-side PayPal verification: track the PayPal capture id separately
-- from the order id (they are different identifiers), persist the exchange
-- rate actually applied to each payment for auditing, widen payment status
-- to cover the full PayPal capture lifecycle, and add a webhook_events table
-- so webhook deliveries can be deduped and verified independently of the
-- direct capture flow.

alter table payment_transactions
  add column capture_id text unique,
  add column exchange_rate numeric;

alter table payment_transactions
  drop constraint payment_transactions_status_check,
  add constraint payment_transactions_status_check
    check (status in ('created', 'pending', 'succeeded', 'failed', 'denied', 'cancelled', 'refunded', 'reversed', 'disputed'));

alter table payment_transactions
  alter column provider set default 'paypal';

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index webhook_events_provider_idx on webhook_events (provider);

alter table webhook_events enable row level security;

create policy webhook_events_staff_select on webhook_events
  for select using (has_permission(auth.uid(), 'manage_payments'));
