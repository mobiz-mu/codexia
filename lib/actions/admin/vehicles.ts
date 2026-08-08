"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { processVehicleImage } from "@/lib/images/process-vehicle-image";
import { getRecentMaintenanceForVehicle } from "./maintenance";
import { getCurrentComplianceForVehicle } from "./compliance";
import { getRecentIncidentsForVehicle } from "./incidents";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const VEHICLES_PAGE_SIZE = 20;

export async function listVehiclesAdmin(rawFilters: { page?: string } = {}) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const page = Math.max(1, Number.parseInt(rawFilters.page ?? "1", 10) || 1);
  const from = (page - 1) * VEHICLES_PAGE_SIZE;
  const to = from + VEHICLES_PAGE_SIZE - 1;

  const supabase = createAdminClient();
  const { data, count } = await supabase
    .from("vehicles")
    .select("id, name, daily_price_cents, currency, status, is_demo, vehicle_categories(name_en)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    vehicles: (data ?? []) as unknown as {
      id: string;
      name: string;
      status: string;
      daily_price_cents: number;
      currency: string;
      is_demo: boolean;
      vehicle_categories: { name_en: string } | null;
    }[],
    total: count ?? 0,
    page,
    pageSize: VEHICLES_PAGE_SIZE,
  };
}

export async function getVehicleAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const [{ data: vehicle }, { data: images }, { data: categories }, recentMaintenance, currentCompliance, recentIncidents] =
    await Promise.all([
      supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
      supabase.from("vehicle_images").select("*").eq("vehicle_id", id).order("display_order", { ascending: true }),
      supabase.from("vehicle_categories").select("id, name_en").order("display_order", { ascending: true }),
      getRecentMaintenanceForVehicle(id, 5),
      getCurrentComplianceForVehicle(id),
      getRecentIncidentsForVehicle(id, 5),
    ]);

  return {
    vehicle,
    images: images ?? [],
    categories: categories ?? [],
    recentMaintenance,
    currentCompliance,
    recentIncidents,
  };
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
  // Unchecked HTML checkboxes are omitted from FormData entirely (not sent
  // as "false") — .default(false) covers the key being absent, not just
  // an empty/undefined value, which is what actually happens here. Verified
  // live: without this, saving a vehicle with any of these boxes unchecked
  // failed Zod validation instead of persisting false.
  airConditioning: z.coerce.boolean().default(false),
  bluetooth: z.coerce.boolean().default(false),
  gps: z.coerce.boolean().default(false),
  childSeatAvailable: z.coerce.boolean().default(false),
  status: z.enum(["draft", "active", "archived"]),
  featured: z.coerce.boolean().default(false),
  registrationNumber: z.string().trim().max(50).optional().or(z.literal("")),
  vin: z.string().trim().max(50).optional().or(z.literal("")),
  engineNumber: z.string().trim().max(50).optional().or(z.literal("")),
  // insurance_expiry/road_tax_expiry/fitness_expiry are LEGACY (added in
  // migration 0021, superseded by vehicle_compliance_records in migration
  // 0027) — deliberately no longer part of this form. The columns are not
  // dropped and are not written here; they're frozen at whatever value they
  // last held. See the retirement note above updateVehicle().
  lastServiceDate: z.string().trim().max(10).optional().or(z.literal("")),
  nextServiceDate: z.string().trim().max(10).optional().or(z.literal("")),
  currentMileageKm: z.coerce.number().int().min(0).optional().or(z.nan()),
  weeklyPriceCents: z.coerce.number().int().min(0).optional().or(z.nan()),
  monthlyPriceCents: z.coerce.number().int().min(0).optional().or(z.nan()),
  // Explicit, one-way confirmation gate for migrating a legacy MUR vehicle
  // to EUR — never a currency picker. Only present (and only ever true) on
  // the edit form for a vehicle that isn't EUR-priced yet; see updateVehicle.
  confirmEurRepricing: z.coerce.boolean().default(false),
});

