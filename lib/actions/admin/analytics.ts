"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function getAnalyticsSummary() {
  const user = await requireAdminUser();
  assertPermission(user, "view_analytics");

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("analytics_events")
    .select("event, path, vehicle_id, device, referrer, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000);

  const rows = events ?? [];

  const byDay = new Map<string, number>();
  const byPath = new Map<string, number>();
  const byVehicle = new Map<string, number>();
  const byDevice = new Map<string, number>();
  const byReferrer = new Map<string, number>();
  let bookNowClicks = 0;
  let bookingsSubmitted = 0;

  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    if (row.event === "pageview" && row.path) {
      byPath.set(row.path, (byPath.get(row.path) ?? 0) + 1);
    }
    if (row.event === "vehicle_view" && row.vehicle_id) {
      byVehicle.set(row.vehicle_id, (byVehicle.get(row.vehicle_id) ?? 0) + 1);
    }
    if (row.device) {
      byDevice.set(row.device, (byDevice.get(row.device) ?? 0) + 1);
    }
    if (row.referrer) {
      try {
        const host = new URL(row.referrer).hostname;
        byReferrer.set(host, (byReferrer.get(host) ?? 0) + 1);
      } catch {
        // ignore unparseable referrers
      }
    }
    if (row.event === "book_now_click") bookNowClicks += 1;
    if (row.event === "booking_submitted") bookingsSubmitted += 1;
  }

  const topVehicleIds = [...byVehicle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const { data: vehicles } =
    topVehicleIds.length > 0
      ? await supabase
          .from("vehicles")
          .select("id, name")
          .in(
            "id",
            topVehicleIds.map(([id]) => id)
          )
      : { data: [] };

  const vehicleNames = new Map((vehicles ?? []).map((v) => [v.id, v.name]));

  return {
    totalEvents: rows.length,
    byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    topPaths: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    topVehicles: topVehicleIds.map(([id, count]) => ({ id, name: vehicleNames.get(id) ?? "Unknown", count })),
    byDevice: [...byDevice.entries()],
    topReferrers: [...byReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    bookNowClicks,
    bookingsSubmitted,
    conversionRate: bookNowClicks > 0 ? bookingsSubmitted / bookNowClicks : 0,
  };
}
