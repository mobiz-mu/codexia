import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysIso, computeComplianceStatus, isAlarmStatus } from "@/lib/compliance/status";
import { createNotification } from "@/lib/notifications/create";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { sendEmail } from "@/lib/email/send";

/**
 * The daily compliance-expiry alert sweep.
 *
 * Lives here rather than in lib/actions/admin/compliance.ts because that
 * module is a "use server" module: every export from one becomes a remotely
 * callable Server Action, and this function checks no permission of its own.
 * As an action it was an unauthenticated-by-role endpoint that reads the
 * fleet's compliance position and sends mail. Its only legitimate caller is
 * app/api/cron/compliance-alerts/route.ts, which enforces CRON_SECRET, so the
 * endpoint should never have existed.
 *
 * Kept separate from the route handler as well, so it stays unit-testable
 * without faking HTTP requests.
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ComplianceAlertCheckResult = {
  checked: number;
  newAlerts: number;
  emailSent: boolean;
};

export async function runComplianceAlertCheck(): Promise<ComplianceAlertCheckResult> {
  const supabase = createAdminClient();
  const today = todayIso();
  const in30 = addDaysIso(today, 30);

  const { data } = await supabase
    .from("vehicle_compliance_current")
    .select("id, vehicle_id, document_type, custom_type, expiry_date, vehicles(name)")
    .lte("expiry_date", in30)
    .order("expiry_date", { ascending: true });

  const rows = (data ?? []) as unknown as {
    id: string;
    vehicle_id: string;
    document_type: string;
    custom_type: string | null;
    expiry_date: string;
    vehicles: { name: string } | null;
  }[];

  let newAlerts = 0;
  const newlyAlerted: { vehicleName: string; documentType: string; customType: string | null; expiryDate: string; daysRemaining: number; status: string }[] = [];

  for (const row of rows) {
    const { status, daysRemaining } = computeComplianceStatus(row.expiry_date, today);
    if (!isAlarmStatus(status)) continue;

    // Insert-first idempotency guarantee — identical pattern to
    // reminder_logs: the unique(compliance_record_id, alert_date)
    // constraint is what actually prevents a duplicate alert if this cron
    // is invoked twice on the same day, not the absence of a prior
    // check-query race.
    const { error: insertError } = await supabase.from("vehicle_compliance_alert_logs").insert({
      compliance_record_id: row.id,
      alert_date: today,
      status_at_alert: status,
    });
    if (insertError) continue; // already alerted today for this record — skip

    newAlerts++;
    const vehicleName = row.vehicles?.name ?? "Vehicle";
    const documentType = row.document_type === "other" ? row.custom_type ?? "Other" : row.document_type;
    const link = `/admin/compliance/${row.id}`;
    const payload = { vehicleName, documentType, expiryDate: row.expiry_date, daysRemaining, status };

    // Upsert-by-link rather than always inserting: a document alarming for
    // 20 straight days must show ONE current notification with today's
    // day-count, not 20 nearly-identical rows. read_at is reset to null on
    // each refresh — the day-count changing is genuinely new information
    // worth re-surfacing, not the same alert being re-shown.
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("link", link)
      .is("archived_at", null)
      .maybeSingle();

    if (existing) {
      await supabase.from("notifications").update({ payload, read_at: null }).eq("id", existing.id);
    } else {
      await createNotification("compliance_expiry", payload, link);
    }

    newlyAlerted.push({ vehicleName, documentType, customType: row.custom_type, expiryDate: row.expiry_date, daysRemaining, status });
  }

  let emailSent = false;
  if (newlyAlerted.length > 0) {
    const settings = await getSiteSettings();
    if (settings.email) {
      const lines = newlyAlerted
        .map((a) => {
          const dayLabel = a.daysRemaining < 0 ? `${Math.abs(a.daysRemaining)} day(s) overdue` : a.daysRemaining === 0 ? "expires today" : `${a.daysRemaining} day(s) remaining`;
          return `${a.vehicleName} — ${a.documentType} — expires ${a.expiryDate} (${dayLabel})`;
        })
        .join("\n");

      await sendEmail({
        to: settings.email,
        templateKey: "compliance_expiry_digest",
        subject: `Codexia: ${newlyAlerted.length} compliance document(s) need attention`,
        html: `<p>The following compliance documents require attention:</p><pre>${lines.replace(/</g, "&lt;")}</pre>`,
      });
      emailSent = true;
    }
  }

  return { checked: rows.length, newAlerts, emailSent };
}
