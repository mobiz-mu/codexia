create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  method text not null check (method in ('bank_transfer', 'online', 'pay_on_arrival', 'cash')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending', 'recorded', 'refunded')),
  recorded_by uuid references profiles (id),
  note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_id_idx on payments (booking_id);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  bank_name text,
  transaction_ref text,
  payment_date date,
  reviewer_id uuid references profiles (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_proofs_booking_id_idx on payment_proofs (booking_id);
create index payment_proofs_status_idx on payment_proofs (status);

create trigger payment_proofs_set_updated_at
  before update on payment_proofs
  for each row execute function set_updated_at();

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  provider text not null default 'mcb',
  provider_ref text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  webhook_payload jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_booking_id_idx on payment_transactions (booking_id);

create trigger payment_transactions_set_updated_at
  before update on payment_transactions
  for each row execute function set_updated_at();

create table invoice_counters (
  year integer primary key,
  next_number integer not null default 1
);

create or replace function next_invoice_number()
returns text
language plpgsql
as $$
declare
  current_year integer := extract(year from now());
  seq integer;
begin
  insert into invoice_counters (year, next_number)
  values (current_year, 2)
  on conflict (year) do update set next_number = invoice_counters.next_number + 1
  returning next_number - 1 into seq;

  return 'CDX-INV-' || current_year || '-' || lpad(seq::text, 4, '0');
end;
$$;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default next_invoice_number(),
  booking_id uuid references bookings (id),
  customer_name text not null,
  customer_email citext not null,
  customer_address text,
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'partially_paid', 'void')),
  terms text,
  notes text,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  paid_cents integer not null default 0,
  storage_path text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_booking_id_idx on invoices (booking_id);
create index invoices_status_idx on invoices (status);

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price_cents integer not null,
  tax_rate numeric(5, 2) not null default 0,
  discount_cents integer not null default 0,
  line_total_cents integer not null,
  display_order integer not null default 0
);

create index invoice_items_invoice_id_idx on invoice_items (invoice_id);

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  method text not null,
  paid_at timestamptz not null default now(),
  note text,
  recorded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on invoice_payments (invoice_id);
