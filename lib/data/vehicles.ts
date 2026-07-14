import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleImageRow = Database["public"]["Tables"]["vehicle_images"]["Row"];
type VehicleCategoryRow = Database["public"]["Tables"]["vehicle_categories"]["Row"];

type VehicleCategoryBadge = Pick<VehicleCategoryRow, "slug" | "name_en" | "name_fr">;

export type VehicleWithImages = VehicleRow & {
  vehicle_images: VehicleImageRow[];
  vehicle_categories?: VehicleCategoryBadge | null;
};
export type VehicleWithDetails = VehicleRow & {
  vehicle_images: VehicleImageRow[];
  vehicle_categories: VehicleCategoryRow;
};

export async function getFeaturedVehicles(limit = 6): Promise<VehicleWithImages[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories(slug, name_en, name_fr)")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getFeaturedVehicles failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as VehicleWithImages[];
}

export async function getVehicles(options?: { categorySlug?: string }): Promise<VehicleWithImages[]> {
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories!inner(slug, name_en, name_fr)");

  if (options?.categorySlug) {
    query = query.eq("vehicle_categories.slug", options.categorySlug);
  }

  const { data, error } = await query.order("daily_price_cents", { ascending: true });

  if (error) {
    console.error("getVehicles failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as VehicleWithImages[];
}

export async function getVehicleBySlug(slug: string): Promise<VehicleWithDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getVehicleBySlug failed", error.message);
    return null;
  }
  return data as unknown as VehicleWithDetails | null;
}

export async function getRelatedVehicles(
  categoryId: string,
  excludeId: string,
  limit = 3
): Promise<VehicleWithImages[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories(slug, name_en, name_fr)")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .limit(limit);

  if (error) {
    console.error("getRelatedVehicles failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as VehicleWithImages[];
}
