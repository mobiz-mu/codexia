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
