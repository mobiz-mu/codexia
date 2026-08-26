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
   { for f in supabase/migrations/*.sql; do
       [ "$(basename "$f" | cut -c1-4)" = "0026" ] && { cat supabase/seed.sql; echo; }
       cat "$f"; echo
     done; } > supabase/apply_all.sql
   ```

   **`seed.sql` goes between `0025` and `0026`, not at the end.** It is not a
   stylistic choice. `seed.sql` is what creates the `roles` rows, and every
   migration from `0026` onward grants its new permissions by selecting from
   `roles`. Append `seed.sql` last and those grants match an empty table and
   insert nothing — silently. The schema still applies without a single
   error, and the result is **50 of 75** `role_permissions`: every fleet-ops
   grant for `administrator` and `fleet_manager` is missing, so staff simply
   cannot see half the admin and nothing anywhere says why.

   `lib/db/apply-all-ordering.test.ts` fails if this ordering is ever lost.

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

## PayPal

Order creation and capture happen server-side (`lib/payments/paypal-client.ts`)
via PayPal's REST Orders API v2 — no `@paypal/*` SDK package, just `fetch` +
OAuth2 client-credentials. The Smart Buttons on the booking page are UI only;
the server is the source of truth for whether a payment actually succeeded.

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications),
   create (or reuse) an app for **sandbox** testing first. Copy its Client ID
   into `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and its Secret into `PAYPAL_CLIENT_SECRET`.
2. Set `PAYPAL_ENVIRONMENT=sandbox` while testing; only switch to `live` (with
   a live app's credentials) once ready to accept real payments.
3. Add a webhook subscription on the app pointed at
   `https://<your-domain>/api/webhooks/paypal`, subscribed to at least:
   `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
   `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`. Copy the resulting
   webhook ID into `PAYPAL_WEBHOOK_ID` — it's required for signature
   verification, and the webhook route rejects unverified deliveries.
4. Run migration `0019_paypal_verification.sql` (part of `apply_all.sql`)
   before testing — it adds the `payment_transactions.capture_id`/
   `exchange_rate` columns and the `webhook_events` dedup table the new flow
   depends on.
5. Refunds are handled by an admin acting directly in the PayPal dashboard;
   the webhook only records the resulting `REFUNDED`/`REVERSED` event and
   notifies admin — there is no in-app refund trigger.

## Migrations 0021–0023 (fleet fields, image variants, Maps setting)

Also part of `apply_all.sql`, applied the same way as above:

- `0021_fleet_operational_fields.sql` — adds compliance/service columns to
  `vehicles` (VIN, engine number, insurance/road-tax/fitness expiry, service
  dates, mileage, weekly/monthly rates) and widens `vehicle_blocks.type` to
  include `preparing`/`cleaning`.
- `0022_vehicle_image_variants.sql` — adds `content_hash`/`variants`/
  `blur_data_url` to `vehicle_images` for the upload-time image pipeline
  (`lib/images/process-vehicle-image.ts`). Requires the `sharp` package,
  which must stay pinned to the exact version `next` itself depends on
  (`npm ls sharp` should show one deduped version, not two) — a second copy
  of the native libvips binary in the same process corrupts the first one's
  global state and breaks unrelated routes (this broke `/apple-icon`'s
  build-time image generation during development; pinning `sharp` to
  `next`'s version and letting npm dedupe fixed it).
- `0023_google_maps_setting.sql` — adds an empty `google_maps_url` site
  setting; fill it in via `/admin/settings` to make the "Find Us" link
  appear in email footers (it's hidden, not a broken link, while empty).

## Sentry (planned, not yet wired up)

`.env.example` reserves `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` for a future
Sentry integration (production monitoring is a Phase 5/launch item, not part
of this phase's scope). Setting them today has no effect — the `@sentry/nextjs`
package isn't installed and no instrumentation exists yet. Treat these as
reserved names, not a working feature.
