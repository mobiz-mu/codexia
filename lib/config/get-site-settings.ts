import { cache } from "react";
import { SITE_DEFAULTS, type SiteSettings } from "./site";
import { createClient } from "@/lib/supabase/server";

function pick<T>(row: Record<string, unknown> | undefined, fallback: T): T {
  return row?.value !== undefined ? (row.value as T) : fallback;
}

// React.cache() dedupes repeated calls within a single request/render pass —
// pages that render many VehicleCards (each of which reads settings for its
// WhatsApp link) would otherwise issue one DB round-trip per card.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("site_settings").select("key, value");

    if (error || !data) return SITE_DEFAULTS;

    const rows = Object.fromEntries(data.map((row) => [row.key, row]));

    return {
      companyName: pick(rows.company_name, SITE_DEFAULTS.companyName),
      weeklyInspectionProgramStartDate: pick(
        rows.weekly_inspection_program_start_date,
        SITE_DEFAULTS.weeklyInspectionProgramStartDate
      ),
      domain: pick(rows.domain, SITE_DEFAULTS.domain),
      phone: pick(rows.phone, SITE_DEFAULTS.phone),
      whatsapp: pick(rows.whatsapp, SITE_DEFAULTS.whatsapp),
      whatsappNumber: pick(rows.whatsapp_number, SITE_DEFAULTS.whatsappNumber),
      email: pick(rows.email, SITE_DEFAULTS.email),
      emergencyPhone: pick(rows.emergency_phone, SITE_DEFAULTS.emergencyPhone),
      openingHours: pick(rows.opening_hours, SITE_DEFAULTS.openingHours),
      currency: pick(rows.currency, SITE_DEFAULTS.currency),
      eurExchangeRate: pick(rows.eur_exchange_rate, SITE_DEFAULTS.eurExchangeRate),
      depositThresholdEurCents: pick(rows.deposit_threshold_eur_cents, SITE_DEFAULTS.depositThresholdEurCents),
      depositMidTierMaxEurCents: pick(rows.deposit_mid_tier_max_eur_cents, SITE_DEFAULTS.depositMidTierMaxEurCents),
      depositMidTierAmountEurCents: pick(
        rows.deposit_mid_tier_amount_eur_cents,
        SITE_DEFAULTS.depositMidTierAmountEurCents
      ),
      depositHighTierAmountEurCents: pick(
        rows.deposit_high_tier_amount_eur_cents,
        SITE_DEFAULTS.depositHighTierAmountEurCents
      ),
      insuranceExcessCents: pick(rows.insurance_excess_cents, SITE_DEFAULTS.insuranceExcessCents),
      deliveryFeeNonAirportCents: pick(
        rows.delivery_fee_non_airport_cents,
        SITE_DEFAULTS.deliveryFeeNonAirportCents
      ),
      minDriverAge: pick(rows.min_driver_age, SITE_DEFAULTS.minDriverAge),
      maxDriverAge: pick(rows.max_driver_age, SITE_DEFAULTS.maxDriverAge),
      minLicenceYears: pick(rows.min_licence_years, SITE_DEFAULTS.minLicenceYears),
      returnGraceMinutes: pick(rows.return_grace_minutes, SITE_DEFAULTS.returnGraceMinutes),
      socials: {
        facebook: pick(rows.social_facebook, SITE_DEFAULTS.socials.facebook),
        instagram: pick(rows.social_instagram, SITE_DEFAULTS.socials.instagram),
      },
      googleMapsUrl: pick(rows.google_maps_url, SITE_DEFAULTS.googleMapsUrl),
    };
  } catch {
    return SITE_DEFAULTS;
  }
});
