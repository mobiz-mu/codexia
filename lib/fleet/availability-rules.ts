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

/** Every block type takes the vehicle off the road for its period. */
export function blockHoldsVehicle(type: string): boolean {
  return ["maintenance", "internal", "preparing", "cleaning", "incident", "stop_sell"].includes(type);
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
