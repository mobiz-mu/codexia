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
  ArrowRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getFeaturedVehicles } from "@/lib/data/vehicles";
import { getVehicleCategories } from "@/lib/data/categories";
import { getActiveLocations } from "@/lib/data/locations";
import { getApprovedReviews } from "@/lib/data/reviews";
import { getFaqCategoriesWithEntries } from "@/lib/data/faq";
import { VehicleCard } from "@/components/site/VehicleCard";
import { SearchBar } from "@/components/site/SearchBar";
import { ReviewsList } from "@/components/site/ReviewsList";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { CategoryCarousel } from "@/components/site/CategoryCarousel";
import { RotatingGallery } from "@/components/site/RotatingGallery";
import { HeroBanner } from "@/components/site/HeroBanner";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { formatMoney } from "@/lib/pricing/format";
import { resolveDeliveryFeeDisplay } from "@/lib/pricing/location-fee";
import { buildPageMetadata } from "@/lib/seo/metadata";
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

const MAURITIUS_GALLERY = [
  {
    src: "/images/mauritius/gallery-1.webp",
    alt_en: "Île aux Cerfs lagoon in Mauritius",
    alt_fr: "Lagon de l'Île aux Cerfs à Maurice",
  },
  {
    src: "/images/mauritius/gallery-2.webp",
    alt_en: "Le Morne mountain and beach, Mauritius",
    alt_fr: "Montagne et plage du Morne, Maurice",
  },
  {
    src: "/images/mauritius/gallery-3.webp",
    alt_en: "Chamarel waterfall surrounded by rainforest, Mauritius",
    alt_fr: "Cascade de Chamarel entourée de forêt tropicale, Maurice",
  },
  {
    src: "/images/mauritius/gallery-4.webp",
    alt_en: "Sir Seewoosagur Ramgoolam International Airport, Mauritius",
    alt_fr: "Aéroport international Sir Seewoosagur Ramgoolam, Maurice",
  },
  {
    src: "/images/mauritius/gallery-5.webp",
    alt_en: "Port Louis city and mountains, Mauritius",
    alt_fr: "Ville de Port-Louis et montagnes, Maurice",
  },
] as const;

