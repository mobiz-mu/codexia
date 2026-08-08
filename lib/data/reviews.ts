import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Public, moderated content — cached across requests. A newly-approved
// review can take up to 60s to appear on the public site.
export const getApprovedReviews = unstable_cache(
  async (options?: { targetType?: "vehicle" | "post" | "homepage"; targetId?: string; limit?: number }) => {
    const supabase = createPublicClient();
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
  },
  ["approved-reviews"],
  { revalidate: 60, tags: ["reviews"] }
);
