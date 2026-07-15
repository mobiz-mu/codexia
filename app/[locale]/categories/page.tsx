import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getVehicleCategories } from "@/lib/data/categories";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "categories" });
  return buildPageMetadata({ locale, path: "/categories", title: t("title"), description: t("subtitle") });
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("categories");
  const categories = await getVehicleCategories();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const imageUrl = publicStorageUrl("category-images", category.image_path);
          const name = locale === "fr" ? category.name_fr : category.name_en;
          const description = locale === "fr" ? category.description_fr : category.description_en;

          return (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] w-full bg-surface">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">
                    {name}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="text-lg font-semibold text-ink group-hover:text-action-dark">
                  {name}
                </h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                <span className="mt-3 inline-block text-sm font-semibold text-action-dark">
                  {t("viewVehicles")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
