"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  insertVehicleBlock,
  releaseVehicleBlock,
  type BlockReleaseOutcome,
  type VehicleBlockType,
} from "@/lib/fleet/vehicle-blocks";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listVehicleOptions() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");
  const supabase = createAdminClient();
  const { data } = await supabase.from("vehicles").select("id, name").order("name").limit(500);
  return data ?? [];
}

export async function listBlocks(vehicleId?: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  let query = supabase
    .from("vehicle_blocks")
    .select("id, vehicle_id, period, type, note, vehicles(name)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (vehicleId) query = query.eq("vehicle_id", vehicleId);

  const { data } = await query;
  return (data ?? []) as unknown as {
    id: string;
    vehicle_id: string;
    period: string;
    type: VehicleBlockType;
    note: string | null;
    vehicles: { name: string } | null;
  }[];
}

const blockSchema = z.object({
  vehicleId: z.uuid(),
  type: z.enum(["maintenance", "internal", "preparing", "cleaning"]),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type BlockFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createBlock(_prev: BlockFormState, formData: FormData): Promise<BlockFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  if (new Date(parsed.data.endAt) <= new Date(parsed.data.startAt)) {
    return { status: "error", error: "End date must be after start date." };
  }

  const result = await insertVehicleBlock({
    vehicleId: parsed.data.vehicleId,
    type: parsed.data.type,
    note: parsed.data.note,
    startAt: new Date(parsed.data.startAt).toISOString(),
    endAt: new Date(parsed.data.endAt).toISOString(),
    actorId: user.id,
  });

  if (!result.ok) return { status: "error", error: result.error };
  return { status: "success" };
}

// Ends a block rather than deleting it outright — the single way the manual
// Availability screen, and anything else an operator drives, gives a vehicle
// back to the fleet.
//
// There used to be a `deleteBlock` beside this that ran an unconditional
// `delete().eq("id", id)`. It was reachable from the Remove control on every
// row of /admin/availability, including rows owned by a maintenance, incident
// or inspection record — and because those FKs are ON DELETE SET NULL, using
// it on a block that had already started erased downtime the vehicle really
// did undergo while leaving the owning record still claiming it. That is the
// exact history vehicle_blocks exists to hold, so the hard-delete path is
// gone: every operator-initiated release now goes through the same primitive
// as Maintenance, Incidents and Inspections.
//
//   not started yet -> removed    (no history to keep)
//   already running -> shortened  (ends now, the period it ran is preserved)
//   already gone    -> reported, not treated as success
//   any failure     -> fail closed with a message an operator can act on
//
// Gated on manage_vehicles (same permission as every other vehicle_blocks
// operation in this file, not a new incident-specific check) — all three roles
// granted manage_incidents already have manage_vehicles today, so this creates
// no practical access gap.
export async function closeBlockEarly(
  blockId: string
): Promise<{ ok: boolean; outcome?: BlockReleaseOutcome; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const result = await releaseVehicleBlock(supabase, blockId);

  if (!result.ok) return { ok: false, error: result.error };

  // An operator who explicitly asked to close a specific block should be told
  // when it is no longer there, even though the record-deletion callers treat
  // the same outcome as success.
  if (result.outcome === "already_gone") return { ok: false, error: "That block no longer exists." };

  return { ok: true, outcome: result.outcome };
}

const BOARD_ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

export type AvailabilityBoardBooking = {
  id: string;
  reference: string;
  status: string;
  /** Channel the reservation arrived through — drives the board colour. */
  source: "website" | "admin";
  vehicleId: string;
  customerName: string;
  pickupAt: string;
  returnAt: string;
};

export type AvailabilityBoardBlock = {
  id: string;
  vehicleId: string;
  type: VehicleBlockType;
  note: string | null;
  startAt: string;
  endAt: string;
};

export type AvailabilityBoardVehicle = {
  id: string;
  name: string;
  brand: string;
  model: string;
  transmission: "manual" | "automatic";
  registration: string | null;
  categoryId: string;
  isStaffCar: boolean;
  imageUrl: string | null;
};

export type AvailabilityBoardCategory = { id: string; name: string; slug: string };

/**
 * Data for the hotel-style planning board: one row per active vehicle, with
 * bookings/blocks that overlap the given [startDate, startDate + days) window.
 */
export async function getAvailabilityBoardData(
  startDate: string,
  days: number
): Promise<{
  vehicles: AvailabilityBoardVehicle[];
  categories: AvailabilityBoardCategory[];
  bookings: AvailabilityBoardBooking[];
  blocks: AvailabilityBoardBlock[];
}> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const windowStart = new Date(startDate).toISOString();
  const windowEnd = new Date(new Date(startDate).getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  // Five bulk reads for the whole window, issued in parallel — never one per
  // vehicle and never one per day. Bookings and blocks are both bounded by
  // the window, so widening the range costs rows, not round trips.
  const [{ data: vehicles }, { data: categories }, { data: rawBookings }, { data: blocks }, { data: images }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, name, brand, model, transmission, internal_registration_ref, category_id, is_staff_car"
        )
        .neq("status", "archived")
        .order("name"),
      supabase.from("vehicle_categories").select("id, name_en, slug").order("display_order"),
      supabase
        .from("bookings")
        .select(
          "id, reference, status, source, vehicle_id, pickup_at, return_at, booking_customers(full_name)"
        )
        .in("status", BOARD_ACTIVE_STATUSES)
        .not("vehicle_id", "is", null)
        .lt("pickup_at", windowEnd)
        .gt("return_at", windowStart),
      supabase
        .from("vehicle_blocks")
        .select("id, vehicle_id, type, note, period")
        .filter("period", "ov", `[${windowStart},${windowEnd})`),
      supabase.from("vehicle_images").select("vehicle_id, path, variants, is_main").eq("is_main", true),
    ]);

  const bookings = (rawBookings ?? []) as unknown as {
    id: string;
    reference: string;
    status: string;
    source: "website" | "admin";
    vehicle_id: string;
    pickup_at: string;
    return_at: string;
    booking_customers: { full_name: string } | { full_name: string }[] | null;
  }[];

  const imageByVehicle = new Map<string, string>();
  for (const img of images ?? []) {
    const variants = img.variants as Record<string, string> | null;
    // Prefer the smallest generated variant — the board renders these at
    // roughly 56px, so shipping a hero image per row would be wasteful.
    const path = variants?.thumb ?? variants?.card ?? img.path;
    const url = publicStorageUrl("vehicle-images", path);
    if (url) imageByVehicle.set(img.vehicle_id, url);
  }

  return {
    vehicles: (vehicles ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      brand: v.brand,
      model: v.model,
      transmission: v.transmission,
      registration: v.internal_registration_ref,
      categoryId: v.category_id,
      isStaffCar: v.is_staff_car,
      imageUrl: imageByVehicle.get(v.id) ?? null,
    })),
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name_en, slug: c.slug })),
    bookings: bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      source: b.source ?? "website",
      vehicleId: b.vehicle_id,
      customerName: Array.isArray(b.booking_customers)
        ? (b.booking_customers[0]?.full_name ?? "")
        : (b.booking_customers?.full_name ?? ""),
      pickupAt: b.pickup_at,
      returnAt: b.return_at,
    })),
    blocks: (blocks ?? []).map((block) => {
      const match = /\[([^,]+),([^)]+)\)/.exec(block.period as unknown as string);
      return {
        id: block.id,
        vehicleId: block.vehicle_id,
        type: block.type,
        note: block.note,
        startAt: match?.[1] ?? windowStart,
        endAt: match?.[2] ?? windowEnd,
      };
    }),
  };
}
