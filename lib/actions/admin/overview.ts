"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = [
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

type BookingWithVehicleName = {
  id: string;
  reference: string;
  pickup_at: string;
  return_at: string;
  status: string;
  total_cents: number;
  created_at: string;
  vehicles: { name: string } | null;
};

export async function getOverviewStats() {
  const supabase = createAdminClient();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { data: statusCounts },
    { data: upcomingPickups },
    { data: upcomingDropoffs },
    { data: recentBookings },
    { count: pendingProofsCount },
    { count: pendingReviewsCount },
    { count: failedEmailsCount },
    { data: revenueRows },
  ] = await Promise.all([
    supabase.from("bookings").select("status").is("deleted_at", null),
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
      .select("id, reference, status, total_cents, created_at, vehicles(name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("payment_proofs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("bookings").select("paid_cents, balance_cents").is("deleted_at", null),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }

  const revenueCents = (revenueRows ?? []).reduce((sum, r) => sum + r.paid_cents, 0);
  const outstandingCents = (revenueRows ?? []).reduce((sum, r) => sum + Math.max(r.balance_cents, 0), 0);
  const activeRentalsCount = byStatus["active"] ?? 0;

  return {
    byStatus,
    activeRentalsCount,
    revenueCents,
    outstandingCents,
    upcomingPickups: (upcomingPickups ?? []) as unknown as BookingWithVehicleName[],
    upcomingDropoffs: (upcomingDropoffs ?? []) as unknown as BookingWithVehicleName[],
    recentBookings: (recentBookings ?? []) as unknown as BookingWithVehicleName[],
    pendingProofsCount: pendingProofsCount ?? 0,
    pendingReviewsCount: pendingReviewsCount ?? 0,
    failedEmailsCount: failedEmailsCount ?? 0,
  };
}
