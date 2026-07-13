create table extras (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_fr text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR',
  pricing_mode text not null default 'per_day' check (pricing_mode in ('per_day', 'flat')),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger extras_set_updated_at
  before update on extras
  for each row execute function set_updated_at();

create sequence booking_reference_seq;

create or replace function generate_booking_reference()
returns text
language sql
as $$
  select 'CDX-' || to_char(now(), 'YYYY') || '-' ||
    lpad((nextval('booking_reference_seq') % 100000)::text, 5, '0') ||
    upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
$$;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default generate_booking_reference(),
  vehicle_id uuid references vehicles (id),
  category_id uuid not null references vehicle_categories (id),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  pickup_location_id uuid not null references locations (id),
  dropoff_location_id uuid not null references locations (id),
  status text not null default 'draft' check (
    status in (
      'draft', 'pending', 'awaiting_payment', 'payment_proof_submitted',
      'payment_under_review', 'confirmed', 'partially_paid', 'paid',
      'vehicle_assigned', 'ready_for_pickup', 'active', 'completed',
      'cancelled', 'no_show', 'refunded', 'rejected'
    )
  ),
  pricing jsonb not null default '{}'::jsonb,
  total_cents integer not null default 0,
  paid_cents integer not null default 0,
  balance_cents integer generated always as (total_cents - paid_cents) stored,
  passengers integer not null default 1,
  flight_number text,
  flight_airport text,
  flight_airline text,
  flight_arrival_date date,
  flight_arrival_time time,
  special_requests text,
  policy_acceptance jsonb not null default '{}'::jsonb,
  accepted_at timestamptz,
  accepted_ip inet,
  accepted_user_agent text,
  google_event_id text,
  access_token_hash text unique,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (return_at > pickup_at),
  exclude using gist (
    vehicle_id with =,
    tstzrange(pickup_at, return_at) with &&
  ) where (
    status in ('confirmed', 'partially_paid', 'paid', 'vehicle_assigned', 'ready_for_pickup', 'active')
  )
);

create index bookings_vehicle_id_idx on bookings (vehicle_id);
create index bookings_category_id_idx on bookings (category_id);
create index bookings_status_idx on bookings (status);
create index bookings_pickup_at_idx on bookings (pickup_at);
create index bookings_return_at_idx on bookings (return_at);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

create table booking_customers (
  booking_id uuid primary key references bookings (id) on delete cascade,
  full_name text not null,
  email citext not null,
  phone text not null,
  whatsapp text,
  country text not null,
  address text,
  created_at timestamptz not null default now()
);

create index booking_customers_email_idx on booking_customers (email);

create table booking_drivers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  is_primary boolean not null default true,
  full_name text not null,
  age integer not null check (age >= 18),
  licence_country text not null,
  licence_issue_date date not null,
  created_at timestamptz not null default now()
);

create index booking_drivers_booking_id_idx on booking_drivers (booking_id);

create table booking_extras (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  extra_id uuid not null references extras (id),
  quantity integer not null default 1 check (quantity >= 1),
  unit_price_cents integer not null,
  pricing_mode text not null,
  created_at timestamptz not null default now()
);

create index booking_extras_booking_id_idx on booking_extras (booking_id);

create table booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  old_status text,
  new_status text not null,
  actor_id uuid references profiles (id),
  internal_note text,
  customer_note text,
  at timestamptz not null default now()
);

create index booking_status_history_booking_id_idx on booking_status_history (booking_id);
