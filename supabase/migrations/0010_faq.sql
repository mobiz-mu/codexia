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
