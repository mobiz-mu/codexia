/**
 * Pure availability predicates shared by the planning board, the manual
 * booking pre-check and the tests.
 *
 * These do NOT replace the database's exclusion constraints — those remain
 * the guarantee that two bookings can never hold one car. This module exists
 * so the same overlap rule can be reasoned about and tested without a
 * database round trip, and so the board and the booking form agree on what
 * "occupied" means.
 */

export type Interval = { start: string; end: string };

/** Parses a Postgres `["…","…")` tstzrange literal into absolute instants. */
export function parseBlockPeriod(period: string): { startsAt: Date; endsAt: Date } | null {
  const match = /\[([^,]+),([^)]+)\)/.exec(period);
  if (!match) return null;
  // Postgres renders the offset as `+00`, which Date cannot parse reliably —
  // it needs `+00:00`. Normalising this is not cosmetic: without it every
  // block parses as Invalid Date and no vehicle would ever read as exempt.
  const clean = (raw: string) =>
    raw
      .trim()
      .replace(/^"|"$/g, "")
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00");
  const startsAt = new Date(clean(match[1]));
  const endsAt = new Date(clean(match[2]));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  return { startsAt, endsAt };
}


/**
 * Half-open overlap: `[start, end)`.
 *
 * A rental returning at 10:00 and another collecting at 10:00 the same day do
 * NOT overlap — that is a same-day turnaround, which is normal fleet
 * operation, and treating it as a clash would refuse legitimate business.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Booking statuses that hold a vehicle. Anything else has released it. */
export const HOLDING_BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
]);

export function bookingHoldsVehicle(status: string): boolean {
  return HOLDING_BOOKING_STATUSES.has(status);
}

/**
 * Every block type takes the vehicle off the road for its period.
 *
 * Kept in step with the `vehicle_blocks_type_check` constraint — `inspection`
 * was added to the database by migration 0034 and has to be honoured here
 * too, or a car sitting in a weekly inspection would read as rentable.
 */
export const VEHICLE_HOLDING_BLOCK_TYPES = [
  "maintenance",
  "internal",
  "preparing",
  "cleaning",
  "incident",
  "stop_sell",
  "inspection",
] as const;

export function blockHoldsVehicle(type: string): boolean {
  return (VEHICLE_HOLDING_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * The row-level conditions a vehicle must satisfy to be public rental stock,
 * expressed as a PostgREST filter.
 *
 * This is the query-side half of the same rule `isPubliclyBookable` applies
 * in memory, and it lives beside it so the two cannot drift. Every public
 * inventory, search and quote path composes this rather than restating the
 * columns — which is exactly what went wrong before: `is_staff_car` was
 * documented as excluded from "all public inventory and booking queries" and
 * migration 0030 even built `vehicles_rentable_idx` for the filter, but no
 * query ever applied it.
 *
 * `currency` is part of the rule because the public funnel prices in EUR
 * only; a legacy MUR-priced row is not sellable through it.
 */
type VehicleFilterable<Q> = {
  eq(column: string, value: string | boolean): Q;
  is(column: string, value: null): Q;
};

export function publicVehicleFilter<Q extends VehicleFilterable<Q>>(query: Q): Q {
  return query.eq("status", "active").eq("is_staff_car", false).eq("currency", "EUR").is("deleted_at", null);
}

/**
 * Whether a vehicle may be offered to the public for a window.
 *
 * Staff cars are excluded outright: they are real fleet vehicles with real
 * service history, but they are never sellable, and that is a property of the
 * vehicle rather than a time-bounded block.
 */
export function isPubliclyBookable(input: {
  vehicle: { status: string; isStaffCar: boolean };
  window: Interval;
  bookings: { status: string; start: string; end: string }[];
  blocks: { type: string; start: string; end: string }[];
}): boolean {
  if (input.vehicle.isStaffCar) return false;
  if (input.vehicle.status !== "active") return false;

  const clash =
    input.bookings.some((b) => bookingHoldsVehicle(b.status) && overlaps(input.window, b)) ||
    input.blocks.some((b) => blockHoldsVehicle(b.type) && overlaps(input.window, b));

  return !clash;
}

/** Classify a booking movement relative to a forward window, for the day sheet. */
export function classifyMovement(input: {
  pickupAt: string;
  returnAt: string;
  windowStart: string;
  windowEnd: string;
}): ("departure" | "return")[] {
  const kinds: ("departure" | "return")[] = [];
  if (input.pickupAt >= input.windowStart && input.pickupAt < input.windowEnd) kinds.push("departure");
  if (input.returnAt >= input.windowStart && input.returnAt < input.windowEnd) kinds.push("return");
  return kinds;
}
