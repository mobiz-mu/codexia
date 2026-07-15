import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PlaneLanding, Truck, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "services" });
  return buildPageMetadata({ locale, path: "/services", title: t("title"), description: t("intro") });
}

const SERVICES = [
  { key: "airportRental", icon: PlaneLanding, href: "/services/airport-rental" },
  { key: "delivery", icon: Truck, href: "/locations" },
  { key: "insurance", icon: ShieldCheck, href: "/policies/insurance" },
] as const;

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
        {SERVICES.map(({ key, icon: Icon, href }) => (
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

      <Link
        href="/book"
        className="mt-10 inline-block rounded-full bg-action px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
      >
        {t("bookCta")}
      </Link>
    </section>
  );
}
