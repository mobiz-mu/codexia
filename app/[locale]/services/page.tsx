import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("title"), description: t("intro") };
}

const SERVICES = ["airportRental", "delivery", "insurance"] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{t("intro")}</p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {SERVICES.map((key) => (
          <div key={key} className="rounded-xl border border-border bg-background p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">{t(`${key}.title`)}</h2>
            <p className="mt-2 text-sm text-muted">{t(`${key}.text`)}</p>
          </div>
        ))}
      </div>

      <Link
        href="/book"
        className="mt-10 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        {t("title")}
      </Link>
    </section>
  );
}
