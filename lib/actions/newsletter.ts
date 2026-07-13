"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const subscribeSchema = z.object({
  email: z.email().max(320),
  locale: z.enum(["en", "fr"]),
});

export type NewsletterFormState = {
  status: "idle" | "success" | "error";
};

export async function subscribeToNewsletter(
  _prevState: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const rateLimit = await checkRateLimit("subscribe_newsletter", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) {
    return { status: "error" };
  }

  const parsed = subscribeSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("newsletter_subscribers").upsert(
    {
      email: parsed.data.email,
      locale: parsed.data.locale,
      status: "subscribed",
      source: "footer",
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("subscribeToNewsletter failed", error.message);
    return { status: "error" };
  }

  await createNotification("new_newsletter_subscriber", { email: parsed.data.email }, `/admin/newsletter`);

  return { status: "success" };
}
