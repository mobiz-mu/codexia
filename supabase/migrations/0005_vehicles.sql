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
