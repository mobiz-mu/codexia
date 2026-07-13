import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVehicleCategoryBySlug } from "@/lib/data/categories";
import { getVehicles } from "@/lib/data/vehicles";
import { VehicleCard } from "@/components/site/VehicleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const category = await getVehicleCategoryBySlug(slug);
  if (!category) return {};

  const name = locale === "fr" ? category.name_fr : category.name_en;
  const description = locale === "fr" ? category.description_fr : category.description_en;
  return { title: name, description: description ?? undefined };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const category = await getVehicleCategoryBySlug(slug);
  if (!category) notFound();

  const [t, vehicles] = await Promise.all([
    getTranslations("categories"),
    getVehicles({ categorySlug: slug }),
  ]);

  const name = locale === "fr" ? category.name_fr : category.name_en;
  const description = locale === "fr" ? category.description_fr : category.description_en;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: t("title"), href: "/categories" },
          { label: name },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{name}</h1>
      {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} />
        ))}
      </div>
    </section>
  );
}
