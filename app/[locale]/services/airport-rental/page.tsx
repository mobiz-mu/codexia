import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PlaneLanding, Clock, Car } from "lucide-react";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { UseCaseHighlights } from "@/components/site/UseCaseHighlights";
import { UseCaseVehicleGrid } from "@/components/site/UseCaseVehicleGrid";
import { Link } from "@/i18n/navigation";
import { getVehicles } from "@/lib/data/vehicles";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "services" });
  return buildPageMetadata({
    locale,
    path: "/services/airport-rental",
    title: t("airportRental.pageTitle"),
    description: t("airportRental.metaDescription"),
  });
}

export default async function AirportRentalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");
  const tCommon = await getTranslations("common");
  const vehicles = await getVehicles();

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tCommon("home"), href: "/" },
          { label: t("title"), href: "/services" },
          { label: t("airportRental.title") },
        ]}
      />
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
          <PlaneLanding className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("airportRental.pageTitle")}
        </h1>
      </div>
      <p className="mt-4 max-w-3xl text-lg text-ink">{t("airportRental.intro")}</p>

      <UseCaseHighlights
        highlights={[
          { icon: PlaneLanding, title: t("airportRental.highlight1Title"), text: t("airportRental.highlight1Text") },
          { icon: Clock, title: t("airportRental.highlight2Title"), text: t("airportRental.highlight2Text") },
          { icon: Car, title: t("airportRental.highlight3Title"), text: t("airportRental.highlight3Text") },
        ]}
      />

      <UseCaseVehicleGrid
        vehicles={vehicles}
        locale={locale}
        emptyLabel={t("airportRental.emptyVehicles")}
        viewFleetLabel={t("bookCta")}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted">{t("airportRental.closing")}</p>

      <Link
        href="/book"
        className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
      >
        {t("bookCta")}
      </Link>
    </section>
  );
}
