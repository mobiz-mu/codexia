import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_DEFAULTS } from "@/lib/config/site";

type SendEmailInput = {
  templateKey: string;
  to: string;
  subject: string;
  react: ReactElement;
  bookingId?: string;
};

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

    const { error } = await resend.emails.send({
      from: `${SITE_DEFAULTS.companyName} <${from}>`,
      to: input.to,
      replyTo,
      subject: input.subject,
      react: input.react,
    });

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
