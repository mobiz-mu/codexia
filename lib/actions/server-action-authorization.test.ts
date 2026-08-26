import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * Every export of a `"use server"` module is a public HTTP endpoint.
 *
 * Next.js registers each one in the server-reference manifest with a stable
 * action id, and the only thing standing in front of them is proxy.ts — which
 * proves a session exists, not that the caller holds any role. So an export
 * with no permission check is reachable by any authenticated account
 * regardless of privilege.
 *
 * This has now bitten the codebase three times: a synchronous re-export that
 * broke the action manifest, and then `insertVehicleBlock`,
 * `runComplianceAlertCheck` and `findAvailabilityConflicts` — all three
 * server-to-server helpers that were never meant to be endpoints and were
 * published simply by living in the wrong file.
 *
 * This test is the standing guard. A new export in a "use server" module must
 * either check authorization or be named here with a reason. Helpers that
 * need no permission of their own belong in a plain server-only module
 * instead — that is what lib/fleet/vehicle-blocks.ts,
 * lib/compliance/run-alert-check.ts and lib/booking/availability-conflicts.ts
 * exist to demonstrate.
 */

const ROOT = join(process.cwd(), "lib");

const AUTH_PATTERN =
  /requireAdminUser|getCurrentAdminUser|assertPermission|permissions\.has|hasPermission|requirePermission/;

/**
 * Exports that are deliberately reachable without an admin session, each with
 * the reason it is safe. Anything not on this list must authorize.
 */
const INTENTIONALLY_PUBLIC: Record<string, string> = {
  // Sign-in itself cannot require being signed in.
  "lib/auth/actions.ts::loginAdmin": "authenticates; rate-limited, and grants nothing on failure",
  "lib/auth/actions.ts::logoutAdmin": "clears the caller's own session only",

  // The public booking funnel. These are the storefront.
  "lib/actions/booking.ts::searchAvailableVehicles": "public inventory search",
  "lib/actions/booking.ts::getExtras": "public price list",
  "lib/actions/booking.ts::quoteBooking": "server-authoritative quote for a public shopper",
  "lib/actions/booking.ts::createBooking": "public booking creation; rate-limited and idempotency-keyed",

  // Capability-based auth: the caller proves possession of the booking's
  // access token, which is a 24-byte secret stored only as a SHA-256 hash.
  "lib/actions/booking.ts::getBookingDepositQuote": "verifies the booking access token",
  "lib/actions/booking.ts::createPayPalOrderForBooking": "verifies the booking access token",
  "lib/actions/booking.ts::captureBookingPayment": "verifies the booking access token",
  "lib/actions/my-booking.ts::getBookingByToken": "the token IS the credential",
  "lib/actions/my-booking.ts::resendBookingLink": "rate-limited; only ever mails the address already on the booking",

  // Public site forms.
  "lib/actions/contact.ts::submitContactMessage": "public contact form",
  "lib/actions/newsletter.ts::subscribeToNewsletter": "public newsletter form",
  "lib/actions/reviews.ts::submitReview": "public review submission, held for moderation",

  // Thin wrapper whose only statement calls an action that authorizes.
  "lib/actions/admin/invoices.ts::createInvoiceFromBookingAndRedirect":
    "delegates to createInvoiceFromBooking, which asserts create_invoices",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function relative(file: string): string {
  return file.slice(process.cwd().length + 1).split(sep).join("/");
}

type ExportedAction = { file: string; name: string; guarded: boolean };

function collectServerActions(): ExportedAction[] {
  const actions: ExportedAction[] = [];

  for (const file of walk(ROOT)) {
    const source = readFileSync(file, "utf8");
    // The directive is only a directive on the first statement of the module.
    if (!/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["'];/.test(source)) continue;

    const lines = source.split("\n");
    const starts: { name: string; line: number }[] = [];
    lines.forEach((line, index) => {
      const match = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(line);
      if (match) starts.push({ name: match[1], line: index });
    });

    starts.forEach((start, index) => {
      const end = index + 1 < starts.length ? starts[index + 1].line : lines.length;
      const body = lines.slice(start.line, end).join("\n");
      actions.push({ file: relative(file), name: start.name, guarded: AUTH_PATTERN.test(body) });
    });
  }

  return actions;
}

describe("every server action authorizes", () => {
  const actions = collectServerActions();

  it("finds the server-action modules at all", () => {
    // Guards against the collector silently matching nothing and passing.
    expect(actions.length).toBeGreaterThan(100);
  });

  it("has no exported action without an authorization check or a stated reason", () => {
    const unguarded = actions
      .filter((a) => !a.guarded)
      .map((a) => `${a.file}::${a.name}`)
      .filter((id) => !(id in INTENTIONALLY_PUBLIC));

    expect(unguarded).toEqual([]);
  });

  it("keeps the public allow-list honest — no stale entries", () => {
    const ids = new Set(actions.map((a) => `${a.file}::${a.name}`));
    const stale = Object.keys(INTENTIONALLY_PUBLIC).filter((id) => !ids.has(id));
    expect(stale).toEqual([]);
  });

  it("does not publish the block-creation primitive as an endpoint", () => {
    // insertVehicleBlock takes actorId from its caller, so as an action it
    // would let any authenticated session forge `created_by`.
    expect(actions.some((a) => a.name === "insertVehicleBlock")).toBe(false);
  });

  it("does not publish the compliance alert sweep as an endpoint", () => {
    expect(actions.some((a) => a.name === "runComplianceAlertCheck")).toBe(false);
  });

  it("does not publish the conflict reader as an endpoint", () => {
    // It returns customer names and booking references.
    expect(actions.some((a) => a.name === "findAvailabilityConflicts")).toBe(false);
  });

  it("no longer exposes a hard-delete path for vehicle blocks", () => {
    expect(actions.some((a) => a.name === "deleteBlock")).toBe(false);
  });
});
