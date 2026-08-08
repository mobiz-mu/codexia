import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { Heart, Award, ShieldCheck, Clock, ShieldAlert, TrendingUp, Palmtree } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/metadata";

const VALUES = [
  { key: "customerFirst", icon: Heart },
  { key: "excellence", icon: Award },
  { key: "trust", icon: ShieldCheck },
  { key: "reliability", icon: Clock },
  { key: "safety", icon: ShieldAlert },
  { key: "improvement", icon: TrendingUp },
  { key: "hospitality", icon: Palmtree },
] as const;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "about" });
  return buildPageMetadata({ locale, path: "/about", title: t("title"), description: t("intro1") });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <p className="animate-fade-in-up text-sm font-semibold uppercase tracking-wide text-primary">
          {t("kicker")}
        </p>
        <h1 className="animate-fade-in-up mt-3 text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <div className="animate-fade-in-up mx-auto mt-8 flex max-w-2xl flex-col gap-5 text-left text-base leading-relaxed text-body sm:text-lg">
          <p className="font-medium text-ink">{t("intro1")}</p>
          <p>{t("intro2")}</p>
          <p>{t("intro3")}</p>
          <p>{t("intro4")}</p>
        </div>
      </section>

      <section className="relative overflow-hidden py-20 sm:py-28">
        <Image
          src="/images/mauritius/gallery-2.webp"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-dark/92 via-primary/85 to-action-dark/90"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("missionTitle")}</h2>
          <p className="mt-5 text-lg font-medium text-white/95">{t("missionText1")}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/85 sm:text-base">{t("missionText2")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">{t("valuesTitle")}</h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="animate-fade-in-up flex flex-col items-start gap-3 rounded-2xl border border-border bg-background p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-semibold text-ink">{t(`values.${key}.title`)}</h3>
              <p className="text-sm text-muted">{t(`values.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
