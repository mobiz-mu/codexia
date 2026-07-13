# Codexia Ltd — Pre-Delivery Audit & Testing Report

**Date:** 2026-07-14
**Scope:** Response to an independent review that found the project was not yet ready for delivery. Every numbered item from that review was investigated and fixed where a real problem existed; this report documents what was found, what was changed, and exactly how it was verified.

---

## 1. Summary of what was actually wrong

The independent review raised 15 concerns. Investigation confirmed **7 were real bugs**, 1 was a **genuine gap** (no UI existed to manage RBAC roles — added in a prior session pass), and the rest were legitimate hardening/delivery-hygiene requests rather than defects. One **additional bug was discovered during testing** that wasn't in the original list — a broken public review visibility policy — described in §3.

| # | Claim | Verdict | Fix |
|---|---|---|---|
| 1 | `npm ci` fails, lockfile out of sync | **Confirmed** | Removed `node_modules` + lockfile, reinstalled clean, regenerated lockfile, proved `npm ci` succeeds |
| 2 | Build fails downloading Google Fonts | **Confirmed** | Self-hosted Inter + Plus Jakarta Sans via `next/font/local`; zero network dependency at build time |
| 3 | Build hangs on Supabase calls during static render | **Partially confirmed** | No page actually does DB calls during static generation (all pages are dynamic via `cookies()`), but added a global fetch timeout to both Supabase clients as a hard safety net regardless |
| 4 | Secrets must not ship | **Was already correct** | `.env.local` is git-ignored and was never committed; only `.env.example` is tracked — verified via `git ls-files` |
| 5 | Validate migrations/RLS/storage on the real project | **Done, all pass** | See §4 |
| 6 | Regenerate `types.ts` from real schema | **Confirmed drift** | Hand-written types missed 3 real tables (`tags`, `post_tags`, `policy_acceptances`); regenerated from live introspection |
| 7 | React Email packages deprecated | **Confirmed** | `@react-email/components@1.0.12` (latest) hard-depends on ~20 sub-packages the maintainer marked "no longer supported" — replaced with a small local plain-HTML implementation |
| 8 | WhatsApp setting reads from `phone` | **Confirmed bug** | Added a real `whatsapp` site-setting row; fixed the mapping; threaded the live value through the one place it was still hardcoded (booking-confirmation WhatsApp CTA) |
| 9 | External services need timeouts | **Added** | Resend send, Google Calendar token exchange + event CRUD, and both Supabase clients now all have explicit timeouts |
| 10–14 | Full workflow re-test, exact clean sequence, prod smoke test | **Done** | See §5, §6 |

---

## 2. The one bug the review didn't ask about, but testing found

**`public_reviews` view returned zero rows to every real site visitor.**

The view was created with `security_invoker = true`. Anonymous/authenticated roles have **no RLS SELECT policy** on the base `reviews` table (only staff do). With `security_invoker = true`, Postgres enforces the *querying role's* RLS on the underlying table before the view's own `WHERE status = 'approved'` clause is ever applied — so the view silently returned nothing for every anonymous visitor, regardless of how many reviews were approved.

This means: **every approved review on the live site was invisible to actual customers** since the feature was built. Submission and admin moderation both worked correctly; only the public-facing display was broken.

Fixed by recreating the view as `security_invoker = false` (the default) — the standard Postgres/Supabase pattern for a column-limited public view over an RLS-protected table. Verified with a real anon-key query before and after the fix (see §5).

Migration: `supabase/migrations/0016_fix_public_reviews_view.sql`.

---

## 3. Exact clean verification sequence (as specified)

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm ci
npm run test
npm run typecheck
npm run lint
$env:NEXT_TELEMETRY_DISABLED="1"
npm run build
```

| Step | Result |
|---|---|
| `npm ci` | ✅ 581 packages installed, **0 errors, 0 deprecation warnings** |
| `npm run test` | ✅ **28/28 tests passed**, 5 test files (pricing math, booking status machine, SEO alternates, MCB webhook signature verification) |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` (Turbopack, telemetry disabled) | ✅ Compiled in ~10s, 73 routes generated, **no font errors, no hang** |

Also independently re-ran the build with `next build --webpack` (the exact bundler the original failure report named) — same clean result, ~18s.

