import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { MapPin, Car, PlaneLanding, Lightbulb } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "mauritius" });
  return { title: t("title"), description: t("intro"), alternates: buildAlternates(locale, "/mauritius") };
}

const SECTIONS = [
  { key: "placesToVisit", href: "/mauritius/places-to-visit", icon: MapPin },
  { key: "drivingGuide", href: "/mauritius/driving-guide", icon: Car },
  { key: "airportGuide", href: "/mauritius/airport-guide", icon: PlaneLanding },
  { key: "travelTips", href: "/mauritius/travel-tips", icon: Lightbulb },
] as const;

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
        {SECTIONS.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-background p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-ink group-hover:text-primary-dark">{t(`${key}.title`)}</h2>
            <p className="text-sm text-muted">{t(`${key}.text`)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
