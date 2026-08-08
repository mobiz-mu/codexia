"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(5000),
});

export type ContactFormState = {
  status: "idle" | "success" | "error";
};

export async function submitContactMessage(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const rateLimit = await checkRateLimit("submit_contact", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) {
    return { status: "error" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
  });

  if (error) {
    console.error("submitContactMessage failed", error.message);
    return { status: "error" };
  }

  // The Contact Messages admin module is a flat list with no per-message
  // detail route (unlike bookings/compliance) — link to the list, matching
  // the same list-only pattern used by new_review/new_newsletter_subscriber.
  await createNotification(
    "new_contact_message",
    { name: parsed.data.name, subject: parsed.data.subject || null },
    `/admin/messages`
  );

  return { status: "success" };
}
