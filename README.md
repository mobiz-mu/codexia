# Codexia Ltd — Car Rental Platform

A bilingual (EN/FR) car rental website and booking management system for Mauritius, built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack for build, webpack for local dev — see note below)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **Database / Auth / Storage**: Supabase (Postgres, Row Level Security, Auth, Storage)
- **Forms & validation**: Server Actions + Zod + React Hook Form
- **i18n**: next-intl (`/en`, `/fr`)
- **Email**: Resend + React Email
- **PDF**: @react-pdf/renderer (invoices)
- **Payments**: PayPal Orders API v2, server-verified (`lib/payments/paypal-client.ts`) — no `@paypal/*` SDK, plain `fetch` + OAuth2
- **Images**: `sharp` (upload-time WebP/AVIF variants, blur placeholders, dedup hashing — `lib/images/process-vehicle-image.ts`)
- **Tests**: Vitest (pure business-logic unit tests)

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in the values described below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Windows note**: `next dev` (Turbopack) has been unstable on some Windows setups in this project's history (`Insufficient system resources` thread-spawn errors). If you hit this, run `npx next dev --webpack` instead — production builds (`next build`) are unaffected either way.

## Environment Variables

See `.env.example` for the full list. At minimum, for local development you need:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project settings.
- `NEXT_PUBLIC_SITE_URL` — defaults to `http://localhost:3000`.

Everything else (Resend, Google Calendar, cron secret, analytics IDs, PayPal secret/webhook, Sentry) is optional for local development — features that depend on them degrade gracefully (e.g. emails log to `email_logs` as "failed: not configured" instead of throwing). See [docs/SETUP.md](docs/SETUP.md) for PayPal sandbox setup specifically.

## Database Setup

Migrations live in `supabase/migrations/`, applied in order. `supabase/apply_all.sql` concatenates them for a one-shot run in the Supabase SQL Editor if the CLI isn't available. `supabase/seed.sql` seeds roles/permissions, site settings, demo locations/vehicles/extras (all marked `is_demo = true`), and email template variable docs.

To create your first admin user: sign them up via Supabase Auth (dashboard or `supabase.auth.admin.createUser`), then insert a row into `user_roles` linking them to the `super_admin` role — after that, they can manage all other users from `/admin/users`.

## Project Structure

- `app/[locale]/...` — public, bilingual site (marketing pages, fleet, booking wizard, my-booking self-service).
- `app/admin/...` — staff admin panel (own root layout, auth-gated via the `(protected)` route group, `noindex`).
- `app/api/webhooks/paypal/` — server-verified PayPal webhook (signature-checked, deduped via `webhook_events`).
- `app/api/cron/` — reminders (7-day pickup), expire-bookings (abandoned unpaid), review-requests (24h post-completion).
- `lib/actions/` — public Server Actions; `lib/actions/admin/` — permission-gated admin Server Actions.
- `lib/payments/paypal-client.ts` — server-side PayPal Orders API v2 client (order creation, capture, webhook signature verification).
- `lib/images/process-vehicle-image.ts` — upload-time image pipeline (EXIF strip, WebP/AVIF variants, blur placeholder, content-hash dedup).
- `lib/vehicles/operational-status.ts` — derives a vehicle's current status (Available/Reserved/Active Rental/.../Maintenance) from its booking + block state; never stored, always computed.
- `lib/supabase/` — session client, browser client, service-role admin client, and a hand-written `Database` type (no local Docker/Podman available for `supabase gen types` in this environment).
- `lib/email/`, `emails/` — transactional email senders and React Email templates, with an admin-editable override system (`email_templates` table). Every template shares `EmailHeader`/`EmailFooter` (`emails/components.tsx`) so branding, support contact, WhatsApp, Maps, and social links are consistent across all of them.
- `lib/booking/status-machine.ts` — the booking status state machine (see tests for the legal-transition matrix).
- `lib/pricing/` — server-side pricing calculation (never trust client-submitted totals); `lib/pricing/deposit.ts` handles the MUR-total → EUR-deposit conversion for PayPal.

## Key Design Decisions

- **PayPal is server-verified, not browser-trusted**: order creation and capture both happen server-to-server (`lib/payments/paypal-client.ts`), with currency/amount/booking-reference checks before a booking is ever marked confirmed. Smart Buttons are UI only — no `@paypal/*` SDK dependency, no client-side capture.
- **RLS + server-side checks everywhere**: every admin Server Action calls `requireAdminUser()` + an explicit permission check — hiding a UI button is never the only guard.
- **Double-booking is prevented at the database level** via a Postgres exclusion constraint on `bookings (vehicle_id, tstzrange(pickup_at, return_at))`, not just application logic.
- **Magic links, not passwords**, for customer self-service (`/my-booking/[token]`) — only a SHA-256 hash of the access token is ever persisted; the tokenized page is `noindex, nofollow` and excluded from the sitemap/robots.
- **Manual, not automatic, invoice sending** — invoices are generated and can be marked "sent" by an admin action, never fired automatically on a schedule.
- **A vehicle's operational status is derived, never stored** (`lib/vehicles/operational-status.ts`) — computed from its current bookings and `vehicle_blocks` rows at query time, so it can't silently go stale the way a manually-maintained status field would. See "Computed vs. Stored State" below.

## Computed vs. Stored State: Vehicle Operational Status

