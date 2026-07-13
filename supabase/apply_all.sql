-- ============================================================================
-- Codexia Ltd — full schema + seed, generated for one-shot paste into the
-- Supabase SQL Editor. Source of truth is supabase/migrations/*.sql + seed.sql;
-- regenerate this file if those change. Wrapped in a transaction so a failure
-- partway through leaves the database untouched instead of half-migrated.
-- ============================================================================

begin;

-- ---- 0001_extensions_and_helpers.sql ----
-- Extensions
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists citext;

-- Generic updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- 0002_rbac.sql ----
-- Profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth user is created
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Roles
create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Permissions
create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- Role <-> Permission
create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_id uuid not null references permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- User <-> Role
create table user_roles (
  user_id uuid not null references profiles (id) on delete cascade,
  role_id uuid not null references roles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles (id),
  primary key (user_id, role_id)
);

create index user_roles_user_id_idx on user_roles (user_id);
create index role_permissions_role_id_idx on role_permissions (role_id);

-- Core authorization check used by every RLS policy and Server Action.
-- security definer + fixed search_path so it can read role_permissions
-- regardless of the calling role's own RLS visibility into those tables.
create or replace function has_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.user_id = uid
      and p.key = perm
  );
$$;

create or replace function is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from user_roles where user_id = uid);
$$;

-- ---- 0003_site_settings.sql ----
create table site_settings (
  key text primary key,
  value jsonb not null,
  value_type text not null default 'string' check (value_type in ('string', 'number', 'boolean', 'json')),
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

create trigger site_settings_set_updated_at
  before update on site_settings
  for each row execute function set_updated_at();

-- ---- 0004_locations.sql ----
create table locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  description_en text,
  description_fr text,
  hero_image_path text,
  delivery_fee_cents integer not null default 0,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  meta_title_en text,
  meta_title_fr text,
  meta_description_en text,
  meta_description_fr text,
  og_image_path text,
  canonical_path text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index locations_active_idx on locations (active) where deleted_at is null;
create index locations_display_order_idx on locations (display_order);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();

-- ---- 0005_vehicles.sql ----
create table vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  description_en text,
  description_fr text,
  image_path text,
  icon text,
  display_order integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  meta_title_en text,
  meta_title_fr text,
  meta_description_en text,
  meta_description_fr text,
  og_image_path text,
  canonical_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vehicle_categories_active_idx on vehicle_categories (active) where deleted_at is null;

create trigger vehicle_categories_set_updated_at
  before update on vehicle_categories
  for each row execute function set_updated_at();

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  model text not null,
  year integer not null,
  internal_registration_ref text,
  category_id uuid not null references vehicle_categories (id),
  description_en text,
  description_fr text,
  daily_price_cents integer not null check (daily_price_cents >= 0),
  currency text not null default 'EUR',
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  insurance_excess_cents integer not null default 62500 check (insurance_excess_cents >= 0),
  extra_insurance_daily_cents integer not null default 0 check (extra_insurance_daily_cents >= 0),
  min_rental_days integer not null default 1 check (min_rental_days >= 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  featured boolean not null default false,
  is_demo boolean not null default true,
  passengers integer not null default 5,
  doors integer not null default 4,
  luggage integer not null default 2,
  transmission text not null default 'manual' check (transmission in ('manual', 'automatic')),
  fuel text not null default 'petrol' check (fuel in ('petrol', 'diesel', 'hybrid', 'electric')),
  air_conditioning boolean not null default true,
  engine_size text,
  drive_type text,
  mileage_policy text not null default 'unlimited',
  min_driver_age integer not null default 19,
  bluetooth boolean not null default false,
  usb boolean not null default false,
  gps boolean not null default false,
  child_seat_available boolean not null default false,
  booster_seat_available boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  meta_title_en text,
  meta_title_fr text,
  meta_description_en text,
  meta_description_fr text,
  og_image_path text,
  canonical_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vehicles_category_id_idx on vehicles (category_id);
create index vehicles_status_idx on vehicles (status) where deleted_at is null;
create index vehicles_featured_idx on vehicles (featured) where deleted_at is null;

create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

create table vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  path text not null,
  display_order integer not null default 0,
  is_main boolean not null default false,
  alt_en text,
  alt_fr text,
  created_at timestamptz not null default now()
);

create index vehicle_images_vehicle_id_idx on vehicle_images (vehicle_id);
create unique index vehicle_images_one_main_per_vehicle
  on vehicle_images (vehicle_id)
  where is_main;

create table vehicle_blocks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  period tstzrange not null,
  type text not null check (type in ('maintenance', 'internal')),
  note text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  exclude using gist (vehicle_id with =, period with &&)
);

create index vehicle_blocks_vehicle_id_idx on vehicle_blocks (vehicle_id);

-- ---- 0006_bookings.sql ----
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

-- ---- 0007_payments_invoices.sql ----
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

-- ---- 0008_content_cms.sql ----
create table reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('vehicle', 'post', 'homepage')),
  target_id uuid,
  name text not null,
  country text,
  email citext not null,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  featured boolean not null default false,
  admin_reply text,
  consent boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_target_idx on reviews (target_type, target_id);
create index reviews_status_idx on reviews (status);

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

create table blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  created_at timestamptz not null default now()
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_fr text not null,
  excerpt_en text,
  excerpt_fr text,
  body_en text,
  body_fr text,
  featured_image_path text,
  featured_image_alt_en text,
  featured_image_alt_fr text,
  author_id uuid references profiles (id),
  category_id uuid references blog_categories (id),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  meta_title_en text,
  meta_title_fr text,
  meta_description_en text,
  meta_description_fr text,
  og_image_path text,
  canonical_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index blog_posts_status_idx on blog_posts (status) where deleted_at is null;
create index blog_posts_category_id_idx on blog_posts (category_id);
create index blog_posts_publish_at_idx on blog_posts (publish_at);

create trigger blog_posts_set_updated_at
  before update on blog_posts
  for each row execute function set_updated_at();

create table tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null
);

create table post_tags (
  post_id uuid not null references blog_posts (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create table hero_banners (
  id uuid primary key default gen_random_uuid(),
  desktop_image_path text not null,
  mobile_image_path text,
  heading_en text,
  heading_fr text,
  text_en text,
  text_fr text,
  button_label_en text,
  button_label_fr text,
  button_href text,
  alt_en text,
  alt_fr text,
  overlay_color text default '#1F2937',
  overlay_opacity numeric(3, 2) default 0.30,
  display_order integer not null default 0,
  schedule_start timestamptz,
  schedule_end timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hero_banners_active_idx on hero_banners (active);

create trigger hero_banners_set_updated_at
  before update on hero_banners
  for each row execute function set_updated_at();

create table policy_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_fr text not null,
  created_at timestamptz not null default now()
);

create table policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_page_id uuid not null references policy_pages (id) on delete cascade,
  version integer not null,
  body_en text not null,
  body_fr text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (policy_page_id, version)
);

create index policy_versions_policy_page_id_idx on policy_versions (policy_page_id);

create table policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  policy_page_id uuid not null references policy_pages (id),
  version integer not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text
);

create index policy_acceptances_booking_id_idx on policy_acceptances (booking_id);

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  locale text not null default 'en',
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger newsletter_subscribers_set_updated_at
  before update on newsletter_subscribers
  for each row execute function set_updated_at();

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

create index contact_messages_status_idx on contact_messages (status);

-- ---- 0009_notifications_analytics.sql ----
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  locale text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id),
  unique (key, locale)
);

create trigger email_templates_set_updated_at
  before update on email_templates
  for each row execute function set_updated_at();

create table email_logs (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  to_email citext not null,
  booking_id uuid references bookings (id),
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_logs_booking_id_idx on email_logs (booking_id);
create index email_logs_status_idx on email_logs (status);

create table reminder_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('seven_day', 'tomorrow')),
  sent_at timestamptz not null default now(),
  unique (booking_id, reminder_type)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_read_at_idx on notifications (read_at);
create index notifications_archived_at_idx on notifications (archived_at);
create index notifications_type_idx on notifications (type);

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  path text,
  vehicle_id uuid references vehicles (id),
  session_hash text,
  device text,
  browser text,
  country text,
  locale text,
  referrer text,
  created_at timestamptz not null default now()
);

create index analytics_events_event_idx on analytics_events (event);
create index analytics_events_created_at_idx on analytics_events (created_at);
create index analytics_events_vehicle_id_idx on analytics_events (vehicle_id);

create table calendar_sync_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  action text not null check (action in ('create', 'update', 'delete')),
  status text not null check (status in ('success', 'failed')),
  error text,
  google_event_id text,
  created_at timestamptz not null default now()
);

create index calendar_sync_log_booking_id_idx on calendar_sync_log (booking_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity, entity_id);
create index audit_logs_actor_id_idx on audit_logs (actor_id);

-- ---- 0010_faq.sql ----
create table faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table faq_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references faq_categories (id) on delete cascade,
  question_en text not null,
  question_fr text not null,
  answer_en text not null,
  answer_fr text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faq_entries_category_id_idx on faq_entries (category_id);
create index faq_entries_active_idx on faq_entries (active);

create trigger faq_entries_set_updated_at
  before update on faq_entries
  for each row execute function set_updated_at();

-- ---- 0011_rls.sql ----
-- Enable RLS everywhere. Absence of a policy = deny by default.
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table site_settings enable row level security;
alter table locations enable row level security;
alter table vehicle_categories enable row level security;
alter table vehicles enable row level security;
alter table vehicle_images enable row level security;
alter table vehicle_blocks enable row level security;
alter table extras enable row level security;
alter table bookings enable row level security;
alter table booking_customers enable row level security;
alter table booking_drivers enable row level security;
alter table booking_extras enable row level security;
alter table booking_status_history enable row level security;
alter table payments enable row level security;
alter table payment_proofs enable row level security;
alter table payment_transactions enable row level security;
alter table invoice_counters enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_payments enable row level security;
alter table reviews enable row level security;
alter table blog_categories enable row level security;
alter table blog_posts enable row level security;
alter table tags enable row level security;
alter table post_tags enable row level security;
alter table hero_banners enable row level security;
alter table policy_pages enable row level security;
alter table policy_versions enable row level security;
alter table policy_acceptances enable row level security;
alter table newsletter_subscribers enable row level security;
alter table contact_messages enable row level security;
alter table faq_categories enable row level security;
alter table faq_entries enable row level security;
alter table email_templates enable row level security;
alter table email_logs enable row level security;
alter table reminder_logs enable row level security;
alter table notifications enable row level security;
alter table analytics_events enable row level security;
alter table calendar_sync_log enable row level security;
alter table audit_logs enable row level security;

-- profiles: users manage their own row; manage_users staff manage all
create policy profiles_select_own on profiles
  for select using (id = auth.uid() or has_permission(auth.uid(), 'manage_users'));
create policy profiles_update_own on profiles
  for update using (id = auth.uid() or has_permission(auth.uid(), 'manage_users'));
create policy profiles_staff_all on profiles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));

-- RBAC tables: manage_users only
create policy roles_staff_all on roles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy permissions_staff_all on permissions
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy role_permissions_staff_all on role_permissions
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy user_roles_staff_all on user_roles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));

-- site_settings: publicly readable (business info customers need), writes gated
create policy site_settings_public_select on site_settings
  for select using (true);
create policy site_settings_staff_write on site_settings
  for all using (has_permission(auth.uid(), 'manage_settings'))
  with check (has_permission(auth.uid(), 'manage_settings'));

-- locations
create policy locations_public_select on locations
  for select using (active and deleted_at is null);
create policy locations_staff_all on locations
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- vehicle_categories
create policy vehicle_categories_public_select on vehicle_categories
  for select using (active and deleted_at is null);
create policy vehicle_categories_staff_all on vehicle_categories
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicles
create policy vehicles_public_select on vehicles
  for select using (status = 'active' and deleted_at is null);
create policy vehicles_staff_all on vehicles
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicle_images: visible through their parent vehicle's visibility
create policy vehicle_images_public_select on vehicle_images
  for select using (
    exists (
      select 1 from vehicles v
      where v.id = vehicle_images.vehicle_id
        and v.status = 'active'
        and v.deleted_at is null
    )
  );
create policy vehicle_images_staff_all on vehicle_images
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicle_blocks: staff only, never public
create policy vehicle_blocks_staff_all on vehicle_blocks
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- extras
create policy extras_public_select on extras
  for select using (active);
create policy extras_staff_all on extras
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- bookings + related: no public policies at all, Server Actions use the
-- service-role key exclusively. Staff access only.
create policy bookings_staff_all on bookings
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_customers_staff_all on booking_customers
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_drivers_staff_all on booking_drivers
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_extras_staff_all on booking_extras
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_status_history_staff_all on booking_status_history
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));

-- payments: staff only
create policy payments_staff_all on payments
  for all using (has_permission(auth.uid(), 'manage_payments'))
  with check (has_permission(auth.uid(), 'manage_payments'));
create policy payment_proofs_staff_select on payment_proofs
  for select using (
    has_permission(auth.uid(), 'manage_payments')
    or has_permission(auth.uid(), 'approve_payment_proofs')
  );
create policy payment_proofs_staff_write on payment_proofs
  for update using (has_permission(auth.uid(), 'approve_payment_proofs'))
  with check (has_permission(auth.uid(), 'approve_payment_proofs'));
create policy payment_proofs_staff_delete on payment_proofs
  for delete using (has_permission(auth.uid(), 'manage_payments'));
create policy payment_transactions_staff_all on payment_transactions
  for all using (has_permission(auth.uid(), 'manage_payments'))
  with check (has_permission(auth.uid(), 'manage_payments'));

-- invoices: create_invoices staff only
create policy invoice_counters_staff_all on invoice_counters
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoices_staff_all on invoices
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoice_items_staff_all on invoice_items
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoice_payments_staff_all on invoice_payments
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));

-- reviews: public can submit (status defaults to pending); approved-only
-- publicly selectable via the public_reviews view (keeps email out of reach).
create policy reviews_public_insert on reviews
  for insert with check (status = 'pending');
create policy reviews_staff_all on reviews
  for all using (has_permission(auth.uid(), 'approve_reviews'))
  with check (has_permission(auth.uid(), 'approve_reviews'));

create view public_reviews with (security_invoker = true) as
  select id, target_type, target_id, name, country, rating, body, admin_reply, featured, created_at
  from reviews
  where status = 'approved';

grant select on public_reviews to anon, authenticated;

-- blog
create policy blog_categories_public_select on blog_categories
  for select using (true);
create policy blog_categories_staff_all on blog_categories
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy blog_posts_public_select on blog_posts
  for select using (
    status = 'published'
    and deleted_at is null
    and (publish_at is null or publish_at <= now())
  );
create policy blog_posts_staff_all on blog_posts
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy tags_public_select on tags for select using (true);
create policy tags_staff_all on tags
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy post_tags_public_select on post_tags for select using (true);
create policy post_tags_staff_all on post_tags
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- hero_banners: public sees active + within schedule window
create policy hero_banners_public_select on hero_banners
  for select using (
    active
    and (schedule_start is null or schedule_start <= now())
    and (schedule_end is null or schedule_end >= now())
  );
create policy hero_banners_staff_all on hero_banners
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- policy_pages / policy_versions: fully public read, staff write
create policy policy_pages_public_select on policy_pages for select using (true);
create policy policy_pages_staff_all on policy_pages
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));
create policy policy_versions_public_select on policy_versions for select using (true);
create policy policy_versions_staff_all on policy_versions
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- policy_acceptances: booking-linked audit trail, staff only
create policy policy_acceptances_staff_all on policy_acceptances
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));

-- newsletter: public can subscribe (insert only), staff manage
create policy newsletter_public_insert on newsletter_subscribers
  for insert with check (status = 'subscribed');
create policy newsletter_staff_all on newsletter_subscribers
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- contact_messages: public can submit (insert only), staff manage
create policy contact_messages_public_insert on contact_messages
  for insert with check (status = 'new');
create policy contact_messages_staff_all on contact_messages
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- FAQ
create policy faq_categories_public_select on faq_categories for select using (true);
create policy faq_categories_staff_all on faq_categories
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));
create policy faq_entries_public_select on faq_entries
  for select using (active);
create policy faq_entries_staff_all on faq_entries
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- email_templates: staff only (rendering falls back to shipped defaults
-- in code when no row exists, so no public read is needed)
create policy email_templates_staff_all on email_templates
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- observability tables: staff read via view_analytics, writes are
-- service-role only (no policy needed since inserts happen server-side)
create policy email_logs_staff_select on email_logs
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy reminder_logs_staff_select on reminder_logs
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy calendar_sync_log_staff_select on calendar_sync_log
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy analytics_events_staff_select on analytics_events
  for select using (has_permission(auth.uid(), 'view_analytics'));

-- notifications: visible to any staff member
create policy notifications_staff_select on notifications
  for select using (is_staff(auth.uid()));
create policy notifications_staff_update on notifications
  for update using (is_staff(auth.uid()))
  with check (is_staff(auth.uid()));

-- audit_logs: staff with manage_users oversight only
create policy audit_logs_staff_select on audit_logs
  for select using (has_permission(auth.uid(), 'manage_users'));

-- ---- 0012_storage.sql ----
insert into storage.buckets (id, name, public)
values
  ('vehicle-images', 'vehicle-images', true),
  ('category-images', 'category-images', true),
  ('banners', 'banners', true),
  ('blog', 'blog', true),
  ('company', 'company', true),
  ('payment-proofs', 'payment-proofs', false),
  ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Public buckets: anyone can read, only vehicle/content staff can write
create policy storage_public_buckets_select on storage.objects
  for select using (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
  );

create policy storage_public_buckets_write on storage.objects
  for all using (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
    and (
      has_permission(auth.uid(), 'manage_vehicles')
      or has_permission(auth.uid(), 'manage_content')
    )
  )
  with check (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
    and (
      has_permission(auth.uid(), 'manage_vehicles')
      or has_permission(auth.uid(), 'manage_content')
    )
  );

-- Private buckets: staff only, accessed via server-generated signed URLs
create policy storage_payment_proofs_staff on storage.objects
  for all using (
    bucket_id = 'payment-proofs'
    and (
      has_permission(auth.uid(), 'manage_payments')
      or has_permission(auth.uid(), 'approve_payment_proofs')
    )
  )
  with check (
    bucket_id = 'payment-proofs'
    and (
      has_permission(auth.uid(), 'manage_payments')
      or has_permission(auth.uid(), 'approve_payment_proofs')
    )
  );

create policy storage_invoices_staff on storage.objects
  for all using (
    bucket_id = 'invoices' and has_permission(auth.uid(), 'create_invoices')
  )
  with check (
    bucket_id = 'invoices' and has_permission(auth.uid(), 'create_invoices')
  );

-- ---- seed.sql ----
-- ============================================================================
-- Codexia Ltd — seed data. Vehicles/pricing below are clearly-marked demo
-- content (is_demo = true), not binding specs or prices.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into permissions (key, description) values
  ('manage_bookings', 'View and edit bookings, reassign vehicles, edit extras'),
  ('confirm_bookings', 'Transition bookings to confirmed and other status changes'),
  ('manage_vehicles', 'Manage vehicles, categories, images, availability blocks'),
  ('manage_payments', 'Manage payments and payment transactions'),
  ('approve_payment_proofs', 'Approve or reject uploaded bank transfer proofs'),
  ('create_invoices', 'Create and edit invoices'),
  ('send_invoices', 'Send invoices to customers by email or WhatsApp'),
  ('manage_content', 'Manage locations, extras, blog, banners, policies, FAQ, newsletter, contact messages, email templates'),
  ('approve_reviews', 'Moderate reviews and comments'),
  ('view_analytics', 'View analytics dashboard and system logs'),
  ('manage_users', 'Manage users, roles, and permissions'),
  ('manage_settings', 'Edit site settings')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
insert into roles (key, name, description) values
  ('super_admin', 'Super Admin', 'Full access to every area of the system'),
  ('administrator', 'Administrator', 'Full operational access excluding user/role management'),
  ('booking_manager', 'Booking Manager', 'Manages bookings and confirmations'),
  ('fleet_manager', 'Fleet Manager', 'Manages vehicles, categories, and availability'),
  ('accountant', 'Accountant', 'Manages payments and invoices'),
  ('content_editor', 'Content Editor', 'Manages public-facing content'),
  ('support_agent', 'Support Agent', 'Views bookings and handles customer messages')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.key = 'super_admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'administrator'
  and p.key in (
    'manage_bookings', 'confirm_bookings', 'manage_vehicles', 'manage_payments',
    'approve_payment_proofs', 'create_invoices', 'send_invoices', 'manage_content',
    'approve_reviews', 'view_analytics', 'manage_settings'
  )
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'booking_manager' and p.key in ('manage_bookings', 'confirm_bookings', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'fleet_manager' and p.key in ('manage_vehicles', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'accountant' and p.key in ('manage_payments', 'approve_payment_proofs', 'create_invoices', 'send_invoices', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'content_editor' and p.key in ('manage_content', 'approve_reviews')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'support_agent' and p.key in ('manage_bookings', 'manage_content')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Site settings (mirrors lib/config/site.ts SITE_DEFAULTS)
-- ---------------------------------------------------------------------------
insert into site_settings (key, value, value_type, description) values
  ('company_name', '"Codexia Ltd"', 'string', 'Legal company name'),
  ('domain', '"www.codexia.mu"', 'string', 'Primary domain'),
  ('phone', '"+230 52811999"', 'string', 'Primary phone / WhatsApp number'),
  ('whatsapp_number', '"23052811999"', 'string', 'WhatsApp number, digits only for wa.me links'),
  ('email', '"dyash21@hotmail.com"', 'string', 'Primary contact / reply-to email'),
  ('emergency_phone', '"+230 5253 2101"', 'string', 'Emergency contact number'),
  ('opening_hours', '"24/7 including public holidays"', 'string', 'Opening hours'),
  ('currency', '"EUR"', 'string', 'Default currency'),
  ('tax_rate_percent', '0', 'number', 'Default tax rate percentage'),
  ('insurance_excess_cents', '62500', 'number', 'Standard insurance excess'),
  ('delivery_fee_non_airport_cents', '1500', 'number', 'Non-airport delivery/recovery fee'),
  ('min_driver_age', '19', 'number', 'Minimum driver age'),
  ('max_driver_age', '70', 'number', 'Maximum driver age'),
  ('min_licence_years', '1', 'number', 'Minimum years licence held'),
  ('return_grace_minutes', '60', 'number', 'Grace period for returns'),
  ('invoice_prefix', '"CDX-INV-"', 'string', 'Invoice number prefix'),
  ('booking_reference_prefix', '"CDX-"', 'string', 'Booking reference prefix'),
  ('calendar_behavior_on_cancel', '"annotate"', 'string', 'delete | annotate — what happens to the Google Calendar event on cancellation'),
  ('bank_name', '""', 'string', 'Bank transfer: bank name'),
  ('bank_account_name', '""', 'string', 'Bank transfer: account holder name'),
  ('bank_account_number', '""', 'string', 'Bank transfer: account number'),
  ('bank_swift', '""', 'string', 'Bank transfer: SWIFT/BIC code'),
  ('social_facebook', '""', 'string', 'Facebook URL'),
  ('social_instagram', '""', 'string', 'Instagram URL')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Locations (10 seed locations)
-- ---------------------------------------------------------------------------
insert into locations (slug, name_en, name_fr, delivery_fee_cents, display_order) values
  ('ssr-airport', 'SSR Airport (Plaisance)', 'Aéroport SSR (Plaisance)', 0, 1),
  ('port-louis', 'Port Louis', 'Port Louis', 1500, 2),
  ('grand-baie', 'Grand Baie', 'Grand Baie', 1500, 3),
  ('trou-d-eau-douce', 'Trou d''Eau Douce', 'Trou d''Eau Douce', 1500, 4),
  ('flic-en-flac', 'Flic-en-Flac', 'Flic-en-Flac', 1500, 5),
  ('tamarin', 'Tamarin', 'Tamarin', 1500, 6),
  ('le-morne', 'Le Morne', 'Le Morne', 1500, 7),
  ('bel-ombre', 'Bel Ombre', 'Bel Ombre', 1500, 8),
  ('mahebourg', 'Mahébourg', 'Mahébourg', 1500, 9),
  ('belle-mare', 'Belle Mare', 'Belle Mare', 1500, 10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vehicle categories (demo)
-- ---------------------------------------------------------------------------
insert into vehicle_categories (slug, name_en, name_fr, description_en, description_fr, display_order, active) values
  ('economy', 'Economy', 'Économique', 'Demonstration category — compact, fuel-efficient cars.', 'Catégorie de démonstration — voitures compactes et économiques.', 1, true),
  ('compact', 'Compact', 'Compacte', 'Demonstration category — city-friendly hatchbacks.', 'Catégorie de démonstration — citadines pratiques.', 2, true),
  ('sedan', 'Sedan', 'Berline', 'Demonstration category — comfortable sedans.', 'Catégorie de démonstration — berlines confortables.', 3, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vehicles (demo fleet — pricing is placeholder, non-binding)
-- ---------------------------------------------------------------------------
insert into vehicles (
  slug, name, brand, model, year, category_id, description_en, description_fr,
  daily_price_cents, status, featured, is_demo, passengers, doors, luggage,
  transmission, fuel, air_conditioning
)
select
  v.slug, v.name, v.brand, v.model, v.year, c.id, v.description_en, v.description_fr,
  v.daily_price_cents, 'active', v.featured, true, v.passengers, v.doors, v.luggage,
  v.transmission, v.fuel, true
from (values
  ('suzuki-dzire', 'Suzuki Dzire', 'Suzuki', 'Dzire', 2021, 'sedan', 3500, true, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — a comfortable compact sedan, ideal for small families exploring Mauritius.',
    'Annonce de démonstration — une berline compacte confortable, idéale pour les petites familles explorant Maurice.'),
  ('suzuki-baleno', 'Suzuki Baleno', 'Suzuki', 'Baleno', 2020, 'compact', 3200, false, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — spacious hatchback with a smooth ride for island touring.',
    'Annonce de démonstration — hayon spacieux avec une conduite souple pour explorer l''île.'),
  ('nissan-march', 'Nissan March', 'Nissan', 'March', 2019, 'economy', 2800, false, 5, 4, 1, 'automatic', 'petrol',
    'Demonstration listing — easy-to-drive automatic city car.',
    'Annonce de démonstration — petite citadine automatique facile à conduire.'),
  ('suzuki-celerio', 'Suzuki Celerio', 'Suzuki', 'Celerio', 2022, 'economy', 2900, true, 5, 4, 1, 'automatic', 'petrol',
    'Demonstration listing — Codexia''s most fuel-efficient option, automatic transmission.',
    'Annonce de démonstration — l''option la plus économique de Codexia, boîte automatique.'),
  ('suzuki-swift', 'Suzuki Swift', 'Suzuki', 'Swift', 2021, 'compact', 3300, true, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — agile hatchback, a favourite for coastal road trips.',
    'Annonce de démonstration — hayon agile, un favori pour les road trips côtiers.')
) as v(slug, name, brand, model, year, category_slug, daily_price_cents, featured, passengers, doors, luggage, transmission, fuel, description_en, description_fr)
join vehicle_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Extras
-- ---------------------------------------------------------------------------
insert into extras (name_en, name_fr, price_cents, pricing_mode, display_order) values
  ('Child Seat', 'Siège enfant', 500, 'per_day', 1),
  ('Booster Seat', 'Réhausseur', 400, 'per_day', 2),
  ('GPS Navigation', 'Navigation GPS', 500, 'per_day', 3),
  ('Internet SIM Card', 'Carte SIM Internet', 1000, 'flat', 4),
  ('Extra Insurance (reduced excess)', 'Assurance supplémentaire (franchise réduite)', 1200, 'per_day', 5)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
insert into faq_categories (slug, name_en, name_fr, display_order) values
  ('documents-eligibility', 'Documents & Eligibility', 'Documents et éligibilité', 1),
  ('airport-delivery', 'Airport & Delivery', 'Aéroport et livraison', 2),
  ('insurance-mileage', 'Insurance & Mileage', 'Assurance et kilométrage', 3),
  ('payment-booking', 'Payment & Booking', 'Paiement et réservation', 4),
  ('driving-mauritius', 'Driving in Mauritius', 'Conduire à Maurice', 5)
on conflict (slug) do nothing;

insert into faq_entries (category_id, question_en, question_fr, answer_en, answer_fr, display_order)
select c.id, f.question_en, f.question_fr, f.answer_en, f.answer_fr, f.display_order
from (values
  ('documents-eligibility', 'What documents do I need to rent a car?', 'Quels documents sont nécessaires pour louer une voiture ?',
    'A valid driving licence held for at least 1 year, a valid ID or passport, and a credit/debit card or cash deposit as required.',
    'Un permis de conduire valide détenu depuis au moins 1 an, une pièce d''identité ou un passeport valide, et une carte de crédit/débit ou un dépôt en espèces si requis.', 1),
  ('documents-eligibility', 'What is the minimum and maximum driver age?', 'Quel est l''âge minimum et maximum du conducteur ?',
    'Drivers must be between 19 and 70 years old and have held their licence for at least 1 year.',
    'Les conducteurs doivent avoir entre 19 et 70 ans et détenir leur permis depuis au moins 1 an.', 2),
  ('documents-eligibility', 'Is a second driver allowed?', 'Un second conducteur est-il autorisé ?',
    'Yes — your first additional driver is included free of charge.',
    'Oui — votre premier conducteur supplémentaire est inclus gratuitement.', 3),
  ('documents-eligibility', 'Are child seats available?', 'Des sièges enfants sont-ils disponibles ?',
    'Yes, child and booster seats can be added as extras during booking.',
    'Oui, des sièges enfants et réhausseurs peuvent être ajoutés en extra lors de la réservation.', 4),
  ('airport-delivery', 'Do you offer airport delivery?', 'Proposez-vous la livraison à l''aéroport ?',
    'Yes, airport delivery and recovery at SSR Airport is free of charge.',
    'Oui, la livraison et la récupération à l''aéroport SSR sont gratuites.', 1),
  ('airport-delivery', 'What if my flight is delayed?', 'Que se passe-t-il si mon vol est retardé ?',
    'Provide your flight number when booking — we monitor arrivals and adjust your pickup time accordingly.',
    'Indiquez votre numéro de vol lors de la réservation — nous suivons les arrivées et ajustons l''heure de prise en charge en conséquence.', 2),
  ('airport-delivery', 'How much does non-airport delivery cost?', 'Quel est le coût de la livraison hors aéroport ?',
    'Delivery or recovery outside the airport costs EUR 15.',
    'La livraison ou la récupération hors aéroport coûte 15 EUR.', 3),
  ('airport-delivery', 'Can I get a SIM card with internet?', 'Puis-je obtenir une carte SIM avec internet ?',
    'Yes, a local internet SIM card can be added as an extra.',
    'Oui, une carte SIM locale avec internet peut être ajoutée en extra.', 4),
  ('insurance-mileage', 'Is insurance included?', 'L''assurance est-elle incluse ?',
    'Yes, comprehensive insurance is included with a standard excess of EUR 625. Extra insurance to reduce the excess is available.',
    'Oui, une assurance complète est incluse avec une franchise standard de 625 EUR. Une assurance supplémentaire pour réduire la franchise est disponible.', 1),
  ('insurance-mileage', 'Is mileage unlimited?', 'Le kilométrage est-il illimité ?',
    'Yes, every rental includes unlimited mileage.',
    'Oui, chaque location inclut un kilométrage illimité.', 2),
  ('insurance-mileage', 'What happens in case of an accident?', 'Que se passe-t-il en cas d''accident ?',
    'Contact us immediately via our 24/7 emergency line and follow the instructions in your rental agreement.',
    'Contactez-nous immédiatement via notre ligne d''urgence 24h/24 et suivez les instructions de votre contrat de location.', 3),
  ('payment-booking', 'Can I pay by bank transfer?', 'Puis-je payer par virement bancaire ?',
    'Yes — bank details are provided at checkout, and you upload proof of payment for our team to confirm.',
    'Oui — les coordonnées bancaires sont fournies lors de la commande, et vous téléversez la preuve de paiement pour confirmation par notre équipe.', 1),
  ('payment-booking', 'Can I pay on arrival?', 'Puis-je payer à l''arrivée ?',
    'Yes — choose "Pay on Arrival" at checkout. Your booking is pending until confirmed by Codexia.',
    'Oui — choisissez "Payer à l''arrivée" lors de la commande. Votre réservation est en attente jusqu''à confirmation par Codexia.', 2),
  ('payment-booking', 'What is your cancellation policy?', 'Quelle est votre politique d''annulation ?',
    'See our Cancellation Policy page for full details on notice periods and any applicable charges.',
    'Consultez notre page Politique d''annulation pour tous les détails sur les délais de préavis et les frais éventuels.', 3),
  ('payment-booking', 'What if I return the car late?', 'Que se passe-t-il si je rends la voiture en retard ?',
    'A 60-minute grace period applies. Beyond that, late-return fees may apply as per your rental agreement.',
    'Une période de grâce de 60 minutes s''applique. Au-delà, des frais de retard peuvent s''appliquer selon votre contrat.', 4),
  ('payment-booking', 'Online payment (MCB)?', 'Paiement en ligne (MCB) ?',
    'Online payment via MCB is coming soon. For now, please use bank transfer or pay on arrival.',
    'Le paiement en ligne via MCB arrive bientôt. Pour l''instant, utilisez le virement bancaire ou le paiement à l''arrivée.', 5),
  ('driving-mauritius', 'Which side of the road do you drive on?', 'De quel côté de la route conduit-on ?',
    'Mauritius drives on the left, as in the UK.',
    'À Maurice, on conduit à gauche, comme au Royaume-Uni.', 1),
  ('driving-mauritius', 'Can I drive on unpaved roads?', 'Puis-je conduire sur des routes non pavées ?',
    'No — vehicles are limited to paved public roads only.',
    'Non — les véhicules sont limités aux routes publiques pavées uniquement.', 2),
  ('driving-mauritius', 'Can I extend my rental?', 'Puis-je prolonger ma location ?',
    'Yes, subject to vehicle availability — contact us as early as possible to arrange an extension.',
    'Oui, sous réserve de disponibilité du véhicule — contactez-nous le plus tôt possible pour organiser une prolongation.', 3),
  ('driving-mauritius', 'What is the fuel policy?', 'Quelle est la politique de carburant ?',
    'The vehicle must be returned with the same fuel level as at pickup.',
    'Le véhicule doit être restitué avec le même niveau de carburant qu''au départ.', 4)
) as f(category_slug, question_en, question_fr, answer_en, answer_fr, display_order)
join faq_categories c on c.slug = f.category_slug;

-- ---------------------------------------------------------------------------
-- Policy pages (version 1 seed content)
-- ---------------------------------------------------------------------------
insert into policy_pages (slug, title_en, title_fr) values
  ('general-rental-conditions', 'General Rental Conditions', 'Conditions générales de location'),
  ('privacy', 'Privacy Policy', 'Politique de confidentialité'),
  ('cookie', 'Cookie Policy', 'Politique de cookies'),
  ('cancellation', 'Cancellation Policy', 'Politique d''annulation'),
  ('insurance', 'Insurance Policy', 'Politique d''assurance'),
  ('payment', 'Payment Policy', 'Politique de paiement'),
  ('fuel', 'Fuel Policy', 'Politique de carburant'),
  ('terms-of-use', 'Terms of Use', 'Conditions d''utilisation')
on conflict (slug) do nothing;

insert into policy_versions (policy_page_id, version, body_en, body_fr)
select p.id, 1, v.body_en, v.body_fr
from (values
  ('general-rental-conditions',
   E'## Inclusions\n- Unlimited mileage\n- Comprehensive insurance\n- Local taxes\n- 24h road assistance\n- First additional driver free\n- Free airport delivery/recovery\n\n## Exclusions\n- Fines\n- Fuel\n- Cancellation charges\n- Late-return fees\n- Lost keys/documents\n\n## Delivery & Recovery\nFree at SSR Airport. EUR 15 for non-airport delivery or recovery.\n\n## Documents & Eligibility\nDriver age 19–70, licence held at least 1 year, valid ID/passport.\n\n## Vehicle Group vs Model\nA specific make/model/fuel type may be replaced by a similar or upgraded vehicle depending on availability.\n\n## Additional Drivers\nThe first additional driver is included free of charge; further drivers may incur a fee.\n\n## Amendments & Extensions\nAmendments and extensions are subject to vehicle availability.\n\n## Insurance & Excess\nComprehensive insurance is included with an excess of EUR 625. Extra insurance is available to reduce this excess. Exclusions apply as detailed in the Insurance Policy.\n\n## Cancellation\nSee the Cancellation Policy for notice periods and charges. No-shows may forfeit any deposit paid.\n\n## Payment\nCard pre-authorization may be required. Amounts may be subject to exchange rate variation.\n\n## Vehicle Use\nVehicles are limited to paved public roads. Mauritius drives on the left.\n\n## Accidents, Damages & Liability\nAny accident or damage must be reported immediately via the 24h emergency line.\n\n## Mechanical Issues & Maintenance\nReport any mechanical issue immediately; do not attempt repairs yourself.\n\n## Fuel Policy\nThe vehicle must be returned with the same fuel level as at pickup.\n\n## Hours & Emergency Contact\nWe operate 24/7 including public holidays. Emergency contact: +230 5253 2101.\n\n## Late Pickup, Early Dropoff & Late Return\nA 60-minute grace period applies to returns; late-return fees may apply beyond this.',
   E'## Inclusions\n- Kilométrage illimité\n- Assurance complète\n- Taxes locales incluses\n- Assistance routière 24h/24\n- Premier conducteur supplémentaire gratuit\n- Livraison/récupération aéroport gratuite\n\n## Exclusions\n- Amendes\n- Carburant\n- Frais d''annulation\n- Frais de retard\n- Perte de clés/documents\n\n## Livraison et récupération\nGratuite à l''aéroport SSR. 15 EUR pour la livraison ou récupération hors aéroport.\n\n## Documents et éligibilité\nÂge du conducteur 19–70 ans, permis détenu depuis au moins 1 an, pièce d''identité/passeport valide.\n\n## Groupe de véhicule vs modèle\nUne marque/modèle/carburant spécifique peut être remplacé par un véhicule similaire ou supérieur selon disponibilité.\n\n## Conducteurs supplémentaires\nLe premier conducteur supplémentaire est inclus gratuitement ; des frais peuvent s''appliquer au-delà.\n\n## Modifications et prolongations\nLes modifications et prolongations sont soumises à disponibilité du véhicule.\n\n## Assurance et franchise\nUne assurance complète est incluse avec une franchise de 625 EUR. Une assurance supplémentaire est disponible pour réduire cette franchise.\n\n## Annulation\nConsultez la Politique d''annulation pour les délais de préavis et frais applicables.\n\n## Paiement\nUne pré-autorisation par carte peut être requise. Les montants peuvent varier selon le taux de change.\n\n## Utilisation du véhicule\nLes véhicules sont limités aux routes publiques pavées. On conduit à gauche à Maurice.\n\n## Accidents, dommages et responsabilité\nTout accident ou dommage doit être signalé immédiatement via la ligne d''urgence 24h/24.\n\n## Problèmes mécaniques et entretien\nSignalez immédiatement tout problème mécanique ; n''essayez pas de réparer vous-même.\n\n## Politique de carburant\nLe véhicule doit être restitué avec le même niveau de carburant qu''au départ.\n\n## Horaires et contact d''urgence\nNous sommes disponibles 24h/24 et 7j/7, y compris les jours fériés. Contact d''urgence : +230 5253 2101.\n\n## Retard de prise en charge, restitution anticipée et retard\nUne période de grâce de 60 minutes s''applique aux retours ; des frais de retard peuvent s''appliquer au-delà.'),
  ('privacy',
   E'## What We Collect\nBooking details, contact information, and payment references necessary to fulfil your rental.\n\n## How We Use It\nTo process bookings, communicate with you, and comply with legal obligations.\n\n## Sharing\nWe do not sell personal data. Data is shared only with service providers necessary to deliver the rental (e.g. insurance, payment verification).\n\n## Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting dyash21@hotmail.com.',
   E'## Ce que nous collectons\nDétails de réservation, coordonnées et références de paiement nécessaires à la location.\n\n## Utilisation\nPour traiter les réservations, communiquer avec vous et respecter nos obligations légales.\n\n## Partage\nNous ne vendons pas de données personnelles. Les données sont partagées uniquement avec les prestataires nécessaires à la location (assurance, vérification de paiement).\n\n## Vos droits\nVous pouvez demander l''accès, la correction ou la suppression de vos données personnelles en contactant dyash21@hotmail.com.'),
  ('cookie',
   E'## Cookies We Use\nEssential cookies for site function, and privacy-friendly analytics cookies to understand site usage.\n\n## Your Choices\nYou can manage cookie preferences via your browser settings or our cookie consent banner.',
   E'## Cookies utilisés\nCookies essentiels au fonctionnement du site et cookies d''analyse respectueux de la vie privée.\n\n## Vos choix\nVous pouvez gérer vos préférences via les paramètres de votre navigateur ou notre bandeau de consentement.'),
  ('cancellation',
   E'## Notice Periods\nCancellation charges depend on how far in advance you cancel before pickup. Contact us as early as possible.\n\n## No-Shows\nNo-shows may forfeit any deposit paid.',
   E'## Délais de préavis\nLes frais d''annulation dépendent du délai avant la prise en charge. Contactez-nous le plus tôt possible.\n\n## Absence au rendez-vous\nToute absence peut entraîner la perte du dépôt versé.'),
  ('insurance',
   E'## Coverage\nComprehensive insurance is included with every rental, with a standard excess of EUR 625.\n\n## Extra Insurance\nExtra insurance is available to reduce the excess amount, priced per day.\n\n## Exclusions\nInsurance excludes damage from unauthorized use, unpaved roads, or driving under the influence.',
   E'## Couverture\nUne assurance complète est incluse avec chaque location, avec une franchise standard de 625 EUR.\n\n## Assurance supplémentaire\nUne assurance supplémentaire est disponible pour réduire la franchise, facturée par jour.\n\n## Exclusions\nL''assurance exclut les dommages résultant d''une utilisation non autorisée, de routes non pavées, ou de conduite sous influence.'),
  ('payment',
   E'## Accepted Methods\nBank transfer, pay on arrival, or online payment (MCB — coming soon).\n\n## Pre-Authorization\nA card pre-authorization may be required at pickup to cover the insurance excess.\n\n## Currency\nAll prices are shown in EUR; amounts may be subject to exchange rate variation.',
   E'## Méthodes acceptées\nVirement bancaire, paiement à l''arrivée, ou paiement en ligne (MCB — bientôt disponible).\n\n## Pré-autorisation\nUne pré-autorisation par carte peut être requise à la prise en charge pour couvrir la franchise d''assurance.\n\n## Devise\nTous les prix sont affichés en EUR ; les montants peuvent varier selon le taux de change.'),
  ('fuel',
   E'## Fuel Policy\nThe vehicle is provided with a full tank and must be returned at the same fuel level. Refuelling charges apply if returned with less fuel.',
   E'## Politique de carburant\nLe véhicule est fourni avec le plein et doit être restitué au même niveau. Des frais de ravitaillement s''appliquent en cas de retour avec moins de carburant.'),
  ('terms-of-use',
   E'## Use of This Website\nThis website is provided by Codexia Ltd for informational and booking purposes. By using this site, you agree to these terms.\n\n## Intellectual Property\nAll content on this site is the property of Codexia Ltd unless otherwise stated.',
   E'## Utilisation de ce site\nCe site est fourni par Codexia Ltd à des fins d''information et de réservation. En utilisant ce site, vous acceptez ces conditions.\n\n## Propriété intellectuelle\nTout le contenu de ce site est la propriété de Codexia Ltd, sauf mention contraire.')
) as v(slug, body_en, body_fr)
join policy_pages p on p.slug = v.slug
on conflict (policy_page_id, version) do nothing;

commit;
