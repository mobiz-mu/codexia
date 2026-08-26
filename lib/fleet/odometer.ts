/**
 * Cross-module odometer sanity, shared by every fleet surface that records a
 * mileage reading.
 *
 * The hard constraint shaping this rule: every table stores a DATE, not a
 * timestamp. `vehicle_fuel_records.filled_at`, `vehicle_maintenance_records.
 * maintenance_date` and `vehicle_inspections.inspection_date` are all day
 * granularity, so two readings on the same calendar day carry no information
 * about which happened first.
 *
 * That makes same-day comparison unsafe across modules. A fuel fill at 08:00
 * reading 50,050 and an inspection at 07:00 reading 50,000 are both true, and
 * rejecting the inspection because a same-day fuel row is higher would be
 * refusing honest data on evidence we do not have. So:
 *
 *   - readings on STRICTLY EARLIER dates set the lower bound;
 *   - readings on STRICTLY LATER dates set the upper bound;
 *   - readings on the SAME date never reject each other, in either direction;
 *   - equal readings on different dates are fine — a car can sit unused.
 *
 * `vehicles.current_mileage_km` is deliberately not an input. It is an
 * undated "latest known" value, so treating it as a floor would reject every
 * legitimate backfill of an older inspection.
 */

export type OdometerReading = {
  /** ISO date, `YYYY-MM-DD`. Day granularity — see above. */
  recordedOn: string;
  odometerKm: number;
  /** Where the reading came from, so the operator gets a useful message. */
  source: "fuel" | "maintenance" | "inspection";
};

export type OdometerCheckResult = { ok: true } | { ok: false; error: string };

const SOURCE_LABELS: Record<OdometerReading["source"], string> = {
  fuel: "fuel record",
  maintenance: "maintenance record",
  inspection: "inspection",
};

function describe(reading: OdometerReading): string {
  return `${reading.odometerKm.toLocaleString()} km on ${reading.recordedOn} (${SOURCE_LABELS[reading.source]})`;
}

/**
 * @param existing Readings for THIS vehicle from every module, excluding the
 *                 record being edited.
 */
export function checkOdometerAgainstHistory(input: {
  odometerKm: number;
  recordedOn: string;
  existing: OdometerReading[];
}): OdometerCheckResult {
  if (!Number.isInteger(input.odometerKm) || input.odometerKm < 0) {
    return { ok: false, error: "Odometer reading must be a whole number of kilometres, 0 or more." };
  }

  // Strict date comparison. Same-day rows are skipped entirely: day
  // granularity cannot order them, so they constrain nothing.
  const earlier = input.existing.filter((r) => r.recordedOn < input.recordedOn);
  const later = input.existing.filter((r) => r.recordedOn > input.recordedOn);

  let highestEarlier: OdometerReading | null = null;
  for (const reading of earlier) {
    if (!highestEarlier || reading.odometerKm > highestEarlier.odometerKm) highestEarlier = reading;
  }

  let lowestLater: OdometerReading | null = null;
  for (const reading of later) {
    if (!lowestLater || reading.odometerKm < lowestLater.odometerKm) lowestLater = reading;
  }

  if (highestEarlier && input.odometerKm < highestEarlier.odometerKm) {
    return {
      ok: false,
      error:
        `This vehicle already reads ${describe(highestEarlier)}. ` +
        `A later reading cannot show fewer kilometres. Correct the earlier record first if it was entered wrongly.`,
    };
  }

  if (lowestLater && input.odometerKm > lowestLater.odometerKm) {
    return {
      ok: false,
      error:
        `This vehicle already reads ${describe(lowestLater)}. ` +
        `An earlier reading cannot show more kilometres.`,
    };
  }

  return { ok: true };
}
