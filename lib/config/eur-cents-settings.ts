/**
 * site_settings keys that are stored as EUR cents but should be displayed
 * and edited as a plain EUR amount (e.g. "100.00") in the admin Settings
 * form, rather than the raw integer cents value — used by both the form
 * (display) and the update action (parsing back to cents on save).
 */
export const EUR_CENTS_SETTINGS_LABELS: Record<string, string> = {
  deposit_threshold_eur_cents: "Full payment threshold",
  deposit_mid_tier_max_eur_cents: "Mid-tier maximum",
  deposit_mid_tier_amount_eur_cents: "Mid-tier deposit",
  deposit_high_tier_amount_eur_cents: "High-tier deposit",
};

export function isEurCentsSetting(key: string): boolean {
  return key in EUR_CENTS_SETTINGS_LABELS;
}
