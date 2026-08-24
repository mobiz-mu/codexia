import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TariffPeriod } from "./tariff";

/**
 * Load every active tariff period that could govern a vehicle — its own and
 * its category's — together with their pickup-location links.
 *
 * Deliberately NOT filtered by date. The resolver needs the unfiltered set
 * to tell "this vehicle is on tariffs but this date is uncovered" (a
 * configuration error) apart from "this vehicle was never put on tariffs"
 * (the legacy flat rate still applies). Filtering here would collapse those
 * two cases and reintroduce the silent stale-price bug.
 */
export async function loadTariffPeriodsForVehicle(
  supabase: SupabaseClient,
  vehicleId: string,
  categoryId: string | null
): Promise<TariffPeriod[]> {
  const scopeFilter = categoryId
    ? `vehicle_id.eq.${vehicleId},category_id.eq.${categoryId}`
    : `vehicle_id.eq.${vehicleId}`;

  const { data: rows, error } = await supabase
    .from("vehicle_tariff_periods")
    .select(
      "id, vehicle_id, category_id, label, effective_from, effective_to, active, rate_1_day_cents, rate_3_day_cents, rate_4_day_cents, rate_7_day_cents, rate_14_day_cents, rate_21_plus_day_cents"
    )
    .eq("active", true)
    .or(scopeFilter);

  if (error) throw new Error(`Could not load tariff periods: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const { data: links } = await supabase
    .from("vehicle_tariff_period_locations")
    .select("tariff_period_id, location_id")
    .in(
      "tariff_period_id",
      rows.map((r) => r.id)
    );

  const linksByPeriod = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = linksByPeriod.get(link.tariff_period_id) ?? [];
    list.push(link.location_id);
    linksByPeriod.set(link.tariff_period_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    categoryId: row.category_id,
    label: row.label,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    active: row.active,
    locationIds: linksByPeriod.get(row.id) ?? [],
    rate1DayCents: row.rate_1_day_cents,
    rate3DayCents: row.rate_3_day_cents,
    rate4DayCents: row.rate_4_day_cents,
    rate7DayCents: row.rate_7_day_cents,
    rate14DayCents: row.rate_14_day_cents,
    rate21PlusDayCents: row.rate_21_plus_day_cents,
  }));
}

/** Customer-facing wording for each way a rate can fail to resolve. */
export function messageForUnavailableRate(reason: "duration_not_offered" | "tariff_gap" | "no_rate_configured"): string {
  switch (reason) {
    case "duration_not_offered":
      return "This vehicle is not available for a rental of this length on these dates. Please try a longer rental or different dates.";
    case "tariff_gap":
    case "no_rate_configured":
      // Never expose that pricing is misconfigured, and never guess a price.
      return "This vehicle is not currently available for the dates you selected. Please contact us and we will arrange it for you.";
  }
}
