/**
 * Click-to-book prefill: turns a day clicked on the planning board into the
 * pickup/return values the manual booking form opens with.
 *
 * Deliberately click-only rather than drag-to-select. A drag across a
 * scrolling, virtualised date grid is fiddly to get right and easy to trigger
 * by accident on a touchpad; picking the day and adjusting the return in the
 * form is duller and considerably harder to get wrong.
 */

/** Counter default: cars go out mid-morning unless told otherwise. */
export const DEFAULT_PICKUP_TIME = "09:00";

export type BookingPrefill = { pickupAt?: string; returnAt?: string };

export function prefillFromDate(date?: string | null, time = DEFAULT_PICKUP_TIME): BookingPrefill {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { pickupAt: undefined, returnAt: undefined };
  }

  // One night by default — the shortest booking that is unambiguously a
  // rental, and the least presumptuous guess about the customer's plans.
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);

  return {
    pickupAt: `${date}T${time}`,
    returnAt: `${next.toISOString().slice(0, 10)}T${time}`,
  };
}

/** The href a board cell links to, carrying the vehicle and day forward. */
export function newBookingHref(vehicleId: string, date: string): string {
  const sp = new URLSearchParams({ vehicle: vehicleId, date });
  return `/admin/bookings/new?${sp.toString()}`;
}
