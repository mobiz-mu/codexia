import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// React.cache() dedupes repeated calls within a single request — categories
// are read from multiple components on the same page (search bar, homepage
// section, footer nav) in some layouts.
export const getVehicleCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_categories")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getVehicleCategories failed", error.message);
    return [];
  }
  return data;
});

export async function getVehicleCategoryBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getVehicleCategoryBySlug failed", error.message);
    return null;
  }
  return data;
}
