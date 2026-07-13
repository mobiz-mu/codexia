import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_DEFAULTS } from "@/lib/config/site";
import { withTimeout } from "@/lib/utils/with-timeout";

const RESEND_TIMEOUT_MS = 10_000;

type SendEmailInput = {
  templateKey: string;
  to: string;
  subject: string;
  bookingId?: string;
} & ({ react: ReactElement; html?: never } | { react?: never; html: string });

/**
 * Best-effort send: failures are logged to email_logs and never thrown,
 * so a broken email provider can't block a booking from being created.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const supabase = createAdminClient();

  if (!apiKey) {
    await supabase.from("email_logs").insert({
      template_key: input.templateKey,
      to_email: input.to,
      booking_id: input.bookingId ?? null,
      status: "failed",
      error: "RESEND_API_KEY not configured",
    });
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM ?? `bookings@${SITE_DEFAULTS.domain.replace(/^www\./, "")}`;
    const replyTo = process.env.EMAIL_REPLY_TO ?? SITE_DEFAULTS.email;

    const { error } = await withTimeout(
      resend.emails.send({
        from: `${SITE_DEFAULTS.companyName} <${from}>`,
        to: input.to,
        replyTo,
        subject: input.subject,
        ...(input.react ? { react: input.react } : { html: input.html }),
      }),
      RESEND_TIMEOUT_MS,
      "Resend send"
    );

    if (error) {
      await supabase.from("email_logs").insert({
        template_key: input.templateKey,
        to_email: input.to,
        booking_id: input.bookingId ?? null,
        status: "failed",
        error: error.message,
      });
      return;
    }

    await supabase.from("email_logs").insert({
      template_key: input.templateKey,
      to_email: input.to,
      booking_id: input.bookingId ?? null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    await supabase.from("email_logs").insert({
      template_key: input.templateKey,
      to_email: input.to,
      booking_id: input.bookingId ?? null,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
