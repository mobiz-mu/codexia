"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTariffFormData, tariffPeriodSchema } from "@/lib/pricing/tariff-schema";
import type { TariffPeriod } from "@/lib/pricing/tariff";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const SELECT_COLUMNS =
  "id, vehicle_id, category_id, label, effective_from, effective_to, rate_1_day_cents, rate_3_day_cents, rate_4_day_cents, rate_7_day_cents, rate_14_day_cents, rate_21_plus_day_cents, currency, active, created_at, updated_at";

type TariffRow = {
  id: string;
  vehicle_id: string | null;
  category_id: string | null;
  label: string | null;
  effective_from: string;
  effective_to: string;
  rate_1_day_cents: number;
  rate_3_day_cents: number;
  rate_4_day_cents: number;
  rate_7_day_cents: number;
  rate_14_day_cents: number;
  rate_21_plus_day_cents: number;
  currency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TariffPeriodRecord = TariffPeriod & {
  vehicleName: string | null;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDomain(row: TariffRow, locationIds: string[]): TariffPeriod {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    categoryId: row.category_id,
    label: row.label,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    active: row.active,
    locationIds,
    rate1DayCents: row.rate_1_day_cents,
    rate3DayCents: row.rate_3_day_cents,
    rate4DayCents: row.rate_4_day_cents,
    rate7DayCents: row.rate_7_day_cents,
    rate14DayCents: row.rate_14_day_cents,
    rate21PlusDayCents: row.rate_21_plus_day_cents,
  };
}

/**
 * Every period plus its location links, in one round trip for the links
 * rather than one per period — the tariff screen lists a whole year at a
 * time and an N+1 here would be felt immediately.
 */
export async function listTariffPeriods(filters: { month?: number | null; year?: number } = {}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_tariffs");

  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("vehicle_tariff_periods")
    .select(SELECT_COLUMNS)
    .order("effective_from", { ascending: true });

  if (error) throw new Error(error.message);
  const periodRows = (rows ?? []) as TariffRow[];

  const { data: links } = await supabase
    .from("vehicle_tariff_period_locations")
    .select("tariff_period_id, location_id");

  const linksByPeriod = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = linksByPeriod.get(link.tariff_period_id) ?? [];
    list.push(link.location_id);
    linksByPeriod.set(link.tariff_period_id, list);
  }

  const [{ data: vehicles }, { data: categories }] = await Promise.all([
    supabase.from("vehicles").select("id, name, brand, model, transmission, internal_registration_ref, category_id"),
    supabase.from("vehicle_categories").select("id, name_en"),
  ]);

  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  let records: TariffPeriodRecord[] = periodRows.map((row) => ({
    ...toDomain(row, linksByPeriod.get(row.id) ?? []),
    vehicleName: row.vehicle_id ? (vehicleById.get(row.vehicle_id)?.name ?? null) : null,
    categoryName: row.category_id ? (categoryById.get(row.category_id)?.name_en ?? null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Month filtering is "periods overlapping this month", not "starting in
  // it" — a July–August period must still appear under August.
  if (filters.month && filters.year) {
    const monthStart = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(filters.year, filters.month, 0)).getUTCDate();
    const monthEnd = `${filters.year}-${String(filters.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    records = records.filter((p) => p.effectiveFrom <= monthEnd && p.effectiveTo >= monthStart);
  }

  return records;
}

export async function getTariffScreenData() {
  const user = await requireAdminUser();
  assertPermission(user, "view_tariffs");

  const supabase = createAdminClient();
  const [{ data: vehicles }, { data: categories }, { data: locations }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, name, brand, model, transmission, internal_registration_ref, category_id, status, daily_price_cents, is_staff_car")
      .neq("status", "archived")
      .order("name"),
    supabase.from("vehicle_categories").select("id, name_en, slug").order("display_order"),
    supabase.from("locations").select("id, name_en").order("display_order"),
  ]);

  return {
    vehicles: vehicles ?? [],
    categories: categories ?? [],
    locations: locations ?? [],
    canManage: user.permissions.has("manage_tariffs"),
  };
}

export type TariffFormState = { status: "idle" | "success" | "error"; error?: string };

function mapToRow(data: ReturnType<typeof tariffPeriodSchema.parse>) {
  return {
    vehicle_id: data.scope === "vehicle" ? (data.vehicleId as string) : null,
    category_id: data.scope === "category" ? (data.categoryId as string) : null,
    label: data.label ? data.label : null,
    effective_from: data.effectiveFrom,
    effective_to: data.effectiveTo,
    rate_1_day_cents: data.rate1DayCents ?? 0,
    rate_3_day_cents: data.rate3DayCents ?? 0,
    rate_4_day_cents: data.rate4DayCents ?? 0,
    rate_7_day_cents: data.rate7DayCents ?? 0,
    rate_14_day_cents: data.rate14DayCents ?? 0,
    rate_21_plus_day_cents: data.rate21PlusDayCents ?? 0,
    active: data.active,
  };
}

/**
 * The database rejects an overlapping period at the same scope via an
 * exclusion constraint. Postgres reports that as SQLSTATE 23P01, which would
 * otherwise reach the operator as an unreadable constraint dump — so it is
 * translated into the one sentence that actually helps.
 */
function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code === "23P01") {
    return "Another active tariff period already covers part of these dates for the same vehicle or category. Adjust the dates, or edit the existing period instead.";
  }
  if (error.code === "23514") {
    return "Those values were rejected by a database rule. Check the dates and rates.";
  }
  return error.message;
}

async function replaceLocationLinks(periodId: string, locationIds: string[]) {
  const supabase = createAdminClient();
  await supabase.from("vehicle_tariff_period_locations").delete().eq("tariff_period_id", periodId);
  if (locationIds.length === 0) return;
  await supabase
    .from("vehicle_tariff_period_locations")
    .insert(locationIds.map((location_id) => ({ tariff_period_id: periodId, location_id })));
}

export async function createTariffPeriod(
  _prev: TariffFormState,
  formData: FormData
): Promise<TariffFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_tariffs");

  const parsed = tariffPeriodSchema.safeParse(readTariffFormData(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("vehicle_tariff_periods")
    .insert({ ...mapToRow(parsed.data), created_by: user.id })
    .select("id")
    .single();

  if (error) return { status: "error", error: describeWriteError(error) };

  await replaceLocationLinks(inserted.id, parsed.data.locationIds);
  revalidatePath("/admin/tariffs");
  return { status: "success" };
}

export async function updateTariffPeriod(
  id: string,
  _prev: TariffFormState,
  formData: FormData
): Promise<TariffFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_tariffs");

  const parsed = tariffPeriodSchema.safeParse(readTariffFormData(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicle_tariff_periods").update(mapToRow(parsed.data)).eq("id", id);
  if (error) return { status: "error", error: describeWriteError(error) };

  await replaceLocationLinks(id, parsed.data.locationIds);
  revalidatePath("/admin/tariffs");
  return { status: "success" };
}

export async function deleteTariffPeriod(id: string): Promise<TariffFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_tariffs");

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicle_tariff_periods").delete().eq("id", id);
  if (error) return { status: "error", error: describeWriteError(error) };

  revalidatePath("/admin/tariffs");
  return { status: "success" };
}

export async function toggleTariffPeriodActive(id: string, active: boolean): Promise<TariffFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_tariffs");

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicle_tariff_periods").update({ active }).eq("id", id);
  if (error) return { status: "error", error: describeWriteError(error) };

  revalidatePath("/admin/tariffs");
  return { status: "success" };
}
