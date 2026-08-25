"use server";

import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { attentionReasons, businessDay, type Movement, type MovementKind } from "@/lib/fleet/movements";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const OPERATIONAL_STATUSES = [
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

/**
 * Departures and returns over a bounded forward window, as two bulk queries.
 * Never one query per day — the range only changes how many rows come back.
 */
export async function getMovements(days: number): Promise<Movement[]> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const columns =
    "id, reference, status, source, pickup_at, return_at, total_cents, paid_cents, currency, " +
    "vehicles(name, internal_registration_ref), booking_customers(full_name, phone), " +
    "pickup_location:locations!bookings_pickup_location_id_fkey(name_en), " +
    "dropoff_location:locations!bookings_dropoff_location_id_fkey(name_en)";

  const [{ data: departures }, { data: returns }] = await Promise.all([
    supabase
      .from("bookings")
      .select(columns)
      .in("status", OPERATIONAL_STATUSES)
      .gte("pickup_at", fromIso)
      .lt("pickup_at", toIso)
      .order("pickup_at"),
    supabase
      .from("bookings")
      .select(columns)
      .in("status", OPERATIONAL_STATUSES)
      .gte("return_at", fromIso)
      .lt("return_at", toIso)
      .order("return_at"),
  ]);

  type Row = {
    id: string;
    reference: string;
    status: string;
    source: "website" | "admin";
    pickup_at: string;
    return_at: string;
    total_cents: number;
    paid_cents: number;
    currency: string;
    vehicles: { name: string; internal_registration_ref: string | null } | null;
    booking_customers: { full_name: string; phone: string | null } | null;
    pickup_location: { name_en: string } | null;
    dropoff_location: { name_en: string } | null;
  };

  const build = (rows: Row[], kind: MovementKind): Movement[] =>
    rows.map((r) => {
      const at = kind === "departure" ? r.pickup_at : r.return_at;
      const vehicleName = r.vehicles?.name ?? null;
      return {
        kind,
        at,
        day: businessDay(at),
        bookingId: r.id,
        reference: r.reference,
        status: r.status,
        source: r.source ?? "website",
        customerName: r.booking_customers?.full_name ?? "—",
        customerPhone: r.booking_customers?.phone ?? null,
        vehicleName,
        registration: r.vehicles?.internal_registration_ref ?? null,
        locationName:
          (kind === "departure" ? r.pickup_location?.name_en : r.dropoff_location?.name_en) ?? null,
        totalCents: r.total_cents,
        paidCents: r.paid_cents,
        currency: r.currency,
        attention: attentionReasons({
          kind,
          status: r.status,
          vehicleName,
          totalCents: r.total_cents,
          paidCents: r.paid_cents,
        }),
      };
    });

  return [
    ...build((departures ?? []) as unknown as Row[], "departure"),
    ...build((returns ?? []) as unknown as Row[], "return"),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
