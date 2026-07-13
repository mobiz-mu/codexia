import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Users, DoorOpen, Luggage, Cog, Fuel, Snowflake, Bluetooth, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getVehicleBySlug, getRelatedVehicles } from "@/lib/data/vehicles";
import { getApprovedReviews } from "@/lib/data/reviews";
import { getFaqCategoriesWithEntries } from "@/lib/data/faq";
import { VehicleCard } from "@/components/site/VehicleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ReviewsList } from "@/components/site/ReviewsList";
import { ReviewForm } from "@/components/site/ReviewForm";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { formatMoney } from "@/lib/pricing/format";
import { SITE_DEFAULTS } from "@/lib/config/site";
import { trackVehicleView } from "@/lib/analytics/track";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return {};

  const description = locale === "fr" ? vehicle.description_fr : vehicle.description_en;
  return {
    title: vehicle.name,
    description: description ?? undefined,
    alternates: buildAlternates(locale, `/fleet/${slug}`, vehicle.canonical_path),
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [t, tFleet, tReview, related, reviews, faqCategories] = await Promise.all([
    getTranslations("vehicleDetail"),
    getTranslations("fleet"),
    getTranslations("reviewForm"),
    getRelatedVehicles(vehicle.category_id, vehicle.id),
    getApprovedReviews({ targetType: "vehicle", targetId: vehicle.id }),
    getFaqCategoriesWithEntries(),
    trackVehicleView(vehicle.id, locale),
  ]);

  const description = locale === "fr" ? vehicle.description_fr : vehicle.description_en;
  const images = vehicle.vehicle_images ?? [];
  const mainImage = images.find((img: { is_main: boolean }) => img.is_main) ?? images[0];
  const mainImageUrl = publicStorageUrl("vehicle-images", mainImage?.path);

  const specs = [
    { icon: Users, label: `${vehicle.passengers} passengers` },
    { icon: DoorOpen, label: `${vehicle.doors} doors` },
    { icon: Luggage, label: `${vehicle.luggage} bags` },
    { icon: Cog, label: vehicle.transmission },
    { icon: Fuel, label: vehicle.fuel },
    ...(vehicle.air_conditioning ? [{ icon: Snowflake, label: "A/C" }] : []),
    ...(vehicle.bluetooth ? [{ icon: Bluetooth, label: "Bluetooth" }] : []),
    ...(vehicle.gps ? [{ icon: MapPin, label: "GPS" }] : []),
  ];

  const faqEntries = faqCategories.flatMap((category: { faq_entries: { id: string; question_en: string; question_fr: string; answer_en: string; answer_fr: string }[] }) =>
    category.faq_entries.map((entry) => ({
      id: entry.id,
      question: locale === "fr" ? entry.question_fr : entry.question_en,
      answer: locale === "fr" ? entry.answer_fr : entry.answer_en,
    }))
  );

  const whatsappHref = `https://wa.me/${SITE_DEFAULTS.whatsappNumber}?text=${encodeURIComponent(
    `Hi Codexia, I'd like to ask about the ${vehicle.name}.`
  )}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: vehicle.name,
    description: description ?? undefined,
    image: mainImageUrl ?? undefined,
    offers: {
      "@type": "Offer",
      price: (vehicle.daily_price_cents / 100).toFixed(2),
      priceCurrency: vehicle.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { label: "Home", href: "/" },
          { label: tFleet("title"), href: "/fleet" },
          { label: vehicle.name },
        ]}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface">
            {mainImageUrl ? (
              <Image
                src={mainImageUrl}
                alt={mainImage?.alt_en ?? vehicle.name}
                fill
                className="object-cover"
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No photo yet</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.slice(0, 4).map((img: { path: string; alt_en: string | null }, i: number) => {
                const url = publicStorageUrl("vehicle-images", img.path);
                if (!url) return null;
                return (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                    <Image
                      src={url}
                      alt={img.alt_en ?? vehicle.name}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 12vw, 25vw"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{vehicle.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {vehicle.brand} {vehicle.model} · {vehicle.year}
            </p>
          </div>

          <p className="text-2xl font-bold text-ink">
            {formatMoney(vehicle.daily_price_cents, vehicle.currency, locale)}
            <span className="text-base font-normal text-muted"> / day</span>
          </p>

          {vehicle.is_demo && (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">{t("demoNotice")}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/book?vehicle=${vehicle.slug}`}
              className="flex-1 rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {t("bookCta")}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full border border-border px-6 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-surface"
            >
              {t("whatsappCta")}
            </a>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t("specsTitle")}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 text-sm text-ink sm:grid-cols-3">
              {specs.map((spec, i) => (
                <li key={i} className="flex items-center gap-2">
                  <spec.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {spec.label}
                </li>
              ))}
            </ul>
          </div>

          {description && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {t("descriptionTitle")}
              </h2>
              <p className="mt-3 text-sm text-ink">{description}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-ink">{t("relatedTitle")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((v) => (
              <VehicleCard key={v.id} vehicle={v} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-16">
        <h2 className="text-2xl font-bold text-ink">{t("reviewsTitle")}</h2>
        <div className="mt-6">
          <ReviewsList reviews={reviews} emptyLabel={t("reviewsEmpty")} />
        </div>
        <div className="mt-6 max-w-xl">
          <ReviewForm
            targetType="vehicle"
            targetId={vehicle.id}
            labels={{
              title: tReview("title"),
              name: tReview("name"),
              email: tReview("email"),
              country: tReview("country"),
              rating: tReview("rating"),
              body: tReview("body"),
              consent: tReview("consent"),
              submit: tReview("submit"),
              success: tReview("success"),
            }}
          />
        </div>
      </div>

      {faqEntries.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-ink">{t("faqTitle")}</h2>
          <div className="mt-6">
            <FaqAccordion entries={faqEntries} />
          </div>
        </div>
      )}
    </section>
  );
}
