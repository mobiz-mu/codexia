/**
 * A vehicle's current operational status (Available/Reserved/Preparing/...)
 * is deliberately not stored anywhere — it's derived from the vehicle's
 * current booking + vehicle_blocks state at query time. A persisted status
 * column would need to be kept in sync on every booking/block change and
 * would silently go stale the moment someone forgot to update it; deriving
 * it is always correct by construction.
 */

export type OperationalStatus =
  | "available"
  | "reserved"
  | "active_rental"
  | "returned"
  | "preparing"
  | "cleaning"
  | "maintenance"
  | "blocked";

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  active_rental: "Active Rental",
  returned: "Returned",
  preparing: "Preparing",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  blocked: "Blocked",
};

const RESERVED_BOOKING_STATUSES = new Set([
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
]);

const RETURNED_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESERVED_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;

type BookingWindow = { status: string; pickupAt: string; returnAt: string };
type BlockWindow = { type: string; startAt: string; endAt: string };

function covers(now: number, startAt: string, endAt: string) {
  return new Date(startAt).getTime() <= now && now < new Date(endAt).getTime();
}

/**
 * Priority order (first match wins): a maintenance/internal/prep/cleaning
 * block covering `now` always wins over a booking, since those represent an
 * explicit admin decision that the vehicle is unavailable right now.
 */
export function computeOperationalStatus(params: {
  now: Date;
  bookings: BookingWindow[];
  blocks: BlockWindow[];
}): OperationalStatus {
  const now = params.now.getTime();

  for (const block of params.blocks) {
    if (!covers(now, block.startAt, block.endAt)) continue;
    if (block.type === "maintenance") return "maintenance";
    if (block.type === "internal") return "blocked";
    if (block.type === "preparing") return "preparing";
    if (block.type === "cleaning") return "cleaning";
  }

  for (const booking of params.bookings) {
    if (booking.status === "active" && covers(now, booking.pickupAt, booking.returnAt)) {
      return "active_rental";
    }
  }

  for (const booking of params.bookings) {
    if (booking.status !== "completed") continue;
    const returnedAt = new Date(booking.returnAt).getTime();
    if (returnedAt <= now && now - returnedAt < RETURNED_WINDOW_MS) return "returned";
  }

  for (const booking of params.bookings) {
    if (!RESERVED_BOOKING_STATUSES.has(booking.status)) continue;
    const pickupAt = new Date(booking.pickupAt).getTime();
    if (covers(now, booking.pickupAt, booking.returnAt)) return "reserved";
    if (pickupAt > now && pickupAt - now < RESERVED_LOOKAHEAD_MS) return "reserved";
  }

  return "available";
}
