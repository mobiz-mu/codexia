import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// React.cache() dedupes repeated calls within a single request — locations
// are read from multiple components on the same page (search bar, footer,
// homepage sections) in some layouts.
export const getActiveLocations = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getActiveLocations failed", error.message);
    return [];
  }
  return data;
});

export async function getLocationBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getLocationBySlug failed", error.message);
    return null;
  }
  return data;
}
