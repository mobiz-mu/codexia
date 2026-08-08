/**
 * Server-side EUR invariant for a new booking: the vehicle, both pickup/
 * dropoff delivery fees (unless the fee is a genuine, currency-agnostic
 * zero), and every extra actually being added must all be EUR. Returns
 * which part failed (for logging/error selection) or null if the whole
 * booking is EUR-clean. Never used to silently convert or drop an input —
 * a single non-EUR input means the caller must reject the booking outright.
 */
export type BookingCurrencyFailure = "vehicle" | "pickup_location" | "dropoff_location" | "extra";

export function findNonEurBookingInput(input: {
  vehicleCurrency: string;
  pickupLocation: { deliveryFeeCents: number; deliveryFeeCurrency: string };
  dropoffLocation: { deliveryFeeCents: number; deliveryFeeCurrency: string };
  selectedExtras: { currency: string }[];
}): BookingCurrencyFailure | null {
  if (input.vehicleCurrency !== "EUR") return "vehicle";

  if (input.pickupLocation.deliveryFeeCents > 0 && input.pickupLocation.deliveryFeeCurrency !== "EUR") {
    return "pickup_location";
  }
  if (input.dropoffLocation.deliveryFeeCents > 0 && input.dropoffLocation.deliveryFeeCurrency !== "EUR") {
    return "dropoff_location";
  }

  if (input.selectedExtras.some((e) => e.currency !== "EUR")) return "extra";

  return null;
}
