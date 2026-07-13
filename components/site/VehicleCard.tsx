import { Users, DoorOpen, Luggage, Cog, Fuel, Snowflake } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { formatMoney } from "@/lib/pricing/format";
import { SITE_DEFAULTS } from "@/lib/config/site";

type VehicleCardData = {
  slug: string;
  name: string;
  daily_price_cents: number;
  currency: string;
  passengers: number;
  doors: number;
  luggage: number;
  transmission: string;
  fuel: string;
  air_conditioning: boolean;
  vehicle_images?: { path: string; is_main: boolean; alt_en: string | null }[];
};

export async function VehicleCard({
  vehicle,
  locale,
}: {
  vehicle: VehicleCardData;
  locale: string;
}) {
  const t = await getTranslations("vehicleCard");
  const mainImage = vehicle.vehicle_images?.find((img) => img.is_main) ?? vehicle.vehicle_images?.[0];
  const imageUrl = publicStorageUrl("vehicle-images", mainImage?.path);

  const specs = [
    { icon: Users, label: vehicle.passengers },
    { icon: DoorOpen, label: vehicle.doors },
    { icon: Luggage, label: vehicle.luggage },
    { icon: Cog, label: t(`transmission.${vehicle.transmission}`) },
    { icon: Fuel, label: t(`fuel.${vehicle.fuel}`) },
    ...(vehicle.air_conditioning ? [{ icon: Snowflake, label: t("ac") }] : []),
  ];

  const whatsappHref = `https://wa.me/${SITE_DEFAULTS.whatsappNumber}?text=${encodeURIComponent(
    `${t("whatsappEnquiry")} ${vehicle.name} — ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${locale}/fleet/${vehicle.slug}`
  )}`;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-surface">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={mainImage?.alt_en ?? vehicle.name}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t("noImage")}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-lg font-semibold text-ink">{vehicle.name}</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {specs.map((spec, i) => (
            <li key={i} className="flex items-center gap-1">
              <spec.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {spec.label}
            </li>
          ))}
        </ul>
        <p className="text-xl font-bold text-ink">
          {formatMoney(vehicle.daily_price_cents, vehicle.currency, locale)}
          <span className="text-sm font-normal text-muted"> / {t("day")}</span>
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <Link
            href={`/fleet/${vehicle.slug}`}
            className="flex-1 rounded-full border border-border px-3 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-surface"
          >
            {t("view")}
          </Link>
          <Link
            href={`/book?vehicle=${vehicle.slug}`}
            className="flex-1 rounded-full bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {t("book")}
          </Link>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("whatsappEnquiry")}
            className="flex items-center justify-center rounded-full border border-border p-2 text-[#25D366] transition-colors hover:bg-surface"
          >
            <svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M16.001 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.44 1.73 6.37L3.2 28.8l6.6-1.7a12.75 12.75 0 0 0 6.2 1.58h.001c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.68-12.8-12.68Zm0 23.36a10.5 10.5 0 0 1-5.36-1.47l-.38-.23-3.92 1.01 1.05-3.82-.25-.39a10.53 10.53 0 0 1-1.63-5.66c0-5.85 4.76-10.6 10.6-10.6 2.83 0 5.49 1.1 7.49 3.11a10.5 10.5 0 0 1 3.1 7.49c0 5.85-4.76 10.56-10.6 10.56Z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
