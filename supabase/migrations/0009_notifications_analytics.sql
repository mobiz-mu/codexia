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
