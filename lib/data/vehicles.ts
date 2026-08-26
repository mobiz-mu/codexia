import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { publicVehicleFilter } from "@/lib/fleet/availability-rules";
import type { Database } from "@/lib/supabase/types";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleImageRow = Database["public"]["Tables"]["vehicle_images"]["Row"];
type VehicleCategoryRow = Database["public"]["Tables"]["vehicle_categories"]["Row"];

type VehicleCategoryBadge = Pick<VehicleCategoryRow, "slug" | "name_en" | "name_fr">;

/**
 * A note on the prices these rows carry.
 *
 * `vehicles.daily_price_cents` is a TEASER price, not a quote. Every
 * authoritative customer-facing amount — the booking total, the deposit and
 * the PayPal order — descends from `quoteBooking()`, which resolves the rate
 * through `resolveDailyRate()` and never falls back to this column once a
 * vehicle or its category is on tariffs.
 *
 * The listing and card surfaces that read it are deliberately outside that
 * path: they are shown before a date range exists, so no tariff period can be
 * selected yet. Inside the funnel the same distinction is made explicitly —
 * PriceSummary shows this figure only until the server quote arrives, and
 * labels it "Estimated total".
 *
 * The open item is presentational, and tracked as such: with tariffs
 * configured, these teaser figures can differ from the eventual quote, and
 * the cards do not currently say "from".
 */

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
    const { data, error } = await publicVehicleFilter(
      supabase
        .from("vehicles")
        .select("*, vehicle_images(*), vehicle_categories(slug, name_en, name_fr)")
        .eq("featured", true)
    )
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
    let query = publicVehicleFilter(
      supabase.from("vehicles").select("*, vehicle_images(*), vehicle_categories!inner(slug, name_en, name_fr)")
    );

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
  const { data, error } = await publicVehicleFilter(
    supabase.from("vehicles").select("*, vehicle_images(*), vehicle_categories(*)").eq("slug", slug)
  ).maybeSingle();

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
  const { data, error } = await publicVehicleFilter(
    supabase
      .from("vehicles")
      .select("*, vehicle_images(*), vehicle_categories(slug, name_en, name_fr)")
      .eq("category_id", categoryId)
  )
    .neq("id", excludeId)
    .limit(limit);

  if (error) {
    console.error("getRelatedVehicles failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as VehicleWithImages[];
}
