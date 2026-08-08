import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { MapPin, CheckCircle2, Users } from "lucide-react";
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
  const t = await getTranslations({ locale, namespace: "carRental.mauritius" });
  return buildPageMetadata({
    locale,
    path: "/car-rental/mauritius",
    title: t("title"),
    description: t("metaDescription"),
  });
}

export default async function MauritiusCarRentalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("carRental.mauritius");
  const tShared = await getTranslations("carRental");
  const tCommon = await getTranslations("common");
  const vehicles = await getVehicles();

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs locale={locale} items={[{ label: tCommon("home"), href: "/" }, { label: t("breadcrumb") }]} />
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      </div>
      <p className="mt-4 max-w-3xl text-lg text-ink">{t("intro")}</p>

      <UseCaseHighlights
        highlights={[
          { icon: MapPin, title: t("highlight1Title"), text: t("highlight1Text") },
          { icon: CheckCircle2, title: t("highlight2Title"), text: t("highlight2Text") },
          { icon: Users, title: t("highlight3Title"), text: t("highlight3Text") },
        ]}
      />

      <UseCaseVehicleGrid
        vehicles={vehicles}
        locale={locale}
        emptyLabel={t("emptyVehicles")}
        viewFleetLabel={tShared("viewFullFleet")}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted">{t("closing")}</p>

      <Link
        href="/book"
        className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
      >
        {tShared("bookCta")}
      </Link>
    </section>
  );
}
