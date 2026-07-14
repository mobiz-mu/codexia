import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import {
  Fuel,
  ShieldCheck,
  PhoneCall,
  PlaneLanding,
  Clock,
  Search,
  CreditCard,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getFeaturedVehicles } from "@/lib/data/vehicles";
import { getVehicleCategories } from "@/lib/data/categories";
import { getActiveLocations } from "@/lib/data/locations";
import { getApprovedReviews } from "@/lib/data/reviews";
import { getPublishedPosts } from "@/lib/data/blog";
import { getFaqCategoriesWithEntries } from "@/lib/data/faq";
import { VehicleCard } from "@/components/site/VehicleCard";
import { SearchBar } from "@/components/site/SearchBar";
import { ReviewsList } from "@/components/site/ReviewsList";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { formatMoney } from "@/lib/pricing/format";
import { buildAlternates } from "@/lib/seo/alternates";
import { getSiteSettings } from "@/lib/config/get-site-settings";

const WHY_CHOOSE_US = [
  { key: "mileage", icon: Fuel },
  { key: "insurance", icon: ShieldCheck },
  { key: "assistance", icon: PhoneCall },
  { key: "delivery", icon: PlaneLanding },
] as const;

const TRUST_INDICATORS = [
  { key: "experience", icon: Clock },
  { key: "insurance", icon: ShieldCheck },
  { key: "support", icon: PhoneCall },
  { key: "delivery", icon: PlaneLanding },
] as const;

const HOW_IT_WORKS = [
  { key: "step1", icon: Search },
  { key: "step2", icon: CreditCard },
  { key: "step3", icon: PlaneLanding },
  { key: "step4", icon: CheckCircle2 },
] as const;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  return { alternates: buildAlternates(locale, "/") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tFooter, tLocations, vehicles, categories, locations, reviews, posts, settings, faqCategories] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("footer"),
      getTranslations("locations"),
      getFeaturedVehicles(),
      getVehicleCategories(),
      getActiveLocations(),
      getApprovedReviews({ targetType: "homepage", limit: 6 }),
      getPublishedPosts(3),
      getSiteSettings(),
      getFaqCategoriesWithEntries(),
    ]);

  const faqPreviewEntries = faqCategories
    .flatMap((category) => category.faq_entries)
    .slice(0, 4)
    .map((entry) => ({
      id: entry.id,
      question: locale === "fr" ? entry.question_fr : entry.question_en,
      answer: locale === "fr" ? entry.answer_fr : entry.answer_en,
    }));

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: settings.companyName,
    url: `${siteUrl}/${locale}`,
    telephone: settings.phone,
    email: settings.email,
    areaServed: "MU",
    sameAs: [settings.socials.facebook, settings.socials.instagram].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-[#0a5f85] py-20 lg:py-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl animate-fade-in-up">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 text-lg text-white/85">{t("heroSubtitle")}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="rounded-full bg-action px-7 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-lg"
              >
                {t("heroBookNow")}
              </Link>
              <Link
                href="/fleet"
                className="rounded-full border-2 border-white/70 px-7 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                {t("heroViewFleet")}
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/90">
              {TRUST_INDICATORS.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-white/80" aria-hidden="true" />
                  {t(`trustIndicators.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 pb-8 sm:px-6 lg:-mt-12 lg:px-8 lg:pb-4">
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

      {categories.length > 0 && (
        <section className="py-16">
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
                      <h3 className="font-semibold text-ink group-hover:text-action-dark">{name}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/categories"
              className="mt-8 inline-block rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary-dark"
            >
              {t("categoriesCta")}
            </Link>
          </div>
        </section>
      )}

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("howItWorksTitle")}</h2>
          <p className="mt-2 text-muted">{t("howItWorksSubtitle")}</p>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ key, icon: Icon }, i) => (
              <div key={key} className="relative flex flex-col items-start gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-ink">{t(`howItWorks.${key}.title`)}</h3>
                <p className="text-sm text-muted">{t(`howItWorks.${key}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-tint py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <PlaneLanding className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">{t("airportHighlightTitle")}</h2>
              <p className="mt-2 max-w-2xl text-muted">{t("airportHighlightText")}</p>
            </div>
          </div>
          <Link
            href="/services/airport-rental"
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-md"
          >
            {t("airportHighlightCta")}
          </Link>
        </div>
      </section>

      {locations.length > 0 && (
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("popularLocationsTitle")}</h2>
            <p className="mt-2 text-muted">{t("popularLocationsSubtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {locations.map((location) => {
                const name = locale === "fr" ? location.name_fr : location.name_en;
                return (
                  <Link
                    key={location.id}
                    href={`/locations/${location.slug}`}
                    className="group flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition-colors hover:border-primary hover:text-primary-dark"
                  >
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    {name}
                    <span className="rounded-full bg-action-tint px-2 py-0.5 text-[11px] font-semibold text-action-dark">
                      {location.delivery_fee_cents === 0
                        ? tLocations("free")
                        : formatMoney(location.delivery_fee_cents, "EUR", locale)}
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/locations"
              className="mt-8 inline-block rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary-dark"
            >
              {t("popularLocationsCta")}
            </Link>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl rounded-xl border border-border bg-background p-8">
            <h2 className="text-xl font-bold text-ink">{t("aboutCodexiaTitle")}</h2>
            <p className="mt-3 text-muted">{t("aboutCodexiaText")}</p>
            <Link href="/about" className="mt-4 inline-block text-sm font-semibold text-primary-dark">
              {t("aboutCodexiaCta")} →
            </Link>
          </div>
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

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl rounded-xl border border-border bg-background p-8">
            <h2 className="text-xl font-bold text-ink">{t("aboutMauritiusTitle")}</h2>
            <p className="mt-3 text-muted">{t("aboutMauritiusText")}</p>
            <Link href="/mauritius" className="mt-4 inline-block text-sm font-semibold text-primary-dark">
              {t("aboutMauritiusCta")} →
            </Link>
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                      {imageUrl && (
                        <Image
                          src={imageUrl}
                          alt={title}
                          fill
                          className="object-cover"
                          sizes="(min-width: 640px) 33vw, 100vw"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-ink group-hover:text-action-dark">{title}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {faqPreviewEntries.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("faqPreviewTitle")}</h2>
            <div className="mt-8">
              <FaqAccordion entries={faqPreviewEntries} />
            </div>
            <Link
              href="/faq"
              className="mt-6 inline-block text-sm font-semibold text-primary-dark"
            >
              {t("faqPreviewCta")} →
            </Link>
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
          className="mt-6 inline-block rounded-full bg-action px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-action-dark"
        >
          {t("finalCtaButton")}
        </Link>
      </section>
    </>
  );
}
