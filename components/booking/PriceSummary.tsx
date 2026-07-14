"use client";

import { useTranslations } from "next-intl";
import { Car } from "lucide-react";
import { formatMoney } from "@/lib/pricing/format";
import { daysBetween } from "@/lib/pricing/calculate";
import type { PriceBreakdown } from "@/lib/pricing/calculate";
import type { VehicleWithImages } from "@/lib/data/vehicles";

export function PriceSummary({
  vehicle,
  pickupAt,
  returnAt,
  breakdown,
  locale,
}: {
  vehicle: VehicleWithImages | null;
  pickupAt: string;
  returnAt: string;
  breakdown: PriceBreakdown | null;
  locale: string;
}) {
  const t = useTranslations("booking.priceSummary");
  const s = useTranslations("booking.summaryStep");

  if (!vehicle) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted">
        {t("selectPrompt")}
      </div>
    );
  }

  const nights =
    pickupAt && returnAt ? daysBetween(new Date(pickupAt), new Date(returnAt)) : 1;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
          <Car className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{vehicle.name}</p>
          <p className="text-xs text-muted">
            {nights} {nights === 1 ? t("night") : t("nights")}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {breakdown ? (
          <>
            <ul className="flex flex-col gap-1.5 text-sm">
              {breakdown.lineItems.map((item) => (
                <li key={item.key} className="flex justify-between gap-3 text-ink">
                  <span className="text-muted">{item.label}</span>
                  <span>{formatMoney(item.amountCents, breakdown.currency, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold text-ink">
              <span>{s("total")}</span>
              <span className="text-action-dark">
                {formatMoney(breakdown.totalCents, breakdown.currency, locale)}
              </span>
            </div>
            {breakdown.depositCents > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{s("deposit")}</span>
                <span>{formatMoney(breakdown.depositCents, breakdown.currency, locale)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between font-semibold text-ink">
              <span>{t("estimatedTotal")}</span>
              <span className="text-action-dark">
                {formatMoney(vehicle.daily_price_cents * nights, vehicle.currency, locale)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">{t("estimateNote")}</p>
          </>
        )}
      </div>
    </div>
  );
}
