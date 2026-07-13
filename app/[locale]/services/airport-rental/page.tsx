import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("airportRental.title"), description: t("airportRental.text") };
}

export default async function AirportRentalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: t("title"), href: "/services" },
          { label: t("airportRental.title") },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {t("airportRental.title")}
      </h1>
      <p className="mt-4 text-lg text-ink">{t("airportRental.text")}</p>

      <Link
        href="/book"
        className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        {t("title")}
      </Link>
    </section>
  );
}
