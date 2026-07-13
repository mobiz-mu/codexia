# Supabase Setup

## Applying the schema

This environment can't reach `db.<project-ref>.supabase.co` directly — that
host only resolves to an IPv6 address here, and there's no IPv6 route. Until
someone applies these from a network with IPv6 (or the Session Pooler
connection string, port 5432, IPv4-compatible, is provided so the CLI can be
used instead), apply the schema by hand:

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/lenatznneinchzilergp/sql/new)
   for this project.
2. Paste the contents of `supabase/apply_all.sql` (generated from every file
   in `supabase/migrations/` plus `seed.sql`, in order) and run it.
3. Re-run the individual files under `supabase/migrations/` (in filename
   order) directly if you ever need to apply just the schema without
   reseeding — `apply_all.sql` is a convenience bundle, not the source of
   truth. Regenerate it after any migration change:

   ```bash
   for f in supabase/migrations/*.sql; do cat "$f"; echo; done > /tmp/schema.sql
   cat /tmp/schema.sql supabase/seed.sql > supabase/apply_all.sql
   ```

Once the CLI can reach the database (e.g. via the Session Pooler URL from
Project Settings → Database → Connection Pooling), migrations can be applied
normally:

```bash
npx supabase db push --db-url "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

## Regenerating TypeScript types

After the schema is applied, regenerate `lib/supabase/types.ts` (currently a
placeholder):

```bash
npx supabase gen types typescript --project-id lenatznneinchzilergp --schema public > lib/supabase/types.ts
```

## Creating the first super_admin

The `roles`/`permissions` seed data exists, but no user is assigned the
`super_admin` role yet — that has to happen after a real account exists:

1. Sign up through Supabase Auth (e.g. via the app once auth UI exists, or
   Authentication → Users → Add user in the dashboard). A matching row is
   auto-created in `public.profiles` by the `on_auth_user_created` trigger.
2. Run in the SQL Editor:

   ```sql
   insert into user_roles (user_id, role_id)
   select '<the-new-user-uuid>', id from roles where key = 'super_admin';
   ```

## Storage buckets

Created by `supabase/migrations/0012_storage.sql`: `vehicle-images`,
`category-images`, `banners`, `blog`, `company` (public read), and
`payment-proofs`, `invoices` (private — signed URLs only).

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
/ `SUPABASE_SERVICE_ROLE_KEY` are already in `.env.local` (gitignored) for
this project.
