"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { isEurCentsSetting } from "@/lib/config/eur-cents-settings";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { sendEmail } from "@/lib/email/send";
import {
  READINESS_TEST_TEMPLATE_KEY,
  checkEmailReadiness,
  type EmailReadiness,
} from "@/lib/email/readiness";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listSettingsAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("*").order("key", { ascending: true });
  return data ?? [];
}

export type SettingsFormState = { status: "idle" | "success" | "error"; error?: string };

export async function updateSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("site_settings").select("key, value_type");

  const invalidKeys: string[] = [];
  const updates = (settings ?? []).map((setting) => {
    const raw = formData.get(setting.key);
    let value: unknown;
    if (setting.value_type === "boolean") {
      value = raw === "true";
    } else if (setting.value_type === "number" && isEurCentsSetting(setting.key)) {
      const eur = Number.parseFloat(String(raw ?? ""));
      if (!Number.isFinite(eur) || eur < 0) {
        invalidKeys.push(setting.key);
        value = 0;
      } else {
        value = Math.round(eur * 100);
      }
    } else if (setting.value_type === "number") {
      value = Number(raw ?? 0);
    } else {
      value = String(raw ?? "");
    }
    return { key: setting.key, value };
  });

  if (invalidKeys.length > 0) {
    return { status: "error", error: `Invalid EUR amount for: ${invalidKeys.join(", ")}` };
  }

  const results = await Promise.all(
    updates.map(({ key, value }) =>
      supabase.from("site_settings").update({ value, updated_by: user.id }).eq("key", key),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("updateSettings failed", failed.error.message);
    return { status: "error", error: "Failed to save some settings." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "settings_updated",
    entity: "site_settings",
    entity_id: null,
    diff: { keys: (settings ?? []).map((s) => s.key) },
  });

  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Email readiness
//
// Deliberately separated from updateSettings: this reports on the ENVIRONMENT
// the code is running in, not on anything stored in site_settings. A local
// .env file proves nothing about what Vercel holds, so the check has to be
// runnable from the deployment being asked about.
// ---------------------------------------------------------------------------

export async function getEmailReadiness(): Promise<EmailReadiness> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const settings = await getSiteSettings();
  return checkEmailReadiness({ adminRecipient: settings.email });
}

export type TestEmailState = { status: "idle" | "sent" | "error"; message?: string };

const testEmailSchema = z.object({
  to: z.email({ message: "Enter a valid email address." }),
});

/**
 * Send exactly one diagnostic email to an address the operator types in.
 *
 * The only way to prove delivery is to deliver something, but that must never
 * mean mailing a customer. This takes an explicit address rather than reading
 * one from a booking, and it writes through the ordinary sendEmail() path so
 * the result lands in email_logs like any other send — a `sent` row here is
 * the same evidence a real booking confirmation would produce.
 */
export async function sendReadinessTestEmail(
  _prev: TestEmailState,
  formData: FormData
): Promise<TestEmailState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const parsed = testEmailSchema.safeParse({ to: formData.get("to") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const settings = await getSiteSettings();
  const readiness = await checkEmailReadiness({ adminRecipient: settings.email });
  if (!readiness.ready) {
    // Sending anyway would just add another `failed` row and tell us nothing
    // we do not already know from the checks above.
    return {
      status: "error",
      message: "Resolve the failing readiness checks first — a send now would only fail again.",
    };
  }

  const sentAtLabel = new Date().toISOString();
  await sendEmail({
    templateKey: READINESS_TEST_TEMPLATE_KEY,
    to: parsed.data.to,
    subject: `${settings.companyName} — email delivery test`,
    html:
      `<p>This is a configuration test sent from the ${settings.companyName} admin console.</p>` +
      `<p>If you are reading it, this deployment can send email: the Resend credential works, ` +
      `the sender domain is accepted, and the pipeline writes to <code>email_logs</code> correctly.</p>` +
      `<p>No customer received a copy of this message.</p>` +
      `<p style="color:#667;font-size:12px">Requested by ${user.email} at ${sentAtLabel}.</p>`,
  });

  const supabase = createAdminClient();
  const { data: log } = await supabase
    .from("email_logs")
    .select("status, error")
    .eq("template_key", READINESS_TEST_TEMPLATE_KEY)
    .eq("to_email", parsed.data.to)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "email_readiness_test_sent",
    entity: "email_logs",
    entity_id: null,
    diff: { to: parsed.data.to, result: log?.status ?? "unknown" },
  });

  // sendEmail never throws — the log row is the only honest source of truth.
  if (log?.status === "sent") {
    return { status: "sent", message: `Delivered to ${parsed.data.to} and recorded in the email log.` };
  }
  return {
    status: "error",
    message: log?.error ? `Resend rejected the send: ${log.error}` : "The send did not complete. Check the email log.",
  };
}
