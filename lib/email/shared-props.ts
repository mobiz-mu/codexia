import "server-only";
import type { SiteSettings } from "@/lib/config/site";

/** Common header/footer props every customer-facing email template shares. */
export function buildEmailBrandProps(settings: SiteSettings, siteUrl: string, whatsappText: string) {
  return {
    logoUrl: `${siteUrl}/images/codexia-logo.png`,
    siteUrl,
    supportEmail: process.env.EMAIL_REPLY_TO ?? "support@codexia.mu",
    whatsappUrl: `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(whatsappText)}`,
    mapsUrl: settings.googleMapsUrl || undefined,
    socials: {
      facebook: settings.socials.facebook || undefined,
      instagram: settings.socials.instagram || undefined,
    },
  };
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