`vehicles` has no `operational_status` (or similar) column, and it should stay that way. "Is this vehicle Available / Reserved / Active Rental / Returned / Preparing / Cleaning / Maintenance / Blocked right now?" is a question with a time-varying answer that depends entirely on other tables (`bookings`, `vehicle_blocks`) — a stored column would just be a cache of that answer, and every cache invalidation bug (forgot to update it on booking cancel, admin edited a date directly in the DB, a webhook retried and skipped a step) would show a vehicle as available when it isn't, or blocked when it's free. Computing it removes that entire bug class by construction.

- **Where it's computed**: `computeOperationalStatus()` in `lib/vehicles/operational-status.ts` — a pure function, no DB access itself. It takes `now` plus the vehicle's own bookings/blocks (already fetched by the caller) and returns one `OperationalStatus`. Unit tests in the adjacent `.test.ts` file cover the priority order below; read those first if you need to change the logic.
- **Priority order** (first match wins, most specific/administrator-decided state first): a `vehicle_blocks` row covering `now` (maintenance → blocked → preparing → cleaning) beats any booking, since a block is an explicit admin decision that the vehicle is unavailable. Then an `active`-status booking covering `now` → "active_rental". Then a `completed` booking whose `return_at` was within the last 24h → "returned" (a short grace window so a just-returned car doesn't immediately look like generic "available"). Then any booking in the pre-pickup active statuses (confirmed/partially_paid/paid/vehicle_assigned/ready_for_pickup) either covering `now` or starting within the next 30 days → "reserved". Otherwise → "available".
- **Who calls it**: `lib/actions/admin/overview.ts` (`getOverviewStats`, for the "vehicles available/reserved/maintenance" dashboard counts and fleet utilisation %). The availability planner (`components/admin/AvailabilityBoard.tsx`) shows the same underlying booking/block data directly as coloured bars rather than calling this function — it's showing the full timeline, not a single "status right now" snapshot, so it doesn't need the collapsed-to-one-value form.
- **If you add a new vehicle_blocks type or booking status**: update the priority logic in `computeOperationalStatus()` and add a case to its test file — do not add a parallel stored-status column instead, even if it seems like the "simple" fix under time pressure. That reintroduces the staleness problem this design exists to avoid.

## Testing

```bash
npm run test        # vitest — pricing, status machine, SEO alternates, PayPal client, operational status, image pipeline
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build (also runs typecheck)
```

## Security Notes

- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts`.
- Public write endpoints (contact form, newsletter, reviews, booking-link resend, admin login, booking creation) are rate-limited per IP (`lib/utils/rate-limit.ts`). This is an in-memory, single-instance limiter — fine for the current deployment shape, but should move to a shared store (Upstash/Vercel KV) if this ever runs across multiple serverless instances concurrently.
- `CRON_SECRET` gates every `/api/cron/*` route and fails closed (rejects the request) if the env var is unset — it never silently skips the auth check.
- The PayPal webhook (`/api/webhooks/paypal`) verifies the signature against `PAYPAL_WEBHOOK_ID` via PayPal's own verification API and rejects unverified deliveries; events are deduped by PayPal's `event_id` in `webhook_events`.
- Every vehicle/category image mutation (upload, set-main, delete, reorder) requires both authentication and the `manage_vehicles` permission, and writes an `audit_logs` row — none of it is a hidden-button-only guard.

## Fleet Management

Vehicles carry real operational/compliance data beyond the booking-facing spec sheet: registration number, VIN, engine number, insurance/road-tax/fitness expiry, last/next service date, current mileage, and optional weekly/monthly rates (`supabase/migrations/0021_fleet_operational_fields.sql`). None of this is customer-facing — it's for the admin fleet form and future maintenance-alert tooling.

A vehicle's day-to-day status (Available, Reserved, Active Rental, Returned, Preparing, Cleaning, Maintenance, Blocked) is never stored — see `lib/vehicles/operational-status.ts`. "Preparing"/"Cleaning" turnaround windows are entered the same way as maintenance blocks, via the availability planner's block form (`vehicle_blocks.type`).

## Review Workflow

1. Admin marks a booking `completed` (manual — no automatic status change).
2. `app/api/cron/review-requests/route.ts` (run on a schedule, e.g. hourly) finds bookings that reached `completed` at least 24h ago with no request sent yet, and sends one review-request email per booking — deduped via `review_request_logs` (unique per `booking_id`, insert-before-send so a concurrent run can't double-send).
3. The customer submits a review through the existing public review form; it lands in `pending` status.
4. An admin approves it from `/admin/reviews`; only then does it appear on `public_reviews`.

## Image Pipeline

Every vehicle image upload (`uploadVehicleImage` in `lib/actions/admin/vehicles.ts`) runs through `lib/images/process-vehicle-image.ts`:

- Content-hash dedup: an exact duplicate photo for the same vehicle is rejected before it reaches storage.
- EXIF stripped (device/GPS/timestamp metadata never leaves the server) while visual orientation is preserved.
- WebP always generated at 4 sizes (thumb/card/hero/gallery); AVIF generated best-effort (skipped without failing the upload if the platform's libvips build lacks AVIF support).
- A small base64 blur placeholder is generated and wired into `next/image`'s `placeholder="blur"` on the public fleet card and vehicle-detail gallery.
- The original upload is always kept alongside the generated variants — nothing is deleted or overwritten.