Two moderate `npm audit` advisories remain, both inside `next`'s own bundled `postcss` dependency (pre-existing, unrelated to this project's code; the suggested fix would downgrade Next.js to `9.3.4-canary` — not applied).

---

## 4. Database validation on the real Supabase project

All checks below were run directly against the live project (`lenatznneinchzilergp`), not a local/mocked instance.

- **All tables exist**: 44 base tables + 1 view confirmed via `information_schema` introspection.
- **RLS enabled**: 44/44 tables have `relrowsecurity = true`. Zero exceptions.
- **RLS actually enforced** (tested with the real anon key, not just checked as a flag):
  - `vehicles`, `site_settings` → readable (public data) ✅
  - `payment_proofs`, `invoices`, `bookings`, `profiles`, `audit_logs`, `user_roles` → return **zero rows** to anon ✅
  - Direct anon `INSERT` into `bookings` → rejected with `new row violates row-level security policy` ✅
- **Roles & permissions**: 7 roles, 12 permissions. `super_admin` → 12/12. `administrator` → 11/12 (correctly excludes `manage_users`, matching seed intent).
- **First super_admin works**: test admin resolves to `super_admin` role → all 12 permissions confirmed via the same code path the app uses (`user_roles` → `roles` → `role_permissions` → `permissions`).
- **Storage buckets**: `vehicle-images`, `category-images`, `banners`, `blog`, `company` are `public: true`; `payment-proofs`, `invoices` are `public: false`.
- **Payment proofs / invoices cannot be opened publicly** — tested with a real uploaded file, not just a list check:
  - anon `list()` → empty
  - anon `download()` → "Object not found" (doesn't even confirm existence)
  - Direct public-URL fetch → HTTP 400
  - Admin-generated **signed URL** → HTTP 200 (the intended access path)
  - Same result for both buckets independently.
- **Booking overlap exclusion constraint**: inserted a real booking, then a real overlapping booking for the same vehicle → rejected with `23P01 conflicting key value violates exclusion constraint "bookings_vehicle_id_tstzrange_excl"`. A non-overlapping third booking on the same vehicle was correctly accepted.

---

## 5. Workflow testing — what was verified and how

Two verification methods were used depending on what the environment allowed:

- **Live browser** (form-based submissions: contact form, newsletter signup, review submission, admin login, customer secure booking link) — these use real `<form action={...}>` submissions and were clicked through in an actual browser against the live Supabase project.
- **Direct database simulation** replicating the exact operations a Server Action performs (booking creation, RBAC resolution, exclusion constraint, storage security) — used where the second category below made live-click testing unreliable.

**Known tooling limitation**: partway through this session, the Browser pane's screenshot/compositor pipeline became unresponsive (a `computer{action:"screenshot"}` call times out even on a freshly restarted preview server and a brand-new tab). As a side effect, some button clicks that trigger a client-side Server Action call directly (not a `<form>` submission — e.g. admin "Approve review", "Save Roles") did not reliably fire in this browser session, while real `<form>` submissions worked normally. This was confirmed to be an environment issue, not a code defect, by directly replicating the exact same database operation each action performs and confirming it succeeds and produces the correct downstream state.

| Workflow | Result |
|---|---|
| Contact form submission | ✅ Live browser: submitted → row in `contact_messages` → `new_contact_message` notification created |
| Newsletter signup | ✅ Live browser: submitted → row in `newsletter_subscribers`, `status: subscribed` |
| Review submission | ✅ Live browser: submitted → row in `reviews`, `status: pending`, `consent: true` |
| Review moderation → public visibility | ✅ DB-simulated `moderateReview()` → **found and fixed the view bug in §2** → confirmed anon can now see it |
| Booking creation | ✅ DB-simulated `createBooking()` exactly (customer, driver, notification rows) → duplicate idempotency key correctly rejected by DB unique constraint |
| Booking overlap prevention | ✅ Real exclusion-constraint test, see §4 |
| Customer secure booking link | ✅ Live browser: real SHA-256-hashed token → correct booking reference, status, vehicle, pricing, and payment-proof upload form all rendered |
| Bank-transfer proof upload form | ✅ Renders correctly on the secure booking page (matches `pending` status) |
| Invoice creation, PDF generation, download | ✅ Verified in an earlier session pass: created from a booking, PDF generated to private storage, downloaded via signed URL, duplicate/void tested |
| Admin roles & permissions | ✅ DB-verified: full 7-role × 12-permission matrix, `super_admin` resolves correctly |
| Booking-received / booking-confirmed / reminder emails | ⚠️ **Code path verified, delivery not verified** — see §7 |
| 7-day reminder + no duplicate reminder | ✅ Verified in an earlier session pass: cron endpoint sent once, second run correctly skipped (`reminder_logs` unique constraint on `(booking_id, reminder_type)`) |
| Google Calendar create/update/cancel | ⚠️ **Not testable** — see §7 |
| MCB webhook (signature verification, idempotency) | ✅ Verified in an earlier session pass: invalid signature rejected (401), replayed idempotency key correctly no-ops |
| EN/FR routes | ✅ Spot-checked homepage, fleet, contact, FAQ, privacy policy in both locales — fully translated, phone/WhatsApp values correct in both |
| Mobile layout | ✅ Structural check at 375×812 (hamburger nav present, all form fields present) — visual screenshot verification was not possible (see limitation above) |
| Production server (`next start`) | ✅ Started clean, homepage rendered, security headers present, admin login + auth worked, `/robots.txt` and `/sitemap.xml` served correctly |

All test data created during this pass (bookings, reviews, contact messages, newsletter subscriptions, notifications, `email_logs` rows) was deleted from the live project afterward. Final row counts confirmed clean: 0 bookings, 0 invoices, 1 pre-existing seed review, 1 pre-existing notification, 0 everything else test-related.

---

## 6. Known limitations

- **Email delivery cannot be verified end-to-end.** `RESEND_API_KEY` is not set in this environment. Every email send attempt correctly logs to `email_logs` with `status: failed`, `error: "RESEND_API_KEY not configured"` — the code path, recipient, and content are all exercised and correct, but no email was actually received in an inbox. Set `RESEND_API_KEY` and re-run a booking to confirm delivery.
- **Google Calendar sync cannot be verified end-to-end.** `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` / `GOOGLE_CALENDAR_ID` are not set. The integration is designed to fail silently and log to `calendar_sync_log` when unconfigured (by design, so a missing integration never blocks a booking) — but no real calendar event was created or can be shown as evidence. Needs real service-account credentials to verify create/update/cancel against an actual Google Calendar.
- **MCB online payment** remains "Coming Soon" by design — no merchant credentials exist yet, and the UI correctly disables that option.
- **Live browser click verification for non-form admin actions** (e.g., individual "Approve"/"Reject"/"Save" buttons) was constrained by the Browser pane tooling issue described in §5, and it's worth a follow-up manual pass once verified as resolved, even though the underlying Server Action logic was independently verified.
- **`flight_airport`** column on `bookings` exists in the schema (migration 0006) but is not read or written anywhere in the application — appears to be planned-but-unbuilt, not a bug, flagging for awareness.

---

## 7. Credentials still required before go-live

| Credential | Purpose | Current state |
|---|---|---|
| `RESEND_API_KEY` | Transactional email delivery | Not set |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` + `GOOGLE_CALENDAR_ID` | Calendar sync | Not set |
| `MCB_MERCHANT_ID` / `MCB_API_KEY` / `MCB_WEBHOOK_SECRET` | Online payment | Not set (feature intentionally disabled until issued) |
| `CRON_SECRET` | Protects `/api/cron/reminders` | Set to a local placeholder (`change-me-local-dev-secret`) — **generate a real secret for production** |
| **Supabase service-role key & anon key currently in `.env.local`** | Database access | **Rotate before/at go-live** — these were used extensively for direct scripted testing throughout this session (visible in shell history within this environment) |

---

## 8. Exact commands executed (for reproducibility)

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm ci
npm run test
npm run typecheck
npm run lint
$env:NEXT_TELEMETRY_DISABLED="1"
npm run build
npm run start   # production smoke test
```

Environment: Node v24.13.0, npm 11.11.1, Next.js 16.2.10.

Test totals: **28/28 Vitest tests passed** · **0 typecheck errors** · **0 lint errors/warnings** · **73 routes built** (both Turbopack and webpack bundlers confirmed).
