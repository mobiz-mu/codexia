import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
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

// Public, RLS-anon-readable, admin-managed content that changes rarely and
// doesn't need per-request freshness — cached for 60s via a cookie-free
// client (unstable_cache can't access cookies()/headers()). Booking,
// admin, and anything session-scoped is deliberately never cached here.
export const getFeaturedVehicles = unstable_cache(
  async (limit = 6): Promise<VehicleWithImages[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*, vehicle_images(*), vehicle_categories(slug, name_en, name_fr)")
      .eq("featured", true)
      .eq("status", "active")
      .eq("currency", "EUR")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getFeaturedVehicles failed", error.message);
      return [];
    }
    return (data ?? []) as unknown as VehicleWithImages[];
  },
  ["featured-vehicles"],
  { revalidate: 60, tags: ["vehicles"] }
);

export const getVehicles = unstable_cache(
  async (options?: {
    categorySlug?: string;
    transmission?: "manual" | "automatic";
    minPassengers?: number;
    longTermOnly?: boolean;
  }): Promise<VehicleWithImages[]> => {
    const supabase = createPublicClient();
    let query = supabase
      .from("vehicles")
      .select("*, vehicle_images(*), vehicle_categories!inner(slug, name_en, name_fr)")
      .eq("status", "active")
      .eq("currency", "EUR")
      .is("deleted_at", null);

    if (options?.categorySlug) {
      query = query.eq("vehicle_categories.slug", options.categorySlug);
    }
    if (options?.transmission) {
      query = query.eq("transmission", options.transmission);
    }
    if (options?.minPassengers) {
      query = query.gte("passengers", options.minPassengers);
    }
    if (options?.longTermOnly) {
      query = query.not("weekly_price_cents", "is", null);
    }

    const { data, error } = await query.order("daily_price_cents", { ascending: true });

    if (error) {
      console.error("getVehicles failed", error.message);
      return [];
    }
    return (data ?? []) as unknown as VehicleWithImages[];
  },
  ["fleet-vehicles"],
  { revalidate: 60, tags: ["vehicles"] }
);

export async function getVehicleBySlug(slug: string): Promise<VehicleWithDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("currency", "EUR")
    .is("deleted_at", null)
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
    .eq("status", "active")
    .eq("currency", "EUR")
    .is("deleted_at", null)
    .neq("id", excludeId)
    .limit(limit);

  if (error) {
    console.error("getRelatedVehicles failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as VehicleWithImages[];
}
