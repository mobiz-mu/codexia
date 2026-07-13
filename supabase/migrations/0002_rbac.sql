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
