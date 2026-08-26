import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { OPS_STATUS, opsStatusForBlock } from "@/lib/fleet/status-config";
import { businessDay, businessTime } from "@/lib/fleet/movements";

/**
 * Why a vehicle cannot be booked for a window.
 *
 * Lives here rather than in lib/actions/admin/manual-booking.ts because that
 * is a "use server" module, and every export from one becomes a remotely
 * callable Server Action. This function checks no permission of its own and
 * returns customer full names, booking references and statuses, so as an
 * action it let any authenticated session read that for any vehicle id. Both
 * of its callers - manual booking and maintenance downtime - are themselves
 * permission-checked server actions, so it never needed to be an endpoint.
 */

/** Statuses that hold a vehicle. Terminal states release it and must not block. */
const HOLDING_STATUSES = [
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

export type AvailabilityConflict = {
  kind: "booking" | "block";
  label: string;
  detail: string;
  from: string;
  to: string;
};

/**
 * Conflict windows are shown in Mauritius time, not UTC. The operator typed
 * "09:00" into the form; telling them the clash runs from "05:00" would look
 * like a different booking entirely.
 */
function fmt(iso: string) {
  return `${businessDay(iso)} ${businessTime(iso)}`;
}

/**
 * Explain, in advance, why a vehicle cannot be booked for a window.
 *
 * The database exclusion constraints are the real guarantee and still run on
 * insert — this exists so the operator is told *which* booking or block is in
 * the way and for which dates, instead of being handed a bare rejection.
 */
export async function findAvailabilityConflicts(
  vehicleId: string,
  pickupAt: string,
  returnAt: string
): Promise<AvailabilityConflict[]> {
  const supabase = createAdminClient();
  const startIso = new Date(pickupAt).toISOString();
  const endIso = new Date(returnAt).toISOString();

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, pickup_at, return_at, booking_customers(full_name)")
      .eq("vehicle_id", vehicleId)
      .in("status", HOLDING_STATUSES)
      .lt("pickup_at", endIso)
      .gt("return_at", startIso),
    supabase
      .from("vehicle_blocks")
      .select("id, type, note, period")
      .eq("vehicle_id", vehicleId)
      .filter("period", "ov", `[${startIso},${endIso})`),
  ]);

  const conflicts: AvailabilityConflict[] = [];

  for (const b of (bookings ?? []) as unknown as {
    reference: string;
    status: string;
    pickup_at: string;
    return_at: string;
    booking_customers: { full_name: string } | { full_name: string }[] | null;
  }[]) {
    const customer = Array.isArray(b.booking_customers)
      ? b.booking_customers[0]?.full_name
      : b.booking_customers?.full_name;
    conflicts.push({
      kind: "booking",
      label: `Booking ${b.reference}`,
      detail: customer ? `${customer} · ${b.status.replace(/_/g, " ")}` : b.status.replace(/_/g, " "),
      from: fmt(b.pickup_at),
      to: fmt(b.return_at),
    });
  }

  for (const bl of blocks ?? []) {
    const match = /\[([^,]+),([^)]+)\)/.exec(bl.period as unknown as string);
    conflicts.push({
      kind: "block",
      label: OPS_STATUS[opsStatusForBlock(bl.type)].label,
      detail: bl.note ?? "Vehicle unavailable",
      from: fmt(match?.[1] ?? startIso),
      to: fmt(match?.[2] ?? endIso),
    });
  }

  return conflicts;
}
