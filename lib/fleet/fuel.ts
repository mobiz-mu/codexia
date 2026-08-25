/**
 * Fuel arithmetic.
 *
 * Two rules run through all of it:
 *
 * 1. Nothing is fabricated. Consumption between two fills is only meaningful
 *    when there is a previous fill, both odometers are present and moving
 *    forward, and the later fill filled the tank. When any of that is missing
 *    the answer is `null` — not an estimate, not zero. A plausible-looking
 *    wrong figure is worse than a blank, because someone will budget from it.
 *
 * 2. No floating-point money or volume. Litres are integer millilitres and
 *    money is MUR minor units, all the way through.
 */

export const ML_PER_LITRE = 1000;

export type FuelRecordInput = {
  id: string;
  filledAt: string;
  odometerKm: number;
  litresMl: number;
  totalCostCents: number;
  fullTank: boolean;
};

export type FuelDerived = {
  /** Km since the previous fill, or null when there is no usable previous reading. */
  distanceKm: number | null;
  /** Litres per 100 km, to one decimal. Null unless the calculation is valid. */
  litresPer100Km: number | null;
  /** MUR minor units per km. Null unless distance is known. */
  costPerKmCents: number | null;
  /** Why a figure is missing, for the UI to explain rather than show a dash. */
  reason: null | "no_previous_fill" | "partial_fill" | "no_distance" | "odometer_not_advanced";
};

export function litresFromMl(ml: number): number {
  return ml / ML_PER_LITRE;
}

export function mlFromLitres(litres: number): number {
  return Math.round(litres * ML_PER_LITRE);
}

/** Total from a pump reading, kept in integer minor units. */
export function totalCostCents(litresMl: number, pricePerLitreCents: number): number {
  return Math.round((litresMl * pricePerLitreCents) / ML_PER_LITRE);
}

/**
 * Derive distance, consumption and cost/km for one fill given the fill that
 * immediately precedes it on the same vehicle.
 *
 * `previous` must be the fill with the next-lowest odometer for that vehicle;
 * the caller sorts, because it has the whole set.
 */
export function deriveFuelMetrics(current: FuelRecordInput, previous: FuelRecordInput | null): FuelDerived {
  if (!previous) {
    return { distanceKm: null, litresPer100Km: null, costPerKmCents: null, reason: "no_previous_fill" };
  }

  const distanceKm = current.odometerKm - previous.odometerKm;

  if (distanceKm <= 0) {
    // Same odometer twice, or a correction that moved it backwards. Either
    // way there is no distance to divide by.
    return { distanceKm: null, litresPer100Km: null, costPerKmCents: null, reason: "odometer_not_advanced" };
  }

  const costPerKmCents = Math.round(current.totalCostCents / distanceKm);

  if (!current.fullTank) {
    // A part-fill measures the pump, not the tank: the fuel actually consumed
    // over this distance is unknown. Distance and cost/km still hold.
    return { distanceKm, litresPer100Km: null, costPerKmCents, reason: "partial_fill" };
  }

  const litres = litresFromMl(current.litresMl);
  const litresPer100Km = Math.round((litres / distanceKm) * 100 * 10) / 10;

  return { distanceKm, litresPer100Km, costPerKmCents, reason: null };
}

/**
 * Attach derived metrics to a vehicle's fills.
 *
 * Sorted by odometer rather than date on purpose: a receipt entered late
 * should still sit in the right place in the vehicle's mileage history, and
 * consumption is a function of distance travelled, not of data-entry order.
 */
export function withFuelMetrics<T extends FuelRecordInput>(records: T[]): (T & { derived: FuelDerived })[] {
  const ordered = [...records].sort((a, b) => a.odometerKm - b.odometerKm || a.filledAt.localeCompare(b.filledAt));
  return ordered.map((record, index) => ({
    ...record,
    derived: deriveFuelMetrics(record, index === 0 ? null : ordered[index - 1]),
  }));
}

export type OdometerCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Reject an odometer reading that would move a vehicle's mileage backwards.
 *
 * Deliberately a hard rejection rather than a warning: an out-of-order reading
 * silently corrupts every consumption figure after it. Correcting a genuine
 * mistake means editing the offending record, which is an explicit,
 * attributable act rather than a quiet overwrite.
 */
export function checkOdometerProgression(input: {
  odometerKm: number;
  /** Existing readings for this vehicle, excluding the record being edited. */
  existing: { odometerKm: number; filledAt: string }[];
  filledAt: string;
}): OdometerCheck {
  const earlier = input.existing.filter((r) => r.filledAt <= input.filledAt);
  const later = input.existing.filter((r) => r.filledAt > input.filledAt);

  const maxEarlier = earlier.length ? Math.max(...earlier.map((r) => r.odometerKm)) : null;
  const minLater = later.length ? Math.min(...later.map((r) => r.odometerKm)) : null;

  if (maxEarlier !== null && input.odometerKm < maxEarlier) {
    return {
      ok: false,
      error: `This vehicle already has a reading of ${maxEarlier.toLocaleString()} km on or before this date. A later fill cannot show fewer kilometres.`,
    };
  }

  if (minLater !== null && input.odometerKm > minLater) {
    return {
      ok: false,
      error: `A later fill for this vehicle already reads ${minLater.toLocaleString()} km. This reading would put the mileage out of order.`,
    };
  }

  return { ok: true };
}

/** Month key (`YYYY-MM`) and total spend, for the monthly fuel figure. */
export function monthlySpend(records: { filledAt: string; totalCostCents: number }[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const r of records) {
    const key = r.filledAt.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.totalCostCents);
  }
  return byMonth;
}
