import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Fuel, ShieldCheck, PhoneCall, PlaneLanding } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getFeaturedVehicles } from "@/lib/data/vehicles";
import { getVehicleCategories } from "@/lib/data/categories";
import { getActiveLocations } from "@/lib/data/locations";
import { getApprovedReviews } from "@/lib/data/reviews";
import { getPublishedPosts } from "@/lib/data/blog";
import { VehicleCard } from "@/components/site/VehicleCard";
import { SearchBar } from "@/components/site/SearchBar";
import { ReviewsList } from "@/components/site/ReviewsList";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { publicStorageUrl } from "@/lib/supabase/storage";

const WHY_CHOOSE_US = [
  { key: "mileage", icon: Fuel },
  { key: "insurance", icon: ShieldCheck },
  { key: "assistance", icon: PhoneCall },
  { key: "delivery", icon: PlaneLanding },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tFooter, vehicles, categories, locations, reviews, posts] = await Promise.all([
    getTranslations("home"),
    getTranslations("footer"),
    getFeaturedVehicles(),
    getVehicleCategories(),
    getActiveLocations(),
    getApprovedReviews({ targetType: "homepage", limit: 6 }),
    getPublishedPosts(3),
  ]);

  return (
    <>
      <section className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-lg text-muted">{t("heroSubtitle")}</p>
        </div>
        <SearchBar
          categories={categories.map((c) => ({
            slug: c.slug,
            label: locale === "fr" ? c.name_fr : c.name_en,
          }))}
          locations={locations.map((l) => ({
            slug: l.slug,
            label: locale === "fr" ? l.name_fr : l.name_en,
          }))}
        />
      </section>

      {vehicles.length > 0 && (
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("featuredTitle")}</h2>
            <p className="mt-2 text-muted">{t("featuredSubtitle")}</p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} />
              ))}
            </div>
            <Link
              href="/fleet"
              className="mt-8 inline-block rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-background"
            >
              {t("viewAllFleet")}
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("whyChooseUsTitle")}</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE_US.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-border bg-background p-6">
              <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-ink">{t(`whyChooseUs.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted">{t(`whyChooseUs.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("categoriesTitle")}</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const imageUrl = publicStorageUrl("category-images", category.image_path);
                const name = locale === "fr" ? category.name_fr : category.name_en;
                return (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[16/9] w-full bg-background">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted">
                          {name}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-ink group-hover:text-primary-dark">{name}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-xl border border-border bg-background p-8">
          <h2 className="text-xl font-bold text-ink">{t("aboutCodexiaTitle")}</h2>
          <p className="mt-3 text-muted">{t("aboutCodexiaText")}</p>
          <Link href="/about" className="mt-4 inline-block text-sm font-semibold text-primary-dark">
            {t("aboutCodexiaCta")} →
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-background p-8">
          <h2 className="text-xl font-bold text-ink">{t("aboutMauritiusTitle")}</h2>
          <p className="mt-3 text-muted">{t("aboutMauritiusText")}</p>
          <Link href="/mauritius" className="mt-4 inline-block text-sm font-semibold text-primary-dark">
            {t("aboutMauritiusCta")} →
          </Link>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("reviewsTitle")}</h2>
            <div className="mt-8">
              <ReviewsList reviews={reviews} emptyLabel="" />
            </div>
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("articlesTitle")}</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {posts.map((post) => {
              const imageUrl = publicStorageUrl("blog", post.featured_image_path);
              const title = locale === "fr" ? post.title_fr : post.title_en;
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] w-full bg-surface">
                    {imageUrl && <Image src={imageUrl} alt={title} fill className="object-cover" />}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-ink group-hover:text-primary-dark">{title}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-ink">{t("newsletterTitle")}</h2>
          <p className="mt-2 text-muted">{t("newsletterText")}</p>
          <div className="mt-6 text-left">
            <NewsletterForm
              variant="light"
              labels={{
                heading: tFooter("newsletter.heading"),
                placeholder: tFooter("newsletter.placeholder"),
                submit: tFooter("newsletter.submit"),
                success: tFooter("newsletter.success"),
                error: tFooter("newsletter.error"),
              }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-ink">{t("finalCtaTitle")}</h2>
        <p className="mt-2 text-muted">{t("finalCtaText")}</p>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t("finalCtaButton")}
        </Link>
      </section>
    </>
  );
}
