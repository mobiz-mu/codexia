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

Everything else (Resend, Google Calendar, cron secret, analytics IDs, MCB) is optional for local development — features that depend on them degrade gracefully (e.g. emails log to `email_logs` as "failed: not configured" instead of throwing).

## Database Setup

Migrations live in `supabase/migrations/`, applied in order. `supabase/apply_all.sql` concatenates them for a one-shot run in the Supabase SQL Editor if the CLI isn't available. `supabase/seed.sql` seeds roles/permissions, site settings, demo locations/vehicles/extras (all marked `is_demo = true`), and email template variable docs.

To create your first admin user: sign them up via Supabase Auth (dashboard or `supabase.auth.admin.createUser`), then insert a row into `user_roles` linking them to the `super_admin` role — after that, they can manage all other users from `/admin/users`.

## Project Structure

- `app/[locale]/...` — public, bilingual site (marketing pages, fleet, booking wizard, my-booking self-service).
- `app/admin/...` — staff admin panel (own root layout, auth-gated via the `(protected)` route group, `noindex`).
- `app/api/...` — cron reminders, analytics ingest, MCB webhook.
- `lib/actions/` — public Server Actions; `lib/actions/admin/` — permission-gated admin Server Actions.
- `lib/supabase/` — session client, browser client, service-role admin client, and a hand-written `Database` type (no local Docker/Podman available for `supabase gen types` in this environment).
- `lib/email/`, `emails/` — transactional email senders and React Email templates, with an admin-editable override system (`email_templates` table).
- `lib/booking/status-machine.ts` — the booking status state machine (see tests for the legal-transition matrix).
- `lib/pricing/` — server-side pricing calculation (never trust client-submitted totals).

## Key Design Decisions

- **No fake payment success**: online payment (MCB) is scaffolded (`lib/payments/mcb.ts`, `app/api/webhooks/mcb/route.ts`) but stays "Coming Soon" in the UI until real merchant credentials exist.
- **RLS + server-side checks everywhere**: every admin Server Action calls `requireAdminUser()` + an explicit permission check — hiding a UI button is never the only guard.
- **Double-booking is prevented at the database level** via a Postgres exclusion constraint on `bookings (vehicle_id, tstzrange(pickup_at, return_at))`, not just application logic.
- **Magic links, not passwords**, for customer self-service (`/my-booking/[token]`) — only a SHA-256 hash of the access token is ever persisted; the tokenized page is `noindex, nofollow` and excluded from the sitemap/robots.
- **Manual, not automatic, invoice sending** — invoices are generated and can be marked "sent" by an admin action, never fired automatically on a schedule.

## Testing

```bash
npm run test        # vitest — pricing, status machine, SEO alternates, MCB signature verification
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build (also runs typecheck)
```

## Security Notes

- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts`.
- Public write endpoints (contact form, newsletter, reviews, booking-link resend, admin login) are rate-limited per IP (`lib/utils/rate-limit.ts`). This is an in-memory, single-instance limiter — fine for the current deployment shape, but should move to a shared store (Upstash/Vercel KV) if this ever runs across multiple serverless instances concurrently.
- `CRON_SECRET` gates `/api/cron/reminders`; the MCB webhook is HMAC-signature-verified and idempotent by transaction key.
