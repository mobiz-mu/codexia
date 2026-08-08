/**
 * A location's delivery fee is only ever safe to show as a real amount once
 * it's been explicitly repriced in EUR — a non-zero fee still carrying its
 * pre-migration currency must never be displayed (that would either show a
 * misleading amount or require silently reinterpreting old cents as EUR).
 * A genuine zero fee is currency-agnostic and always safe to show as "Free".
 */
export type DeliveryFeeDisplay =
  | { kind: "free" }
  | { kind: "priced"; cents: number; currency: string }
  | { kind: "unavailable" };

export function resolveDeliveryFeeDisplay(cents: number, currency: string): DeliveryFeeDisplay {
  if (cents === 0) return { kind: "free" };
  if (currency === "EUR") return { kind: "priced", cents, currency };
  return { kind: "unavailable" };
}
