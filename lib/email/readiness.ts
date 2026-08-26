import "server-only";
import { SITE_DEFAULTS } from "@/lib/config/site";

/**
 * Is this deployment actually able to send email?
 *
 * Every row in production `email_logs` had failed with "RESEND_API_KEY not
 * configured", which nothing in the app surfaced until someone went looking.
 * This exists so the answer can be checked from the Settings screen of the
 * deployment being asked about — a local .env file proves nothing about what
 * Vercel holds.
 *
 * Two rules govern everything below:
 *
 *   1. No secret value is ever returned. Presence, shape and the provider's
 *      verdict are reportable; the key itself never leaves the server.
 *   2. Nothing here sends an email. The provider call is a plain read.
 */

/**
 * Its own template key so a diagnostic send can never be mistaken for, or
 * counted alongside, a real customer email in `email_logs`.
 */
export const READINESS_TEST_TEMPLATE_KEY = "email_readiness_test";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  /** Safe to render. Never contains a credential. */
  detail: string;
};

export type EmailReadiness = {
  /** True only when nothing is failing — warnings are survivable. */
  ready: boolean;
  checks: ReadinessCheck[];
};

const RESEND_DOMAINS_ENDPOINT = "https://api.resend.com/domains";
const RESEND_TIMEOUT_MS = 8_000;

type DomainProbe =
  | { outcome: "verified_list"; domains: { name: string; status: string }[] }
  | { outcome: "valid_but_restricted" }
  | { outcome: "rejected"; detail: string }
  | { outcome: "unreachable"; detail: string };

/**
 * Non-destructive credential probe: GET /domains sends nothing.
 *
 * A key restricted to sending access is REJECTED by this endpoint but is
 * still a perfectly good key, so that case is reported as valid rather than
 * failed — refusing to launch over a correctly-scoped credential would be
 * its own bug.
 */
