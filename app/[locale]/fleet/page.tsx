import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getVehicles } from "@/lib/data/vehicles";
import { VehicleCard } from "@/components/site/VehicleCard";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "fleet" });
  return buildPageMetadata({ locale, path: "/fleet", title: t("title"), description: t("subtitle") });
}

export default async function FleetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("fleet");
  const vehicles = await getVehicles();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      {vehicles.length === 0 ? (
        <p className="mt-10 text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
