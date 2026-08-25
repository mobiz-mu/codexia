"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { fuelRecordSchema, resolveTotalCostCents } from "@/lib/fleet/fuel-schema";
import { checkOdometerProgression, withFuelMetrics, monthlySpend, type FuelRecordInput } from "@/lib/fleet/fuel";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export type FuelFormState = { status: "idle" | "success" | "error"; error?: string };

export type FuelRow = FuelRecordInput & {
  vehicleId: string;
  vehicleName: string | null;
  registration: string | null;
  pricePerLitreCents: number;
  station: string | null;
  driverName: string | null;
  receiptReference: string | null;
  notes: string | null;
};

/**
 * Fuel records for one vehicle or the whole fleet, with derived distance and
 * consumption attached.
 *
 * Metrics are computed per vehicle over that vehicle's full ordered history —
 * a fill's consumption depends on the fill before it, so a page of results
 * filtered to one month would otherwise produce a wrong figure for its first
 * row. The read is bounded by vehicle, not by an arbitrary page.
 */
export async function listFuelRecords(filters: { vehicleId?: string } = {}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_fuel");

  const supabase = createAdminClient();

  let query = supabase
    .from("vehicle_fuel_records")
    .select(
      "id, vehicle_id, filled_at, odometer_km, litres_ml, price_per_litre_cents, total_cost_cents, station, driver_name, full_tank, receipt_reference, notes, vehicles(name, internal_registration_ref)"
    )
    .order("filled_at", { ascending: false })
    .limit(500);

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);

  const { data, error } = await query;
  if (error) {
    console.error("listFuelRecords failed", error.message);
    return { rows: [] as (FuelRow & { derived: ReturnType<typeof withFuelMetrics>[number]["derived"] })[], monthly: [] as { month: string; totalCents: number }[] };
  }

  type Raw = {
    id: string;
    vehicle_id: string;
    filled_at: string;
    odometer_km: number;
    litres_ml: number;
    price_per_litre_cents: number;
    total_cost_cents: number;
    station: string | null;
    driver_name: string | null;
    full_tank: boolean;
    receipt_reference: string | null;
    notes: string | null;
    vehicles: { name: string; internal_registration_ref: string | null } | null;
  };

  const raw = (data ?? []) as unknown as Raw[];

  const byVehicle = new Map<string, Raw[]>();
  for (const r of raw) {
    const list = byVehicle.get(r.vehicle_id) ?? [];
    list.push(r);
    byVehicle.set(r.vehicle_id, list);
  }

  const rows = [...byVehicle.values()].flatMap((group) =>
    withFuelMetrics(
      group.map((r) => ({
        id: r.id,
        filledAt: r.filled_at,
        odometerKm: r.odometer_km,
        litresMl: r.litres_ml,
        totalCostCents: r.total_cost_cents,
        fullTank: r.full_tank,
        vehicleId: r.vehicle_id,
        vehicleName: r.vehicles?.name ?? null,
        registration: r.vehicles?.internal_registration_ref ?? null,
        pricePerLitreCents: r.price_per_litre_cents,
        station: r.station,
        driverName: r.driver_name,
        receiptReference: r.receipt_reference,
        notes: r.notes,
      }))
    )
  );

  rows.sort((a, b) => b.filledAt.localeCompare(a.filledAt) || b.odometerKm - a.odometerKm);

  const monthly = [...monthlySpend(raw.map((r) => ({ filledAt: r.filled_at, totalCostCents: r.total_cost_cents })))]
    .map(([month, totalCents]) => ({ month, totalCents }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);

  return { rows, monthly };
}

export async function getFuelFormData() {
  const user = await requireAdminUser();
  assertPermission(user, "view_fuel");

  const supabase = createAdminClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name, brand, model, transmission, internal_registration_ref, is_staff_car")
    .neq("status", "archived")
    .order("name");

  return { vehicles: vehicles ?? [], canManage: user.permissions.has("manage_fuel") };
}

export async function createFuelRecord(_prev: FuelFormState, formData: FormData): Promise<FuelFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_fuel");

  const parsed = fuelRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }
  const d = parsed.data;

  const supabase = createAdminClient();

  // An out-of-order reading silently corrupts every consumption figure after
  // it, so this is a hard rejection rather than a warning.
  const { data: existing } = await supabase
    .from("vehicle_fuel_records")
    .select("odometer_km, filled_at")
    .eq("vehicle_id", d.vehicleId);

  const progression = checkOdometerProgression({
    odometerKm: d.odometerKm,
    filledAt: d.filledAt,
    existing: (existing ?? []).map((r) => ({ odometerKm: r.odometer_km, filledAt: r.filled_at })),
  });
  if (!progression.ok) return { status: "error", error: progression.error };

  const { error } = await supabase.from("vehicle_fuel_records").insert({
    vehicle_id: d.vehicleId,
    filled_at: d.filledAt,
    odometer_km: d.odometerKm,
    litres_ml: d.litres,
    price_per_litre_cents: d.pricePerLitre,
    total_cost_cents: resolveTotalCostCents(d),
    station: d.station || null,
    driver_name: d.driverName || null,
    full_tank: d.fullTank,
    receipt_reference: d.receiptReference || null,
    notes: d.notes || null,
    created_by: user.id,
  });

  if (error) {
    console.error("createFuelRecord failed", error.message);
    return { status: "error", error: "Could not save the fuel record." };
  }

  revalidatePath("/admin/fuel");
  return { status: "success" };
}

export async function deleteFuelRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_fuel");

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicle_fuel_records").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/fuel");
  return { ok: true };
}
