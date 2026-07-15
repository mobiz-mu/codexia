import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildAlternates } from "./alternates";

const OG_IMAGE_PATH = "/images/og/codexia-og.jpg";
const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Builds a full per-page Metadata object: title, description, canonical +
 * hreflang alternates, and page-specific Open Graph / Twitter Card data.
 *
 * Next.js does not deep-merge `openGraph`/`twitter` across the layout
 * hierarchy — a page that omits them entirely inherits the parent layout's
 * whole object verbatim (title, url, everything). Every public page must
 * call this so its social preview reflects its own content, not the
 * homepage's.
 */
export async function buildPageMetadata({
  locale,
  path,
  title,
  description,
  canonicalOverride,
  image,
  imageAlt: imageAltOverride,
}: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  canonicalOverride?: string | null;
  /** Absolute or root-relative URL of a content-specific image (e.g. a vehicle photo). Falls back to the shared OG image. */
  image?: string | null;
  imageAlt?: string;
}): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const normalizedPath = path === "/" ? "" : path;
  const imageAlt =
    imageAltOverride ??
    (locale === "fr"
      ? `${settings.companyName}, location de voitures à Maurice`
      : `${settings.companyName} car rental in Mauritius`);
  const imageUrl = image || OG_IMAGE_PATH;

  return {
    title,
    description,
    alternates: buildAlternates(locale, path, canonicalOverride),
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_MU" : "en_MU",
      alternateLocale: locale === "fr" ? ["en_MU"] : ["fr_MU"],
      url: canonicalOverride || `${siteUrl}/${locale}${normalizedPath}`,
      siteName: settings.companyName,
      title,
      description,
      images: [{ url: imageUrl, ...(image ? {} : OG_IMAGE_SIZE), alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
