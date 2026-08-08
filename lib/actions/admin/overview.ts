"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { computeOperationalStatus } from "@/lib/vehicles/operational-status";

const ACTIVE_STATUSES = [
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

// Same window the operational-status helper uses for "reserved" (looking
// ahead) and "returned" (looking back) — see lib/vehicles/operational-status.ts.
const STATUS_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const STATUS_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;
const UTILIZATION_WINDOW_DAYS = 30;

type BookingWithVehicleName = {
  id: string;
  reference: string;
  pickup_at: string;
  return_at: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  vehicles: { name: string } | null;
};

type CurrencyCents = Record<string, number>;

function sumByCurrency(rows: { amount_cents: number; currency: string }[] | null): CurrencyCents {
  const result: CurrencyCents = {};
  for (const row of rows ?? []) {
    result[row.currency] = (result[row.currency] ?? 0) + row.amount_cents;
  }
  return result;
}

export async function getOverviewStats() {
  await requireAdminUser();

  const supabase = createAdminClient();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const utilizationWindowStart = new Date(now.getTime() - UTILIZATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const statusWindowStart = new Date(now.getTime() - STATUS_LOOKBACK_MS);
  const statusWindowEnd = new Date(now.getTime() + STATUS_LOOKAHEAD_MS);

  const [
    { data: statusAndRevenueRows },
    { data: upcomingPickups },
    { data: upcomingDropoffs },
    { data: recentBookings },
    { count: pendingReviewsCount },
    { count: failedEmailsCount },
    { count: todayBookingsCount },
    { data: todayPayments },
    { data: monthPayments },
    { data: activeVehicles },
    { data: statusWindowBookings },
    { data: statusWindowBlocks },
    { data: utilizationBookings },
    { count: pendingEnquiriesCount },
    { data: monthBookingRows },
  ] = await Promise.all([
    supabase.from("bookings").select("status, paid_cents, balance_cents, currency").is("deleted_at", null),
    supabase
      .from("bookings")
      .select("id, reference, pickup_at, vehicles(name)")
      .in("status", ACTIVE_STATUSES)
      .gte("pickup_at", now.toISOString())
      .lte("pickup_at", in7Days.toISOString())
      .order("pickup_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, reference, return_at, vehicles(name)")
      .in("status", ACTIVE_STATUSES)
      .gte("return_at", now.toISOString())
      .lte("return_at", in7Days.toISOString())
      .order("return_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, reference, status, total_cents, currency, created_at, vehicles(name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", todayStart.toISOString()),
    // No currency filter — every currency must be counted, not just MUR/EUR,
    // so a new currency never silently vanishes from the dashboard.
    supabase.from("payments").select("amount_cents, currency").gte("paid_at", todayStart.toISOString()),
    supabase.from("payments").select("amount_cents, currency").gte("paid_at", monthStart.toISOString()),
    supabase.from("vehicles").select("id").eq("status", "active").is("deleted_at", null),
    supabase
      .from("bookings")
      .select("vehicle_id, status, pickup_at, return_at")
      .not("vehicle_id", "is", null)
      .in("status", [...ACTIVE_STATUSES, "completed"])
      .lt("pickup_at", statusWindowEnd.toISOString())
      .gt("return_at", statusWindowStart.toISOString()),
    supabase
      .from("vehicle_blocks")
      .select("vehicle_id, type, period")
      .filter("period", "ov", `[${now.toISOString()},${now.toISOString()}]`),
    supabase
      .from("bookings")
      .select("vehicle_id, pickup_at, return_at")
      .not("vehicle_id", "is", null)
      .in("status", ["active", "completed"])
      .lt("pickup_at", now.toISOString())
      .gt("return_at", utilizationWindowStart.toISOString()),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
    // Booking value generated this month (accrual) — deliberately a
    // different figure from monthPayments (cash actually received this
    // month): a booking can be created this month and paid later, or paid
    // this month for a booking created earlier.
    supabase
      .from("bookings")
      .select("total_cents, currency")
      .is("deleted_at", null)
      .gte("created_at", monthStart.toISOString()),
  ]);

  // Every aggregate below is keyed by currency rather than summed as one
  // number — a MUR booking and a EUR booking are different units, and
  // silently adding their cents together would produce a meaningless total.
  const byStatus: Record<string, number> = {};
  const revenueByCurrency: CurrencyCents = {};
  const outstandingByCurrency: CurrencyCents = {};
  for (const row of statusAndRevenueRows ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    const currency = row.currency;
    revenueByCurrency[currency] = (revenueByCurrency[currency] ?? 0) + row.paid_cents;
    outstandingByCurrency[currency] = (outstandingByCurrency[currency] ?? 0) + Math.max(row.balance_cents, 0);
  }

  const activeRentalsCount = byStatus["active"] ?? 0;
  // Bookings the customer started but never completed PayPal payment for —
  // worth an admin follow-up call/email.
  const unpaidPendingCount = byStatus["pending"] ?? 0;

  const todayRevenueByCurrency = sumByCurrency(todayPayments);
  const monthRevenueByCurrency = sumByCurrency(monthPayments);
  const monthBookingRevenueByCurrency: CurrencyCents = {};
  for (const row of monthBookingRows ?? []) {
    monthBookingRevenueByCurrency[row.currency] = (monthBookingRevenueByCurrency[row.currency] ?? 0) + row.total_cents;
  }

  const bookingsByVehicle = new Map<string, { status: string; pickupAt: string; returnAt: string }[]>();
  for (const b of statusWindowBookings ?? []) {
    if (!b.vehicle_id) continue;
    const list = bookingsByVehicle.get(b.vehicle_id) ?? [];
    list.push({ status: b.status, pickupAt: b.pickup_at, returnAt: b.return_at });
    bookingsByVehicle.set(b.vehicle_id, list);
  }
  const blocksByVehicle = new Map<string, { type: string; startAt: string; endAt: string }[]>();
  for (const block of statusWindowBlocks ?? []) {
    const match = /\[([^,]+),([^)\]]+)[)\]]/.exec(block.period as unknown as string);
    if (!match) continue;
    const list = blocksByVehicle.get(block.vehicle_id) ?? [];
    list.push({ type: block.type, startAt: match[1], endAt: match[2] });
    blocksByVehicle.set(block.vehicle_id, list);
  }

  const operationalCounts: Record<string, number> = {};
  for (const vehicle of activeVehicles ?? []) {
    const status = computeOperationalStatus({
      now,
      bookings: bookingsByVehicle.get(vehicle.id) ?? [],
      blocks: blocksByVehicle.get(vehicle.id) ?? [],
    });
    operationalCounts[status] = (operationalCounts[status] ?? 0) + 1;
  }
  const vehiclesAvailableCount = operationalCounts.available ?? 0;
  const vehiclesReservedCount = operationalCounts.reserved ?? 0;
  const vehiclesMaintenanceCount = operationalCounts.maintenance ?? 0;

  const fleetSize = (activeVehicles ?? []).length;
  let utilizedDays = 0;
  const windowStartMs = utilizationWindowStart.getTime();
  const windowEndMs = now.getTime();
  for (const b of utilizationBookings ?? []) {
    const start = Math.max(new Date(b.pickup_at).getTime(), windowStartMs);
    const end = Math.min(new Date(b.return_at).getTime(), windowEndMs);
    if (end > start) utilizedDays += (end - start) / (24 * 60 * 60 * 1000);
  }
  const availableFleetDays = fleetSize * UTILIZATION_WINDOW_DAYS;
  const fleetUtilizationPct = availableFleetDays > 0 ? Math.round((utilizedDays / availableFleetDays) * 1000) / 10 : 0;

  return {
    byStatus,
    activeRentalsCount,
    revenueByCurrency,
    outstandingByCurrency,
    unpaidPendingCount,
    todayBookingsCount: todayBookingsCount ?? 0,
    todayRevenueByCurrency,
    monthRevenueByCurrency,
    monthBookingRevenueByCurrency,
    fleetSize,
    vehiclesAvailableCount,
    vehiclesReservedCount,
    vehiclesMaintenanceCount,
    fleetUtilizationPct,
    pendingEnquiriesCount: pendingEnquiriesCount ?? 0,
    upcomingPickups: (upcomingPickups ?? []) as unknown as BookingWithVehicleName[],
    upcomingDropoffs: (upcomingDropoffs ?? []) as unknown as BookingWithVehicleName[],
    recentBookings: (recentBookings ?? []) as unknown as BookingWithVehicleName[],
    pendingReviewsCount: pendingReviewsCount ?? 0,
    failedEmailsCount: failedEmailsCount ?? 0,
  };
}
