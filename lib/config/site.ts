/**
 * Seed defaults for site_settings (supabase/migrations seed.sql mirrors these).
 * Components must read settings via lib/config/get-site-settings.ts, never these
 * constants directly, so admin-edited values in the database always win.
 */
export interface SiteSettings {
  companyName: string;
  /** Monday opening the first Mauritius week in which Weekly Inspections are required. */
  weeklyInspectionProgramStartDate: string;
  domain: string;
  phone: string;
  whatsapp: string;
  whatsappNumber: string;
  email: string;
  emergencyPhone: string;
  openingHours: string;
  currency: string;
  eurExchangeRate: number;
  depositThresholdEurCents: number;
  depositMidTierMaxEurCents: number;
  depositMidTierAmountEurCents: number;
  depositHighTierAmountEurCents: number;
  insuranceExcessCents: number;
  deliveryFeeNonAirportCents: number;
  minDriverAge: number;
  maxDriverAge: number;
  minLicenceYears: number;
  returnGraceMinutes: number;
  socials: {
    facebook: string;
    instagram: string;
  };
  googleMapsUrl: string;
}

export const SITE_DEFAULTS: SiteSettings = {
  companyName: "Codexia Ltd",
  weeklyInspectionProgramStartDate: "2026-08-24",
  domain: "www.codexia.mu",
  phone: "+230 52811999",
  whatsapp: "+230 52811999",
  whatsappNumber: "23052811999",
  email: "info@codexia.mu",
  emergencyPhone: "+230 5253 2101",
  openingHours: "24/7 including public holidays",
  currency: "EUR",
  eurExchangeRate: 47.5,
  depositThresholdEurCents: 100_00,
  depositMidTierMaxEurCents: 400_00,
  depositMidTierAmountEurCents: 100_00,
  depositHighTierAmountEurCents: 200_00,
  insuranceExcessCents: 62500,
  deliveryFeeNonAirportCents: 1500,
  minDriverAge: 19,
  maxDriverAge: 70,
  minLicenceYears: 1,
  returnGraceMinutes: 60,
  socials: {
    facebook: "",
    instagram: "",
  },
  googleMapsUrl: "",
};
