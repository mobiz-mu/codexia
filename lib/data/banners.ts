import { createClient } from "@/lib/supabase/server";

export async function getActiveHeroBanners() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_banners")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getActiveHeroBanners failed", error.message);
    return [];
  }
  return data;
}
