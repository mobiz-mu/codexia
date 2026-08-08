"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listReviewsAdmin(status?: string) {
  const user = await requireAdminUser();
  assertPermission(user, "approve_reviews");

  const supabase = createAdminClient();
  let query = supabase
    .from("reviews")
    .select("id, name, country, rating, status, body, admin_reply, featured")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status as "pending" | "approved" | "rejected" | "hidden");

  const { data } = await query;
  return data ?? [];
}

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export async function moderateReview(
  id: string,
  status: "approved" | "rejected" | "hidden"
): Promise<ReviewActionResult> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_reviews");

  const supabase = createAdminClient();
  const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Failed to update review." };

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: `review_${status}`,
    entity: "reviews",
    entity_id: id,
  });

  return { ok: true };
}

export async function toggleReviewFeatured(id: string, featured: boolean): Promise<ReviewActionResult> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_reviews");

  const supabase = createAdminClient();
  const { error } = await supabase.from("reviews").update({ featured }).eq("id", id);
  if (error) return { ok: false, error: "Failed to update review." };
  return { ok: true };
}

export async function replyToReview(id: string, reply: string): Promise<ReviewActionResult> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_reviews");

  const supabase = createAdminClient();
  const { error } = await supabase.from("reviews").update({ admin_reply: reply }).eq("id", id);
  if (error) return { ok: false, error: "Failed to save reply." };
  return { ok: true };
}
