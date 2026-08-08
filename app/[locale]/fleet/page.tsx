import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getVehicles } from "@/lib/data/vehicles";
import { VehicleCard } from "@/components/site/VehicleCard";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";

const POPULAR_SEARCHES = [
  { key: "mauritius", href: "/car-rental/mauritius" },
  { key: "airportRental", href: "/services/airport-rental" },
  { key: "suv", href: "/car-rental/suv" },
  { key: "automatic", href: "/car-rental/automatic" },
  { key: "family", href: "/car-rental/family" },
  { key: "longTerm", href: "/car-rental/long-term" },
] as const;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "fleet" });
  return buildPageMetadata({ locale, path: "/fleet", title: t("title"), description: t("subtitle") });
}

export default async function FleetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("fleet");
  const tCarRental = await getTranslations("carRental");
  const tServices = await getTranslations("services");
  const vehicles = await getVehicles();

  const popularSearchLabels: Record<(typeof POPULAR_SEARCHES)[number]["key"], string> = {
    mauritius: tCarRental("mauritius.breadcrumb"),
    airportRental: tServices("airportRental.title"),
    suv: tCarRental("suv.breadcrumb"),
    automatic: tCarRental("automatic.breadcrumb"),
    family: tCarRental("family.breadcrumb"),
    longTerm: tCarRental("longTerm.breadcrumb"),
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("popularSearches")}</span>
        {POPULAR_SEARCHES.map(({ key, href }) => (
          <Link
            key={key}
            href={href}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark"
          >
            {popularSearchLabels[key]}
          </Link>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <p className="mt-10 text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} priority={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
