/**
 * Pure helpers for the departures/returns day sheet.
 *
 * Kept out of the "use server" action module on purpose: that file may only
 * export async functions, and these are synchronous formatters and rules that
 * are far easier to test directly than through a server action.
 */

export type MovementKind = "departure" | "return";

export type Movement = {
  kind: MovementKind;
  at: string;
  /** `YYYY-MM-DD` in Mauritius, which is how the day sheet groups. */
  day: string;
  bookingId: string;
  reference: string;
  status: string;
  source: "website" | "admin";
  customerName: string;
  customerPhone: string | null;
  vehicleName: string | null;
  registration: string | null;
  locationName: string | null;
  totalCents: number;
  paidCents: number;
  currency: string;
  /** Why this row needs attention before the vehicle can move. */
  attention: string[];
};

const BUSINESS_TZ = "Indian/Mauritius";

// Fixed timezone rather than the server's: a day sheet must be grouped by the
// operator's day in Mauritius, not by whichever region the box runs in.
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function businessDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function businessTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/**
 * Flags a movement as needing action before the car can leave or be received.
 *
 * Deliberately conservative — the day sheet highlights these in amber, and a
 * highlight that fires on everything is a highlight that gets ignored. Only
 * genuinely blocking gaps qualify: no vehicle assigned, money outstanding on
 * a departure, or a booking still unconfirmed on the day it is due out.
 *
 * Money owed at the END of a rental is normal and is not flagged: the balance
 * column already shows it, and it does not stop the car being received back.
 */
export function attentionReasons(input: {
  kind: MovementKind;
  status: string;
  vehicleName: string | null;
  totalCents: number;
  paidCents: number;
}): string[] {
  const reasons: string[] = [];
  if (!input.vehicleName) reasons.push("No vehicle assigned");
  if (input.kind === "departure") {
    if (input.status === "pending") reasons.push("Not confirmed");
    if (input.paidCents <= 0 && input.totalCents > 0) reasons.push("No payment recorded");
  }
  return reasons;
}
