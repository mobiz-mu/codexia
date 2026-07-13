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