/** Empty-string date/number inputs parse to "" or NaN — normalize both to null for storage. */
function toNullableDate(value: string | undefined) {
  return value ? value : null;
}
function toNullableNumber(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? null : value;
}

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
      bluetooth: parsed.data.bluetooth,
      gps: parsed.data.gps,
      child_seat_available: parsed.data.childSeatAvailable,
      status: parsed.data.status,
      featured: parsed.data.featured,
      is_demo: false,
      currency: "EUR",
      internal_registration_ref: parsed.data.registrationNumber || null,
      vin: parsed.data.vin || null,
      engine_number: parsed.data.engineNumber || null,
      // insurance_expiry/road_tax_expiry/fitness_expiry intentionally
      // omitted — legacy, superseded by vehicle_compliance_records, no
      // longer written from this form. See the schema comment above.
      last_service_date: toNullableDate(parsed.data.lastServiceDate),
      next_service_date: toNullableDate(parsed.data.nextServiceDate),
      current_mileage_km: toNullableNumber(parsed.data.currentMileageKm),
      weekly_price_cents: toNullableNumber(parsed.data.weeklyPriceCents),
      monthly_price_cents: toNullableNumber(parsed.data.monthlyPriceCents),
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

  updateTag("vehicles");

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

  // Only ever set currency here when the admin explicitly checked the
  // repricing-confirmation box on the edit form — never as a side effect of
  // an unrelated field edit, which would silently reinterpret old MUR cents
  // as EUR without the admin actually having re-entered EUR values.
  const currencyUpdate = parsed.data.confirmEurRepricing ? { currency: "EUR" as const } : {};

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
      bluetooth: parsed.data.bluetooth,
      gps: parsed.data.gps,
      child_seat_available: parsed.data.childSeatAvailable,
      status: parsed.data.status,
      featured: parsed.data.featured,
      internal_registration_ref: parsed.data.registrationNumber || null,
      vin: parsed.data.vin || null,
      engine_number: parsed.data.engineNumber || null,
      // insurance_expiry/road_tax_expiry/fitness_expiry intentionally
      // omitted — legacy, superseded by vehicle_compliance_records, no
      // longer written from this form. See the schema comment above.
      last_service_date: toNullableDate(parsed.data.lastServiceDate),
      next_service_date: toNullableDate(parsed.data.nextServiceDate),
      current_mileage_km: toNullableNumber(parsed.data.currentMileageKm),
      weekly_price_cents: toNullableNumber(parsed.data.weeklyPriceCents),
      monthly_price_cents: toNullableNumber(parsed.data.monthlyPriceCents),
      ...currencyUpdate,
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

  updateTag("vehicles");

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

const MAX_VEHICLE_IMAGE_SIZE = 8 * 1024 * 1024;

const ALLOWED_VEHICLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const VEHICLE_IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VARIANT_CONTENT_TYPE: Record<string, string> = { webp: "image/webp", avif: "image/avif" };

