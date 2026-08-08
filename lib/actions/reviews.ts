"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const reviewSchema = z.object({
  targetType: z.enum(["vehicle", "post", "homepage"]),
  targetId: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
  // An unchecked checkbox is omitted from FormData entirely — .default(false)
  // lets parsing succeed so the specific "please confirm consent" message
  // below is actually reachable, instead of failing earlier with the
  // generic "check the form" error.
  consent: z.coerce.boolean().default(false),
  // honeypot: real users never fill this hidden field
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ReviewFormState = { status: "idle" | "success" | "error"; error?: string };

export async function submitReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const rateLimit = await checkRateLimit("submit_review", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) {
    return { status: "error", error: "Too many submissions. Please try again later." };
  }

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: "Please check the form for errors." };
  }

  if (parsed.data.website) {
    // Honeypot tripped — pretend success so bots don't learn to avoid it.
    return { status: "success" };
  }

  if (!parsed.data.consent) {
    return { status: "error", error: "Please confirm you consent to your review being published." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("reviews").insert({
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId || null,
    name: parsed.data.name,
    email: parsed.data.email,
    country: parsed.data.country || null,
    rating: parsed.data.rating,
    body: parsed.data.body,
    consent: parsed.data.consent,
    status: "pending",
  });

  if (error) {
    console.error("submitReview failed", error.message);
    return { status: "error", error: "Something went wrong. Please try again." };
  }

  await createNotification("new_review", { name: parsed.data.name, rating: parsed.data.rating }, `/admin/reviews`);

  return { status: "success" };
}
