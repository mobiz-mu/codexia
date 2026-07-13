import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "mauritius" });
  return { title: t("title"), description: t("intro") };
}

const SECTIONS = ["placesToVisit", "drivingGuide", "airportGuide", "travelTips"] as const;
const SECTION_HREFS: Record<(typeof SECTIONS)[number], string> = {
  placesToVisit: "/mauritius/places-to-visit",
  drivingGuide: "/mauritius/driving-guide",
  airportGuide: "/mauritius/airport-guide",
  travelTips: "/mauritius/travel-tips",
};

export default async function MauritiusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mauritius");

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{t("intro")}</p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {SECTIONS.map((key) => (
          <Link
            key={key}
            href={SECTION_HREFS[key]}
            className="rounded-xl border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-ink">{t(`${key}.title`)}</h2>
            <p className="mt-2 text-sm text-muted">{t(`${key}.text`)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
