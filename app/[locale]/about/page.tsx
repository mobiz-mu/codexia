import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "about" });
  return buildPageMetadata({ locale, path: "/about", title: t("title"), description: t("intro") });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  const values = ["experience", "transparency", "support", "coverage"] as const;

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted">{t("intro")}</p>

      <h2 className="mt-10 text-xl font-semibold text-ink">{t("missionTitle")}</h2>
      <p className="mt-3 text-ink">{t("missionText")}</p>

      <h2 className="mt-10 text-xl font-semibold text-ink">{t("valuesTitle")}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {values.map((key) => (
          <li
            key={key}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-ink"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-action-dark" aria-hidden="true" />
            {t(`values.${key}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
