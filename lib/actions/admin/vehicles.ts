"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listVehiclesAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*, vehicle_categories(name_en)")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as (Record<string, unknown> & {
    id: string;
    slug: string;
    name: string;
    status: string;
    daily_price_cents: number;
    currency: string;
    is_demo: boolean;
    vehicle_categories: { name_en: string } | null;
  })[];
}

export async function getVehicleAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const [{ data: vehicle }, { data: images }, { data: categories }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    supabase.from("vehicle_images").select("*").eq("vehicle_id", id).order("display_order", { ascending: true }),
    supabase.from("vehicle_categories").select("id, name_en").order("display_order", { ascending: true }),
  ]);

  return { vehicle, images: images ?? [], categories: categories ?? [] };
}

const vehicleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1990).max(2100),
  categoryId: z.uuid(),
  descriptionEn: z.string().trim().max(2000).optional().or(z.literal("")),
  descriptionFr: z.string().trim().max(2000).optional().or(z.literal("")),
  dailyPriceCents: z.coerce.number().int().min(0),
  depositCents: z.coerce.number().int().min(0),
  passengers: z.coerce.number().int().min(1).max(20),
  doors: z.coerce.number().int().min(1).max(10),
  luggage: z.coerce.number().int().min(0).max(20),
  transmission: z.enum(["manual", "automatic"]),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  airConditioning: z.coerce.boolean(),
  status: z.enum(["draft", "active", "archived"]),
  featured: z.coerce.boolean(),
});

export type VehicleFormState = { status: "idle" | "success" | "error"; error?: string };

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createVehicle(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const slug = `${slugify(parsed.data.name)}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      slug,
      name: parsed.data.name,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      category_id: parsed.data.categoryId,
      description_en: parsed.data.descriptionEn || null,
      description_fr: parsed.data.descriptionFr || null,
      daily_price_cents: parsed.data.dailyPriceCents,
      deposit_cents: parsed.data.depositCents,
      passengers: parsed.data.passengers,
      doors: parsed.data.doors,
      luggage: parsed.data.luggage,
      transmission: parsed.data.transmission,
      fuel: parsed.data.fuel,
      air_conditioning: parsed.data.airConditioning,
      status: parsed.data.status,
      featured: parsed.data.featured,
      is_demo: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createVehicle failed", error.message);
    return { status: "error", error: "Failed to create vehicle." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_created",
    entity: "vehicles",
    entity_id: data.id,
  });

  return { status: "success" };
}

export async function updateVehicle(
  id: string,
  _prev: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
      name: parsed.data.name,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      category_id: parsed.data.categoryId,
      description_en: parsed.data.descriptionEn || null,
      description_fr: parsed.data.descriptionFr || null,
      daily_price_cents: parsed.data.dailyPriceCents,
      deposit_cents: parsed.data.depositCents,
      passengers: parsed.data.passengers,
      doors: parsed.data.doors,
      luggage: parsed.data.luggage,
      transmission: parsed.data.transmission,
      fuel: parsed.data.fuel,
      air_conditioning: parsed.data.airConditioning,
      status: parsed.data.status,
      featured: parsed.data.featured,
    })
    .eq("id", id);

  if (error) {
    console.error("updateVehicle failed", error.message);
    return { status: "error", error: "Failed to update vehicle." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_updated",
    entity: "vehicles",
    entity_id: id,
  });

  return { status: "success" };
}

export async function duplicateVehicle(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data: original } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!original) return { ok: false as const, error: "Vehicle not found" };

  const newSlug = `${slugify(original.name)}-copy-${Date.now().toString(36)}`;

  const { data: created, error } = await supabase
    .from("vehicles")
    .insert({
      ...original,
      id: undefined,
      slug: newSlug,
      created_at: undefined,
      updated_at: undefined,
      status: "draft",
      featured: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("duplicateVehicle failed", error.message);
    return { ok: false as const, error: "Failed to duplicate vehicle." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_duplicated",
    entity: "vehicles",
    entity_id: created.id,
    diff: { from: id },
  });

  return { ok: true as const, newId: created.id };
}

export async function archiveVehicle(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").update({ status: "archived" }).eq("id", id);

  if (error) return { ok: false as const, error: "Failed to archive vehicle." };

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_archived",
    entity: "vehicles",
    entity_id: id,
  });

  return { ok: true as const };
}

export async function uploadVehicleImage(vehicleId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { ok: false as const, error: "Please choose an image." };
  if (file.size > 8 * 1024 * 1024) return { ok: false as const, error: "Image must be under 8MB." };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop();
  const path = `${vehicleId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("vehicle-images")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    console.error("uploadVehicleImage failed", uploadError.message);
    return { ok: false as const, error: "Upload failed." };
  }

  const { count } = await supabase
    .from("vehicle_images")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  await supabase.from("vehicle_images").insert({
    vehicle_id: vehicleId,
    path,
    display_order: count ?? 0,
    is_main: (count ?? 0) === 0,
  });

  return { ok: true as const };
}

export async function setMainImage(vehicleId: string, imageId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("vehicle_images").update({ is_main: false }).eq("vehicle_id", vehicleId);
  await supabase.from("vehicle_images").update({ is_main: true }).eq("id", imageId);
  return { ok: true as const };
}

export async function deleteVehicleImage(vehicleId: string, imageId: string, path: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.storage.from("vehicle-images").remove([path]);
  await supabase.from("vehicle_images").delete().eq("id", imageId);
  return { ok: true as const };
}

export async function reorderVehicleImage(imageId: string, direction: "up" | "down", vehicleId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: images } = await supabase
    .from("vehicle_images")
    .select("id, display_order")
    .eq("vehicle_id", vehicleId)
    .order("display_order", { ascending: true });

  if (!images) return { ok: false as const };
  const index = images.findIndex((img) => img.id === imageId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= images.length) return { ok: true as const };

  const a = images[index];
  const b = images[swapIndex];
  await supabase.from("vehicle_images").update({ display_order: b.display_order }).eq("id", a.id);
  await supabase.from("vehicle_images").update({ display_order: a.display_order }).eq("id", b.id);

  return { ok: true as const };
}
