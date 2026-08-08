import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocationBySlug } from "@/lib/data/locations";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/pricing/format";
import { resolveDeliveryFeeDisplay } from "@/lib/pricing/location-fee";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const location = await getLocationBySlug(slug);
  if (!location) {
    const t = await getTranslations({ locale, namespace: "notFound" });
    return { ...(await buildPageMetadata({ locale, path: `/locations/${slug}`, title: t("title"), description: t("description") })), robots: { index: false } };
  }

  const name = locale === "fr" ? location.name_fr : location.name_en;
  const description = locale === "fr" ? location.description_fr : location.description_en;
  return buildPageMetadata({
    locale,
    path: `/locations/${slug}`,
    title: name,
    description: description ?? undefined,
    canonicalOverride: location.canonical_path,
    image: publicStorageUrl("company", location.hero_image_path),
    imageAlt: name,
  });
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  const t = await getTranslations("locations");
  const tCommon = await getTranslations("common");
  const name = locale === "fr" ? location.name_fr : location.name_en;
  const description = locale === "fr" ? location.description_fr : location.description_en;

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tCommon("home"), href: "/" },
          { label: t("title"), href: "/locations" },
          { label: name },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{name}</h1>
      {description && <p className="mt-4 text-muted">{description}</p>}

      <p className="mt-4 text-sm font-medium text-ink">
        {t("deliveryFee")}:{" "}
        {(() => {
          const fee = resolveDeliveryFeeDisplay(location.delivery_fee_cents, location.delivery_fee_currency);
          if (fee.kind === "free") return t("free");
          if (fee.kind === "priced") return formatMoney(fee.cents, fee.currency, locale);
          return t("pricingUnavailable");
        })()}
      </p>

      <Link
        href={`/book?location=${location.slug}`}
        className="mt-8 inline-block rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-action-dark"
      >
        {t("title")}
      </Link>
    </section>
  );
}
