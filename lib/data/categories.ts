import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

// Public, admin-managed, rarely-changing content — cached across requests
// for 60s (unstable_cache), and also React.cache()-deduped within a single
// request since categories are read from multiple components on the same
// page (search bar, homepage section, footer nav) in some layouts.
export const getVehicleCategories = cache(
  unstable_cache(
    async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("getVehicleCategories failed", error.message);
        return [];
      }
      return data;
    },
    ["vehicle-categories"],
    { revalidate: 60, tags: ["categories"] }
  )
);

export async function getVehicleCategoryBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_categories")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("getVehicleCategoryBySlug failed", error.message);
    return null;
  }
  return data;
}
