"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const { data } = await supabase.from("vehicles").select("id, name").order("name");
  return data ?? [];
}

export async function listBlocks(vehicleId?: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  let query = supabase
    .from("vehicle_blocks")
    .select("*, vehicles(name)")
    .order("created_at", { ascending: false });

  if (vehicleId) query = query.eq("vehicle_id", vehicleId);

  const { data } = await query;
  return (data ?? []) as unknown as {
    id: string;
    vehicle_id: string;
    period: string;
    type: "maintenance" | "internal";
    note: string | null;
    vehicles: { name: string } | null;
  }[];
}

const blockSchema = z.object({
  vehicleId: z.uuid(),
  type: z.enum(["maintenance", "internal"]),
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

  const supabase = createAdminClient();
  const start = new Date(parsed.data.startAt).toISOString();
  const end = new Date(parsed.data.endAt).toISOString();

  const { error } = await supabase.from("vehicle_blocks").insert({
    vehicle_id: parsed.data.vehicleId,
    type: parsed.data.type,
    note: parsed.data.note || null,
    period: `[${start},${end})`,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23P01") {
      return { status: "error", error: "This vehicle already has an overlapping block or booking." };
    }
    console.error("createBlock failed", error.message);
    return { status: "error", error: "Failed to create block." };
  }

  return { status: "success" };
}

export async function deleteBlock(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  await supabase.from("vehicle_blocks").delete().eq("id", id);
  return { ok: true as const };
}