async function probeResendKey(apiKey: string): Promise<DomainProbe> {
  let response: Response;
  try {
    response = await fetch(RESEND_DOMAINS_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return { outcome: "unreachable", detail: reason };
  }

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      data?: { name?: string; status?: string }[];
    } | null;
    const domains = (body?.data ?? [])
      .filter((d): d is { name: string; status: string } => Boolean(d.name))
      .map((d) => ({ name: d.name, status: d.status ?? "unknown" }));
    return { outcome: "verified_list", domains };
  }

  const body = (await response.json().catch(() => null)) as { name?: string; message?: string } | null;
  const name = body?.name ?? "";

  if (name === "restricted_api_key") return { outcome: "valid_but_restricted" };

  // Resend's own error name is more useful than the status code, but never
  // echo `message` verbatim — it can quote the submitted key back at us.
  return { outcome: "rejected", detail: name || `HTTP ${response.status}` };
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function domainOf(address: string): string | null {
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

/**
 * `adminRecipient` comes from site_settings rather than the environment —
 * it is where the internal "new booking" copy goes, and an unset value means
 * the operator side of every notification is silently dropped.
 */
export async function checkEmailReadiness(input?: { adminRecipient?: string | null }): Promise<EmailReadiness> {
  const checks: ReadinessCheck[] = [];
  const push = (key: string, label: string, status: ReadinessStatus, detail: string) =>
    checks.push({ key, label, status, detail });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  // ---- 1. the credential exists at all -----------------------------------
  if (!apiKey) {
    push(
      "resend_api_key",
      "RESEND_API_KEY",
      "fail",
      "Not set. Every send fails immediately and is logged as \"RESEND_API_KEY not configured\"."
    );
  } else {
    push("resend_api_key", "RESEND_API_KEY", "pass", "Set for this deployment.");
  }

  // ---- 2. the provider agrees the credential is real ---------------------
  let verifiedDomains: { name: string; status: string }[] | null = null;

  if (!apiKey) {
    push("resend_key_valid", "Resend accepts the key", "fail", "Not checked — no key to check.");
  } else {
    const probe = await probeResendKey(apiKey);
    if (probe.outcome === "verified_list") {
      verifiedDomains = probe.domains;
      const verified = probe.domains.filter((d) => d.status === "verified").map((d) => d.name);
      push(
        "resend_key_valid",
        "Resend accepts the key",
        "pass",
        verified.length
          ? `Accepted. Verified sending domains: ${verified.join(", ")}.`
          : "Accepted, but no domain has reached verified status yet."
      );
    } else if (probe.outcome === "valid_but_restricted") {
      push(
        "resend_key_valid",
        "Resend accepts the key",
        "pass",
        "Accepted. The key is scoped to sending access only, so its domains cannot be listed — that is a valid configuration."
      );
    } else if (probe.outcome === "rejected") {
      push(
        "resend_key_valid",
        "Resend accepts the key",
        "fail",
        `Resend refused the key (${probe.detail}). It is present but will not send.`
      );
    } else {
      push(
        "resend_key_valid",
        "Resend accepts the key",
        "warn",
        `Could not reach Resend to check (${probe.detail}). This says nothing about the key itself.`
      );
    }
  }

  // ---- 3. sender address --------------------------------------------------
  const effectiveFrom = from || `bookings@${SITE_DEFAULTS.domain.replace(/^www\./, "")}`;
  if (!from) {
    push(
      "email_from",
      "EMAIL_FROM",
      "warn",
      `Not set. Sends fall back to ${effectiveFrom}, which must still be a verified Resend sender.`
    );
  } else if (!looksLikeEmail(from)) {
    push("email_from", "EMAIL_FROM", "fail", `"${from}" is not a valid email address.`);
  } else {
    push("email_from", "EMAIL_FROM", "pass", from);
  }

  // Only meaningful when the key was permitted to list domains.
  if (verifiedDomains) {
    const fromDomain = domainOf(effectiveFrom);
    const match = verifiedDomains.find((d) => d.name.toLowerCase() === fromDomain);
    if (!fromDomain) {
      push("from_domain", "Sender domain is verified", "fail", `Could not read a domain from "${effectiveFrom}".`);
    } else if (!match) {
      push(
        "from_domain",
        "Sender domain is verified",
        "fail",
        `${fromDomain} is not registered on this Resend account. Sends from it will be rejected.`
      );
    } else if (match.status !== "verified") {
      push(
        "from_domain",
        "Sender domain is verified",
        "fail",
        `${fromDomain} is registered but its status is "${match.status}", not "verified".`
      );
    } else {
      push("from_domain", "Sender domain is verified", "pass", `${fromDomain} is verified on this Resend account.`);
    }
  }

  // ---- 4. reply-to --------------------------------------------------------
  if (!replyTo) {
    push("email_reply_to", "EMAIL_REPLY_TO", "warn", `Not set. Replies fall back to ${SITE_DEFAULTS.email}.`);
  } else if (!looksLikeEmail(replyTo)) {
    push("email_reply_to", "EMAIL_REPLY_TO", "fail", `"${replyTo}" is not a valid email address.`);
  } else {
    push("email_reply_to", "EMAIL_REPLY_TO", "pass", replyTo);
  }

  // ---- 5. the link inside the email --------------------------------------
  // Not decorative: buildEmailBrandProps/getSiteUrl build the customer's
  // /my-booking/<token> link from this, and that link is the ONLY way they
  // reach their booking. Wrong here means a delivered but useless email.
  if (!siteUrl) {
    push(
      "site_url",
      "NEXT_PUBLIC_SITE_URL",
      "fail",
      "Not set. Booking links in emails would point at http://localhost:3000."
    );
  } else if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(siteUrl)) {
    push("site_url", "NEXT_PUBLIC_SITE_URL", "fail", `${siteUrl} — booking links would be unreachable for customers.`);
  } else if (!/^https:\/\//i.test(siteUrl)) {
    push("site_url", "NEXT_PUBLIC_SITE_URL", "warn", `${siteUrl} is not https.`);
  } else {
    push("site_url", "NEXT_PUBLIC_SITE_URL", "pass", siteUrl);
  }

  // ---- 6. internal recipient ---------------------------------------------
  const adminRecipient = input?.adminRecipient?.trim();
  if (!adminRecipient) {
    push(
      "admin_recipient",
      "Internal notification address",
      "warn",
      "The `email` site setting is empty, so nobody is copied on new bookings."
    );
  } else if (!looksLikeEmail(adminRecipient)) {
    push("admin_recipient", "Internal notification address", "fail", `"${adminRecipient}" is not a valid address.`);
  } else {
    push("admin_recipient", "Internal notification address", "pass", `${adminRecipient} (from the \`email\` setting).`);
  }

  return { ready: checks.every((c) => c.status !== "fail"), checks };
}
