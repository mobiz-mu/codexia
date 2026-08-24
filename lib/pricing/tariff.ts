/**
 * Duration-tier seasonal tariff resolution — the single source of truth for
 * what a vehicle costs per day on a given date.
 *
 * Every consumer goes through here: the public booking quote, admin/manual
 * booking, the deposit calculation and the PayPal order amount all derive
 * from the same resolved rate. There must never be one rule on the public
 * site and a different one in admin.
 *
 * THE RULE
 * --------
 *   1. Pick the tariff period covering the booking's PICKUP date. A rental
 *      that crosses a season boundary is priced entirely at the pickup
 *      period's rates.
 *   2. Within that period take the highest duration tier <= rental days.
 *   3. total = that per-day rate x days.
 *
 * A tier stored as 0 means the duration is NOT OFFERED for that period —
 * never a free rental. This is how a peak-season minimum stay is expressed.
 *
 * All amounts are EUR integer cents. Internal fleet costs (maintenance,
 * fuel, compliance) are MUR and never pass through this module.
 */

/** Tier floors, ascending. 21 is the open-ended "21 or more" band. */
export const DURATION_TIERS = [1, 3, 4, 7, 14, 21] as const;
export type DurationTier = (typeof DURATION_TIERS)[number];

export type TariffRates = {
  rate1DayCents: number;
  rate3DayCents: number;
  rate4DayCents: number;
  rate7DayCents: number;
  rate14DayCents: number;
  rate21PlusDayCents: number;
};

export type TariffPeriod = TariffRates & {
  id: string;
  vehicleId: string | null;
  categoryId: string | null;
  label: string | null;
  /** Inclusive calendar dates, `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
  /** Empty means the period applies at every pickup location. */
  locationIds: string[];
};

export type RateResolution =
  | {
      available: true;
      rateCents: number;
      tier: DurationTier | null;
      source: "tariff" | "fallback";
      periodId: string | null;
      periodLabel: string | null;
    }
  | {
      available: false;
      reason: "duration_not_offered" | "no_rate_configured";
      tier: DurationTier | null;
      periodId: string | null;
      periodLabel: string | null;
    };

/**
 * Mauritius is UTC+4 year-round with no DST, but we ask Intl rather than
 * hard-coding the offset so this stays correct if that ever changes — and
 * so it is independent of the server's own timezone, which makes the result
 * identical on a Vercel box, a local machine and in CI.
 */
const BUSINESS_TIME_ZONE = "Indian/Mauritius";

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The calendar date a moment falls on in Mauritius, as `YYYY-MM-DD`.
 * A 01:00 local pickup on 1 September is 21:00 UTC on 31 August — without
 * this it would be priced at the previous month's rates.
 */
export function businessDate(at: Date): string {
  return businessDateFormatter.format(at);
}

/** The highest tier floor <= days. Days below 1 are clamped to the 1-day tier. */
export function resolveDurationTier(days: number): DurationTier {
  let tier: DurationTier = DURATION_TIERS[0];
  for (const candidate of DURATION_TIERS) {
    if (days >= candidate) tier = candidate;
  }
  return tier;
}

export function rateForTier(rates: TariffRates, tier: DurationTier): number {
  switch (tier) {
    case 1:
      return rates.rate1DayCents;
    case 3:
      return rates.rate3DayCents;
    case 4:
      return rates.rate4DayCents;
    case 7:
      return rates.rate7DayCents;
    case 14:
      return rates.rate14DayCents;
    case 21:
      return rates.rate21PlusDayCents;
  }
}

function coversDate(period: TariffPeriod, date: string): boolean {
  // Lexicographic comparison is exact for zero-padded YYYY-MM-DD, and avoids
  // constructing Dates (and therefore any timezone ambiguity) entirely.
  return period.effectiveFrom <= date && date <= period.effectiveTo;
}

function appliesAtLocation(period: TariffPeriod, pickupLocationId: string | null): boolean {
  if (period.locationIds.length === 0) return true;
  if (!pickupLocationId) return false;
  return period.locationIds.includes(pickupLocationId);
}

/**
 * Choose the governing period for a pickup date.
 *
 * A vehicle-scoped period always beats a category-scoped one — that overlap
 * is the intended override mechanism, which is why the database permits it
 * while forbidding two periods at the same scope level. Location-specific
 * grids beat all-location grids at the same scope, for the same reason.
 *
 * The database exclusion constraints should make ties impossible, but the
 * final sort keeps this a total order regardless, so a corrupted or
 * hand-edited dataset still resolves deterministically instead of depending
 * on row order.
 */
export function selectTariffPeriod(input: {
  periods: TariffPeriod[];
  pickupAt: Date;
  vehicleId: string;
  categoryId: string | null;
  pickupLocationId?: string | null;
}): TariffPeriod | null {
  const date = businessDate(input.pickupAt);
  const locationId = input.pickupLocationId ?? null;

  const eligible = input.periods.filter(
    (p) =>
      p.active &&
      coversDate(p, date) &&
      appliesAtLocation(p, locationId) &&
      (p.vehicleId === input.vehicleId ||
        (p.vehicleId === null && p.categoryId !== null && p.categoryId === input.categoryId))
  );

  if (eligible.length === 0) return null;

  const ranked = [...eligible].sort((a, b) => {
    const scopeRank = (p: TariffPeriod) => (p.vehicleId ? 0 : 1);
    if (scopeRank(a) !== scopeRank(b)) return scopeRank(a) - scopeRank(b);

    const locationRank = (p: TariffPeriod) => (p.locationIds.length > 0 ? 0 : 1);
    if (locationRank(a) !== locationRank(b)) return locationRank(a) - locationRank(b);

    // Narrower window wins, then the later start, then id — purely so the
    // outcome is stable, never because these carry business meaning.
    const span = (p: TariffPeriod) => p.effectiveTo.localeCompare(p.effectiveFrom);
    if (span(a) !== span(b)) return span(a) - span(b);
    if (a.effectiveFrom !== b.effectiveFrom) return b.effectiveFrom.localeCompare(a.effectiveFrom);
    return a.id.localeCompare(b.id);
  });

  return ranked[0];
}

/**
 * Resolve the per-day rate for a booking.
 *
 * `fallbackDailyPriceCents` is `vehicles.daily_price_cents`. It exists only
 * so vehicles with no tariff period yet keep working during the rollout —
 * once a period covers the date, the tariff is authoritative and the
 * fallback is not consulted. A zero tier is an explicit "not offered", so it
 * must never silently fall through to the old flat rate.
 */
export function resolveDailyRate(input: {
  periods: TariffPeriod[];
  pickupAt: Date;
  days: number;
  vehicleId: string;
  categoryId: string | null;
  pickupLocationId?: string | null;
  fallbackDailyPriceCents: number;
}): RateResolution {
  const tier = resolveDurationTier(input.days);
  const period = selectTariffPeriod(input);

  if (period) {
    const rateCents = rateForTier(period, tier);
    if (rateCents <= 0) {
      return {
        available: false,
        reason: "duration_not_offered",
        tier,
        periodId: period.id,
        periodLabel: period.label,
      };
    }
    return {
      available: true,
      rateCents,
      tier,
      source: "tariff",
      periodId: period.id,
      periodLabel: period.label,
    };
  }

  if (input.fallbackDailyPriceCents > 0) {
    return {
      available: true,
      rateCents: input.fallbackDailyPriceCents,
      tier: null,
      source: "fallback",
      periodId: null,
      periodLabel: null,
    };
  }

  return {
    available: false,
    reason: "no_rate_configured",
    tier,
    periodId: null,
    periodLabel: null,
  };
}
