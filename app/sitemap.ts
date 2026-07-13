import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getVehicles } from "@/lib/data/vehicles";
import { getVehicleCategories } from "@/lib/data/categories";
import { getActiveLocations } from "@/lib/data/locations";
import { getPublishedPosts } from "@/lib/data/blog";
import { getPolicyPages } from "@/lib/data/policies";

const STATIC_PATHS = [
  "",
  "/about",
  "/contact",
  "/fleet",
  "/categories",
  "/locations",
  "/services",
  "/services/airport-rental",
  "/mauritius",
  "/mauritius/airport-guide",
  "/mauritius/driving-guide",
  "/mauritius/places-to-visit",
  "/mauritius/travel-tips",
  "/blog",
  "/faq",
  "/book",
];

function entry(siteUrl: string, path: string, lastModified?: string): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`]));
  return {
    url: `${siteUrl}/${routing.defaultLocale}${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const [vehicles, categories, locations, posts, policies] = await Promise.all([
    getVehicles(),
    getVehicleCategories(),
    getActiveLocations(),
    getPublishedPosts(),
    getPolicyPages(),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => entry(siteUrl, path));

  for (const vehicle of vehicles) {
    entries.push(entry(siteUrl, `/fleet/${vehicle.slug}`, vehicle.updated_at));
  }
  for (const category of categories) {
    entries.push(entry(siteUrl, `/categories/${category.slug}`, category.updated_at));
  }
  for (const location of locations) {
    entries.push(entry(siteUrl, `/locations/${location.slug}`, location.updated_at));
  }
  for (const post of posts) {
    entries.push(entry(siteUrl, `/blog/${post.slug}`, post.updated_at));
  }
  for (const policy of policies ?? []) {
    entries.push(entry(siteUrl, `/policies/${policy.slug}`, policy.created_at));
  }

  return entries;
}
