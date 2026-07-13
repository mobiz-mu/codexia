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
