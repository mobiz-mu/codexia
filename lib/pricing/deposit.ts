/**
 * EUR-native tiered deposit rule — the single source of truth for how much
 * of a booking is due now vs. deferred to collection. Every caller (booking
 * quote, PayPal order creation, capture verification, webhook fallback,
 * emails, invoices, admin payment details) must go through this function
 * rather than re-deriving the tiers itself.
 *
 *   total < fullPaymentThreshold        → pay the full total now
 *   threshold <= total <= midTierMax    → pay the mid-tier deposit
 *   total > midTierMax                  → pay the high-tier deposit
 *
 * All four boundaries are admin-configurable (site_settings), never
 * hardcoded — see lib/config/site.ts for the field names.
 */
export type DepositTier = "full" | "mid" | "high";

export type DepositBreakdown = {
  bookingTotalCents: number;
  currency: string;
  depositTier: DepositTier;
  /** Amount recorded as paid, in the booking's own currency. */
  depositCents: number;
  /** The EUR amount actually charged via PayPal (== depositCents when currency is already EUR). */
  amountDueNowCents: number;
  remainingBalanceCents: number;
};

export type DepositTierSettings = {
  depositThresholdEurCents: number;
  depositMidTierMaxEurCents: number;
  depositMidTierAmountEurCents: number;
  depositHighTierAmountEurCents: number;
};

function resolveTier(
  totalEurCents: number,
  settings: DepositTierSettings
): { tier: DepositTier; rawAmountEurCents: number } {
  // Defensive against misconfigured admin settings (negative/NaN values,
  // or a mid-tier max set below the full-payment threshold) — never throw,
  // never let a bad setting produce a negative amount.
  const threshold = Math.max(0, settings.depositThresholdEurCents || 0);
  const midMax = Math.max(0, settings.depositMidTierMaxEurCents || 0);
  const midAmount = Math.max(0, settings.depositMidTierAmountEurCents || 0);
  const highAmount = Math.max(0, settings.depositHighTierAmountEurCents || 0);

  if (totalEurCents < threshold) {
    return { tier: "full", rawAmountEurCents: totalEurCents };
  }
  if (totalEurCents <= midMax) {
    return { tier: "mid", rawAmountEurCents: midAmount };
  }
  return { tier: "high", rawAmountEurCents: highAmount };
}

export function computeDeposit(
  input: {
    totalCents: number;
    currency: string;
    /** Legacy bridge only — see below. Ignored for EUR bookings. */
    legacyExchangeRate?: number;
  } & DepositTierSettings
): DepositBreakdown {
  const totalCents = Math.max(0, input.totalCents || 0);
  const { currency } = input;

  if (currency === "EUR") {
    const { tier, rawAmountEurCents } = resolveTier(totalCents, input);
    // A deposit can never exceed the total it's a deposit against — caps a
    // misconfigured mid/high-tier amount rather than overcharging.
    const depositCents = Math.min(rawAmountEurCents, totalCents);
    return {
      bookingTotalCents: totalCents,
      currency,
      depositTier: tier,
      depositCents,
      amountDueNowCents: depositCents,
      remainingBalanceCents: Math.max(0, totalCents - depositCents),
    };
  }

  // Legacy bridge: a booking created before the EUR-pricing migration still
  // carries a non-EUR total (e.g. "MUR"). PayPal has never accepted anything
  // but EUR in this codebase, so converting far enough to know what to
  // charge is unavoidable for a genuinely old, still-unpaid booking — it is
  // not part of the live EUR-native flow, which never takes this branch.
  // The booking's own displayed total/remaining balance stay in their
  // original currency; nothing here relabels a MUR cent value as EUR.
  const rate = input.legacyExchangeRate ?? 1;
  const totalEurCents = Math.round(totalCents / rate);
  const { tier, rawAmountEurCents } = resolveTier(totalEurCents, input);
  const amountDueNowCents = Math.min(rawAmountEurCents, totalEurCents);
  const depositCents = Math.min(Math.round(amountDueNowCents * rate), totalCents);

  return {
    bookingTotalCents: totalCents,
    currency,
    depositTier: tier,
    depositCents,
    amountDueNowCents,
    remainingBalanceCents: Math.max(0, totalCents - depositCents),
  };
}

/** "45.00" — the plain decimal string format the PayPal JS SDK expects. */
export function eurCentsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}
