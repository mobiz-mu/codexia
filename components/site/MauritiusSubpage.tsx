import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MapPin, Car, PlaneLanding, Lightbulb } from "lucide-react";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";

type MauritiusSectionKey = "placesToVisit" | "drivingGuide" | "airportGuide" | "travelTips";

const SECTION_PATHS: Record<MauritiusSectionKey, string> = {
  placesToVisit: "/mauritius/places-to-visit",
  drivingGuide: "/mauritius/driving-guide",
  airportGuide: "/mauritius/airport-guide",
  travelTips: "/mauritius/travel-tips",
};

const SECTION_ICONS: Record<MauritiusSectionKey, typeof MapPin> = {
  placesToVisit: MapPin,
  drivingGuide: Car,
  airportGuide: PlaneLanding,
  travelTips: Lightbulb,
};

export async function getMauritiusSubpageMetadata(
  locale: string,
  sectionKey: MauritiusSectionKey
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "mauritius" });
  return buildPageMetadata({
    locale,
    path: SECTION_PATHS[sectionKey],
    title: t(`${sectionKey}.title`),
    description: t(`${sectionKey}.text`),
  });
}

export async function MauritiusSubpage({
  sectionKey,
  locale,
}: {
  sectionKey: MauritiusSectionKey;
  locale: string;
}) {
  const t = await getTranslations("mauritius");
  const Icon = SECTION_ICONS[sectionKey];

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: "Home", href: "/" },
          { label: t("title"), href: "/mauritius" },
          { label: t(`${sectionKey}.title`) },
        ]}
      />
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t(`${sectionKey}.title`)}
        </h1>
      </div>
      <p className="mt-4 text-lg text-ink">{t(`${sectionKey}.text`)}</p>
    </section>
  );
}
