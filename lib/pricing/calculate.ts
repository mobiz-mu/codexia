export type PriceLineItem = {
  key: string;
  label: string;
  amountCents: number;
};

export type PriceBreakdown = {
  days: number;
  lineItems: PriceLineItem[];
  totalCents: number;
  depositCents: number;
  currency: string;
  /**
   * Provenance of the per-day rate, carried into the booking's stored
   * pricing snapshot so a historic booking can always be explained: which
   * tariff period priced it, and at which duration tier. Optional because
   * bookings taken before tariffs existed have no such provenance.
   */
  rate?: {
    dailyRateCents: number;
    source: "tariff" | "legacy_fallback";
    tariffPeriodId: string | null;
    tariffPeriodLabel: string | null;
    durationTier: number | null;
  };
};

export function daysBetween(pickupAt: Date, returnAt: Date): number {
  const ms = returnAt.getTime() - pickupAt.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function calculateBookingPrice(input: {
  dailyPriceCents: number;
  currency: string;
  pickupAt: Date;
  returnAt: Date;
  pickupDeliveryFeeCents: number;
  dropoffDeliveryFeeCents: number;
  depositCents: number;
  taxRatePercent: number;
  extras: { nameEn: string; priceCents: number; pricingMode: "per_day" | "flat"; quantity: number }[];
  rate?: PriceBreakdown["rate"];
}): PriceBreakdown {
  const days = daysBetween(input.pickupAt, input.returnAt);
  const lineItems: PriceLineItem[] = [];

  lineItems.push({
    key: "vehicle",
    label: `Vehicle rental (${days} day${days > 1 ? "s" : ""})`,
    amountCents: input.dailyPriceCents * days,
  });

  for (const extra of input.extras) {
    if (extra.quantity <= 0) continue;
    const amount =
      extra.pricingMode === "per_day"
        ? extra.priceCents * days * extra.quantity
        : extra.priceCents * extra.quantity;
    lineItems.push({ key: `extra:${extra.nameEn}`, label: extra.nameEn, amountCents: amount });
  }

  const deliveryFee = input.pickupDeliveryFeeCents + input.dropoffDeliveryFeeCents;
  if (deliveryFee > 0) {
    lineItems.push({ key: "delivery", label: "Delivery / recovery fee", amountCents: deliveryFee });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amountCents, 0);

  if (input.taxRatePercent > 0) {
    const taxCents = Math.round(subtotal * (input.taxRatePercent / 100));
    lineItems.push({ key: "tax", label: `Tax (${input.taxRatePercent}%)`, amountCents: taxCents });
  }

  const totalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    days,
    lineItems,
    totalCents,
    depositCents: input.depositCents,
    currency: input.currency,
    ...(input.rate ? { rate: input.rate } : {}),
  };
}