const BLOG_POSTS = [
  {
    href: "/mauritius/places-to-visit",
    image: "/images/blog/blog-1.webp",
    title_en: "Top Attractions to Visit in Mauritius",
    title_fr: "Les meilleures attractions à visiter à Maurice",
    excerpt_en: "From the volcanic crater of Trou aux Cerfs to Chamarel's coloured earth, plan your route with a rental that keeps up.",
    excerpt_fr: "Du cratère volcanique de Trou aux Cerfs à la terre colorée de Chamarel, organisez votre itinéraire avec une location adaptée.",
  },
  {
    href: "/mauritius/driving-guide",
    image: "/images/blog/blog-2.webp",
    title_en: "Driving in Mauritius: A Complete Road Guide",
    title_fr: "Conduire à Maurice : le guide complet de la route",
    excerpt_en: "Left-hand driving, speed limits and local etiquette — what to know before you get behind the wheel on the island.",
    excerpt_fr: "Conduite à gauche, limitations de vitesse et usages locaux : ce qu'il faut savoir avant de prendre le volant sur l'île.",
  },
  {
    href: "/mauritius/airport-guide",
    image: "/images/blog/blog-4.webp",
    title_en: "SSR Airport Guide: Arriving and Picking Up Your Car",
    title_fr: "Guide de l'aéroport SSR : arrivée et prise en charge du véhicule",
    excerpt_en: "What to expect on arrival at SSR International Airport, and how free delivery and recovery works with Codexia.",
    excerpt_fr: "À quoi s'attendre à l'arrivée à l'aéroport international SSR, et comment fonctionne la livraison gratuite avec Codexia.",
  },
  {
    href: "/mauritius/travel-tips",
    image: "/images/blog/blog-3.webp",
    title_en: "Mauritius Travel Tips for First-Time Visitors",
    title_fr: "Conseils de voyage à Maurice pour les primo-visiteurs",
    excerpt_en: "Pack light, keep your documents handy, and allow extra time for scenic coastal roads on your first trip.",
    excerpt_fr: "Voyagez léger, gardez vos documents à portée de main et prévoyez du temps pour les routes côtières lors de votre premier séjour.",
  },
] as const;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "home" });
  return buildPageMetadata({ locale, path: "/", title: t("heroTitle"), description: t("heroSubtitle") });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tFooter, tLocations, vehicles, categories, locations, reviews, settings, faqCategories] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("footer"),
      getTranslations("locations"),
      getFeaturedVehicles(15),
      getVehicleCategories(),
      getActiveLocations(),
      getApprovedReviews({ targetType: "homepage", limit: 6 }),
      getSiteSettings(),
      getFaqCategoriesWithEntries(),
    ]);

  const faqPreviewEntries = faqCategories
    .flatMap((category) => category.faq_entries)
    .slice(0, 10)
    .map((entry) => ({
      id: entry.id,
      question: locale === "fr" ? entry.question_fr : entry.question_en,
      answer: locale === "fr" ? entry.answer_fr : entry.answer_en,
    }));

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  // Only emitted when real moderated reviews exist for this page — never
  // fabricated. Sourced from the exact same `reviews` array rendered below
  // by <ReviewsList>, so the structured data always matches visible content.
  const aggregateRating =
    reviews.length > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1),
          reviewCount: reviews.length,
        }
      : undefined;
  const reviewJsonLd =
    reviews.length > 0
      ? reviews.map((r) => ({
          "@type": "Review",
          author: { "@type": "Person", name: r.name },
          reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          reviewBody: r.body,
          datePublished: r.created_at,
        }))
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: settings.companyName,
    url: `${siteUrl}/${locale}`,
    logo: `${siteUrl}/images/codexia-logo.png`,
    image: `${siteUrl}/images/codexia-logo.png`,
    telephone: settings.phone,
    email: settings.email,
    areaServed: "MU",
    address: { "@type": "PostalAddress", addressCountry: "MU" },
    sameAs: [settings.socials.facebook, settings.socials.instagram].filter(Boolean),
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(reviewJsonLd ? { review: reviewJsonLd } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HeroBanner imageSrc="/images/hero/hero-1.webp" imageAlt="Scenic road through Mauritius countryside">
        <div className="max-w-2xl animate-fade-in-up">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-lg text-white/85">{t("heroSubtitle")}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book"
              className="rounded-full bg-action px-7 py-3 text-sm font-semibold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-lg"
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
      </HeroBanner>

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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("featuredTitle")}</h2>
                <p className="mt-2 max-w-2xl text-muted">{t("featuredSubtitle")}</p>
              </div>
              <Link
                href="/fleet"
                className="group inline-flex shrink-0 items-center gap-1.5 bg-gradient-to-r from-primary to-action bg-clip-text text-sm font-semibold text-transparent transition-transform hover:-translate-y-0.5"
              >
                {t("viewAllFleet")}
                <ArrowRight
                  className="h-4 w-4 text-action transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("categoriesTitle")}</h2>
            <div className="mt-8">
              <CategoryCarousel
                categories={categories.map((category) => ({
                  id: category.id,
                  slug: category.slug,
                  name: locale === "fr" ? category.name_fr : category.name_en,
                  imageUrl: publicStorageUrl("category-images", category.image_path),
                }))}
              />
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

      <section className="relative overflow-hidden py-16">
        <Image
          src="/images/sections/why-choose-bg.webp"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-dark/90 via-primary/80 to-action-dark/85"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("whyChooseUsTitle")}</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_US.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-xl border border-white/15 bg-white/95 p-6 shadow-lg backdrop-blur-sm"
              >
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-ink">
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
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
              <PlaneLanding className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">{t("airportHighlightTitle")}</h2>
              <p className="mt-2 max-w-2xl text-muted">{t("airportHighlightText")}</p>
            </div>
          </div>
          <Link
            href="/services/airport-rental"
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                    <span className="rounded-full bg-action-tint px-2 py-0.5 text-[11px] font-semibold text-ink">
                      {(() => {
                        const fee = resolveDeliveryFeeDisplay(location.delivery_fee_cents, location.delivery_fee_currency);
                        if (fee.kind === "free") return tLocations("free");
                        if (fee.kind === "priced") return formatMoney(fee.cents, fee.currency, locale);
                        return tLocations("pricingUnavailable");
                      })()}
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

      {reviews.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("reviewsTitle")}</h2>
            <div className="mt-8">
              <ReviewsList reviews={reviews} emptyLabel="" />
            </div>
          </div>
        </section>
      )}

      <section className="bg-surface py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("aboutMauritius.kicker")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              {t("aboutMauritius.title")}
            </h2>
            <div className="mt-5 flex flex-col gap-4 text-sm leading-relaxed text-body sm:text-base">
              <p>{t("aboutMauritius.paragraph1")}</p>
              <p>{t("aboutMauritius.paragraph2")}</p>
              <p>{t("aboutMauritius.paragraph3")}</p>
            </div>
            <Link
              href="/mauritius"
              className="mt-6 inline-block text-sm font-semibold text-primary-dark"
            >
              {t("aboutMauritius.cta")} →
            </Link>
          </div>
          <RotatingGallery
            images={MAURITIUS_GALLERY.map((item) => ({
              src: item.src,
              alt: locale === "fr" ? item.alt_fr : item.alt_en,
            }))}
          />
        </div>
      </section>

      {faqPreviewEntries.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">{t("faqPreviewTitle")}</h2>
              <p className="mt-2 text-muted">{t("faqPreviewSubtitle")}</p>
            </div>
            <div className="mt-10">
              <FaqAccordion entries={faqPreviewEntries} groupName="home-faq-preview" layout="grid" />
            </div>
            <div className="mt-8 text-center">
              <Link href="/faq" className="inline-block text-sm font-semibold text-primary-dark">
                {t("faqPreviewCta")} →
              </Link>
            </div>
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

      <section className="py-16" aria-labelledby="homepage-blog-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="homepage-blog-heading" className="text-2xl font-bold text-ink sm:text-3xl">
                {t("articlesTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-muted">{t("articlesSubtitle")}</p>
            </div>
            <Link
              href="/mauritius"
              className="group inline-flex shrink-0 items-center gap-1.5 bg-gradient-to-r from-primary to-action bg-clip-text text-sm font-semibold text-transparent transition-transform hover:-translate-y-0.5"
            >
              {t("articlesCta")}
              <ArrowRight
                className="h-4 w-4 text-action transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BLOG_POSTS.map((post) => {
              const title = locale === "fr" ? post.title_fr : post.title_en;
              const excerpt = locale === "fr" ? post.excerpt_fr : post.excerpt_en;
              return (
                <Link
                  key={post.href}
                  href={post.href}
                  className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-md"
                >
                  <article>
                    <div className="relative aspect-[16/9] w-full bg-surface">
                      <Image
                        src={post.image}
                        alt={title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 font-semibold text-ink transition-colors group-hover:text-primary-dark">
                        {title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{excerpt}</p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-ink">{t("finalCtaTitle")}</h2>
        <p className="mt-2 text-muted">{t("finalCtaText")}</p>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-action px-8 py-3 text-sm font-semibold text-ink transition-colors hover:bg-action-dark"
        >
          {t("finalCtaButton")}
        </Link>
      </section>
    </>
  );
}
