import { createClient } from "@/lib/supabase/server";

export async function getActiveLocations() {
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
}

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