export async function uploadVehicleImage(vehicleId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const value = formData.get("image");
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: "Please choose an image." };
  }

  const file = value;
  if (file.size > MAX_VEHICLE_IMAGE_SIZE) {
    return { ok: false as const, error: "Image must be under 8 MB." };
  }
  if (!ALLOWED_VEHICLE_IMAGE_TYPES.has(file.type)) {
    return { ok: false as const, error: "Image must be JPEG, PNG, or WebP." };
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());

  const supabase = createAdminClient();

  const processed = await processVehicleImage(originalBuffer);

  const { data: duplicate } = await supabase
    .from("vehicle_images")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("content_hash", processed.contentHash)
    .maybeSingle();
  if (duplicate) {
    return { ok: false as const, error: "This exact image has already been uploaded for this vehicle." };
  }

  const extension = VEHICLE_IMAGE_EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${vehicleId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("vehicle-images")
    .upload(path, processed.strippedOriginal, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadVehicleImage failed", uploadError.message);
    return { ok: false as const, error: "Upload failed." };
  }

  // Variants are an enhancement, not the critical path — upload best-effort,
  // in parallel (up to 8 independent storage round trips otherwise), and
  // keep whichever ones succeed rather than failing the whole upload.
  const variantId = crypto.randomUUID();
  const variantUploadTasks = Object.entries(processed.variants).flatMap(([size, formats]) =>
    Object.entries(formats)
      .filter((entry): entry is [string, Buffer] => Boolean(entry[1]))
      .map(([format, buffer]) => ({ size, format, buffer, path: `${vehicleId}/variants/${variantId}-${size}.${format}` }))
  );

  const variantUploadResults = await Promise.all(
    variantUploadTasks.map(async (task) => {
      const { error: variantError } = await supabase.storage.from("vehicle-images").upload(task.path, task.buffer, {
        contentType: VARIANT_CONTENT_TYPE[task.format],
        cacheControl: "31536000",
        upsert: false,
      });
      if (variantError) {
        console.error(`uploadVehicleImage: variant upload failed (${task.size}/${task.format})`, variantError.message);
        return null;
      }
      return task;
    })
  );

  const variantPaths: Record<string, Record<string, string>> = {};
  for (const task of variantUploadResults) {
    if (!task) continue;
    variantPaths[task.size] = { ...variantPaths[task.size], [task.format]: task.path };
  }

  const { count, error: countError } = await supabase
    .from("vehicle_images")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  if (countError) {
    await supabase.storage.from("vehicle-images").remove([path]);
    console.error("Counting vehicle images failed", countError.message);
    return { ok: false as const, error: "Could not save the image." };
  }

  const { error: insertError } = await supabase.from("vehicle_images").insert({
    vehicle_id: vehicleId,
    path,
    display_order: count ?? 0,
    is_main: (count ?? 0) === 0,
    content_hash: processed.contentHash,
    variants: variantPaths,
    blur_data_url: processed.blurDataUrl,
  });

  if (insertError) {
    await supabase.storage.from("vehicle-images").remove([path]);
    console.error("Saving vehicle image failed", insertError.message);
    return { ok: false as const, error: "Could not save the image." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_image_uploaded",
    entity: "vehicle_images",
    entity_id: vehicleId,
    diff: { path, contentType: file.type, size: file.size },
  });

  return { ok: true as const };
}

export async function setMainImage(vehicleId: string, imageId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  await supabase.from("vehicle_images").update({ is_main: false }).eq("vehicle_id", vehicleId);
  await supabase.from("vehicle_images").update({ is_main: true }).eq("id", imageId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_image_set_main",
    entity: "vehicle_images",
    entity_id: imageId,
  });

  return { ok: true as const };
}

export async function deleteVehicleImage(vehicleId: string, imageId: string, path: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();

  const { data: image } = await supabase
    .from("vehicle_images")
    .select("variants")
    .eq("id", imageId)
    .maybeSingle();

  const variants = (image?.variants ?? {}) as Record<string, Record<string, string>>;
  const variantPaths = Object.values(variants).flatMap((formats) => Object.values(formats));

  // Storage removal must succeed before the DB row goes away — the opposite
  // order (or ignoring this result) risks an orphaned file in storage with
  // nothing left tracking it, since there'd be no row to retry the deletion
  // from.
  const { error: removeError } = await supabase.storage.from("vehicle-images").remove([path, ...variantPaths]);
  if (removeError) {
    console.error("deleteVehicleImage: storage removal failed", removeError.message);
    return { ok: false as const, error: "Failed to delete the image file. Please try again." };
  }

  await supabase.from("vehicle_images").delete().eq("id", imageId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "vehicle_image_deleted",
    entity: "vehicle_images",
    entity_id: imageId,
    diff: { vehicleId, path },
  });

  return { ok: true as const };
}

export async function reorderVehicleImage(imageId: string, direction: "up" | "down", vehicleId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

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
  await Promise.all([
    supabase.from("vehicle_images").update({ display_order: b.display_order }).eq("id", a.id),
    supabase.from("vehicle_images").update({ display_order: a.display_order }).eq("id", b.id),
  ]);

  return { ok: true as const };
}
