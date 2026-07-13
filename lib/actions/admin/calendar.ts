"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

export type CalendarEvent = {
  id: string;
  reference: string;
  status: string;
  vehicleName: string;
  date: string;
  type: "pickup" | "dropoff";
};

export async function getCalendarBookings(year: number, month: number, vehicleId?: string) {
  const user = await requireAdminUser();
  if (!user.permissions.has("manage_bookings")) {
    throw new Error("Missing required permission: manage_bookings");
  }

  const supabase = createAdminClient();
  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  let query = supabase
    .from("bookings")
    .select("id, reference, status, pickup_at, return_at, vehicle_id, vehicles(name)")
    .is("deleted_at", null)
    .or(
      `and(pickup_at.gte.${monthStart},pickup_at.lt.${monthEnd}),and(return_at.gte.${monthStart},return_at.lt.${monthEnd})`
    );

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getCalendarBookings failed", error.message);
    return [];
  }

  type Row = {
    id: string;
    reference: string;
    status: string;
    pickup_at: string;
    return_at: string;
    vehicles: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const events: CalendarEvent[] = [];

  for (const row of rows) {
    if (row.pickup_at >= monthStart && row.pickup_at < monthEnd) {
      events.push({
        id: row.id,
        reference: row.reference,
        status: row.status,
        vehicleName: row.vehicles?.name ?? "—",
        date: row.pickup_at,
        type: "pickup",
      });
    }
    if (row.return_at >= monthStart && row.return_at < monthEnd) {
      events.push({
        id: row.id,
        reference: row.reference,
        status: row.status,
        vehicleName: row.vehicles?.name ?? "—",
        date: row.return_at,
        type: "dropoff",
      });
    }
  }

  return events;
}

export async function getCalendarVehicleOptions() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data } = await supabase.from("vehicles").select("id, name").eq("status", "active").order("name");
  return data ?? [];
}
