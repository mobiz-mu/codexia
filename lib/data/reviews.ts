import { createClient } from "@/lib/supabase/server";

export async function getApprovedReviews(options?: {
  targetType?: "vehicle" | "post" | "homepage";
  targetId?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let query = supabase.from("public_reviews").select("*").order("created_at", { ascending: false });

  if (options?.targetType) query = query.eq("target_type", options.targetType);
  if (options?.targetId) query = query.eq("target_id", options.targetId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;

  if (error) {
    console.error("getApprovedReviews failed", error.message);
    return [];
  }
  return data;
}
