import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Builds canonical + hreflang alternates for a bilingual page. `pathWithoutLocale`
 * is the locale-agnostic path (e.g. "/fleet/nissan-march", or "" for the homepage).
 */
export function buildAlternates(
  locale: string,
  pathWithoutLocale: string,
  canonicalOverride?: string | null
): Metadata["alternates"] {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const path = pathWithoutLocale === "/" ? "" : pathWithoutLocale;

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`])
  ) as Record<string, string>;
  languages["x-default"] = `${siteUrl}/${routing.defaultLocale}${path}`;

  return {
    canonical: canonicalOverride || `${siteUrl}/${locale}${path}`,
    languages,
  };
}
