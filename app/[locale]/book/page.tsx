import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getVehicleCategories } from "@/lib/data/categories";
import { getActiveLocations } from "@/lib/data/locations";
import { getBankDetails } from "@/lib/config/get-bank-details";
import { BookingWizard } from "@/components/booking/BookingWizard";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("heroCta") };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const [categories, locations, bankDetails] = await Promise.all([
    getVehicleCategories(),
    getActiveLocations(),
    getBankDetails(),
  ]);

  const getParam = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <BookingWizard
        locale={locale as "en" | "fr"}
        categories={categories.map((c) => ({
          slug: c.slug,
          label: locale === "fr" ? c.name_fr : c.name_en,
        }))}
        locations={locations.map((l) => ({
          id: l.id,
          slug: l.slug,
          label: locale === "fr" ? l.name_fr : l.name_en,
        }))}
        initialCriteria={{
          categorySlug: getParam("category") ?? "",
          pickupLocationSlug: getParam("pickupLocation") ?? "",
          dropoffLocationSlug: getParam("dropoffLocation") ?? "",
          pickupAt: getParam("pickup") ?? "",
          returnAt: getParam("return") ?? "",
          passengers: Number(getParam("passengers") ?? 1),
        }}
        initialVehicleSlug={getParam("vehicle") ?? ""}
        bankDetails={bankDetails}
      />
    </section>
  );
}
