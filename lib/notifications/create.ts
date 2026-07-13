import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "new_booking"
  | "new_payment_proof"
  | "new_review"
  | "new_contact_message"
  | "new_newsletter_subscriber"
  | "failed_email";

export async function createNotification(
  type: NotificationType,
  payload: Record<string, unknown>,
  link?: string
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    type,
    payload,
    link: link ?? null,
  });
  if (error) {
    console.error("createNotification failed", error.message);
  }
}
