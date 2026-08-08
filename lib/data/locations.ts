import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

// Public, admin-managed, rarely-changing content — cached across requests
// for 60s (unstable_cache), and also React.cache()-deduped within a single
// request since locations are read from multiple components on the same
// page (search bar, footer, homepage sections) in some layouts.
export const getActiveLocations = cache(
  unstable_cache(
    async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("active", true)
        .is("deleted_at", null)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("getActiveLocations failed", error.message);
        return [];
      }
      return data;
    },
    ["active-locations"],
    { revalidate: 60, tags: ["locations"] }
  )
);

export async function getLocationBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("getLocationBySlug failed", error.message);
    return null;
  }
  return data;
}
