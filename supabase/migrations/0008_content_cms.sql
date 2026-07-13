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
