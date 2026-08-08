"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser, getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { maintenanceSchema, normalizeMaintenanceListFilters, sanitizeSearchTerm } from "@/lib/maintenance/schema";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const PAGE_SIZE = 20;

const LIST_COLUMNS =
  "id, vehicle_id, maintenance_date, maintenance_type, custom_type, mileage_km, service_provider, cost_cents, remarks, created_at, vehicles(name)";

export type MaintenanceListRow = {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  maintenance_type: string;
  custom_type: string | null;
  mileage_km: number | null;
  service_provider: string | null;
  cost_cents: number;
  remarks: string | null;
  created_at: string;
  vehicles: { name: string } | null;
};

export async function listMaintenanceRecordsAdmin(rawFilters: {
  vehicleId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  search?: string;
  page?: string;
}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_maintenance");

  const filters = normalizeMaintenanceListFilters(rawFilters);
  const supabase = createAdminClient();

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("vehicle_maintenance_records")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("maintenance_date", { ascending: false })
    .range(from, to);

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.dateFrom) query = query.gte("maintenance_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("maintenance_date", filters.dateTo);
  if (filters.type) query = query.eq("maintenance_type", filters.type);
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term.length > 0) {
      query = query.or(`remarks.ilike.%${term}%,service_provider.ilike.%${term}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("listMaintenanceRecordsAdmin failed", error.message);
    return { records: [] as MaintenanceListRow[], total: 0, page: filters.page, pageSize: PAGE_SIZE, filters };
  }

  return {
    records: (data ?? []) as unknown as MaintenanceListRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    filters,
  };
}

export async function getMaintenanceRecordAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_maintenance");

  const supabase = createAdminClient();
  const [{ data: record }, { data: attachments }] = await Promise.all([
    supabase.from("vehicle_maintenance_records").select("*, vehicles(name)").eq("id", id).maybeSingle(),
    supabase
      .from("vehicle_maintenance_attachments")
      .select("id, file_name, mime_type, size_bytes, storage_path, created_at")
      .eq("maintenance_record_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return { record, attachments: attachments ?? [] };
}

// Non-throwing on purpose — this backs an auxiliary "Recent Maintenance"
// panel on the vehicle detail page, which is otherwise gated only on
// manage_vehicles. An admin with manage_vehicles but not view_maintenance
// should still be able to open the vehicle page; the panel just stays empty
// for them rather than the whole page erroring out.
export async function getRecentMaintenanceForVehicle(vehicleId: string, limit = 5) {
  const user = await getCurrentAdminUser();
  if (!user || !user.permissions.has("view_maintenance")) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicle_maintenance_records")
    .select("id, maintenance_date, maintenance_type, custom_type, cost_cents, service_provider")
    .eq("vehicle_id", vehicleId)
    .order("maintenance_date", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function listVehiclesForMaintenanceSelect() {
  const user = await requireAdminUser();
  assertPermission(user, "view_maintenance");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  return data ?? [];
}

export type MaintenanceFormState = { status: "idle" | "success" | "error"; error?: string };

function mapToRow(parsed: ReturnType<typeof maintenanceSchema.safeParse> & { success: true }) {
  const d = parsed.data;
  return {
    vehicle_id: d.vehicleId,
    maintenance_date: d.maintenanceDate,
    maintenance_type: d.maintenanceType,
    custom_type: d.customType,
    repairs_performed: d.repairsPerformed,
    parts_changed: d.partsChanged,
    tyre_changes: d.tyreChanges,
    battery_changes: d.batteryChanges,
    servicing_details: d.servicingDetails,
    oil_filter_changes: d.oilFilterChanges,
    brake_work: d.brakeWork,
    suspension_work: d.suspensionWork,
    electrical_work: d.electricalWork,
    mileage_km: d.mileageKm,
    service_provider: d.serviceProvider,
    cost_cents: d.costEur,
    remarks: d.remarks,
  };
}

// Only called when the admin explicitly checked "Update vehicle current
// service information from this record" — never automatic. Backfilling an
// old record must not silently move the vehicle's live last_service_date
// backward or overwrite its current mileage with a stale figure.
async function applyVehicleInfoUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  vehicleId: string,
  maintenanceDate: string,
  mileageKm: number | null
) {
  const { error } =
    mileageKm !== null
      ? await supabase
          .from("vehicles")
          .update({ last_service_date: maintenanceDate, current_mileage_km: mileageKm })
          .eq("id", vehicleId)
      : await supabase.from("vehicles").update({ last_service_date: maintenanceDate }).eq("id", vehicleId);

  if (error) console.error("applyVehicleInfoUpdate failed", error.message);
}

export async function createMaintenanceRecord(
  _prev: MaintenanceFormState,
  formData: FormData
): Promise<MaintenanceFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  const { data: inserted, error } = await supabase
    .from("vehicle_maintenance_records")
    .insert({ ...mapToRow(parsed), created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createMaintenanceRecord failed", error?.message);
    return { status: "error", error: "Failed to save maintenance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "maintenance_record_created",
    entity: "vehicle_maintenance_records",
    entity_id: inserted.id,
    diff: {
      vehicle_id: parsed.data.vehicleId,
      maintenance_type: parsed.data.maintenanceType,
      cost_cents: parsed.data.costEur,
    },
  });

  if (parsed.data.updateVehicleInfo) {
    await applyVehicleInfoUpdate(supabase, parsed.data.vehicleId, parsed.data.maintenanceDate, parsed.data.mileageKm);
  }

  return { status: "success" };
}

export async function updateMaintenanceRecord(
  id: string,
  _prev: MaintenanceFormState,
  formData: FormData
): Promise<MaintenanceFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  const { error } = await supabase.from("vehicle_maintenance_records").update(mapToRow(parsed)).eq("id", id);

  if (error) {
    console.error("updateMaintenanceRecord failed", error.message);
    return { status: "error", error: "Failed to update maintenance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "maintenance_record_updated",
    entity: "vehicle_maintenance_records",
    entity_id: id,
    diff: {
      vehicle_id: parsed.data.vehicleId,
      maintenance_type: parsed.data.maintenanceType,
      cost_cents: parsed.data.costEur,
    },
  });

  if (parsed.data.updateVehicleInfo) {
    await applyVehicleInfoUpdate(supabase, parsed.data.vehicleId, parsed.data.maintenanceDate, parsed.data.mileageKm);
  }

  return { status: "success" };
}

export async function deleteMaintenanceRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const supabase = createAdminClient();

  const { error } = await supabase.from("vehicle_maintenance_records").delete().eq("id", id);
  if (error) {
    console.error("deleteMaintenanceRecord failed", error.message);
    return { ok: false, error: "Failed to delete maintenance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "maintenance_record_deleted",
    entity: "vehicle_maintenance_records",
    entity_id: id,
  });

  return { ok: true };
}

const MAX_MAINTENANCE_DOCUMENT_SIZE = 15 * 1024 * 1024;

const ALLOWED_MAINTENANCE_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const MAINTENANCE_DOCUMENT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadMaintenanceAttachment(recordId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const value = formData.get("document");
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: "Please choose a file." };
  }

  if (value.size > MAX_MAINTENANCE_DOCUMENT_SIZE) {
    return { ok: false as const, error: "File must be under 15 MB." };
  }
  if (!ALLOWED_MAINTENANCE_DOCUMENT_TYPES.has(value.type)) {
    return { ok: false as const, error: "File must be a PDF, JPEG, PNG, or WebP." };
  }

  const supabase = createAdminClient();

  const { data: record } = await supabase
    .from("vehicle_maintenance_records")
    .select("id")
    .eq("id", recordId)
    .maybeSingle();
  if (!record) return { ok: false as const, error: "Maintenance record not found." };

  const extension = MAINTENANCE_DOCUMENT_EXTENSION_BY_MIME_TYPE[value.type];
  const path = `${recordId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await value.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("maintenance-documents")
    .upload(path, buffer, { contentType: value.type, upsert: false });

  if (uploadError) {
    console.error("uploadMaintenanceAttachment failed", uploadError.message);
    return { ok: false as const, error: "Failed to upload file." };
  }

  const { error: insertError } = await supabase.from("vehicle_maintenance_attachments").insert({
    maintenance_record_id: recordId,
    storage_path: path,
    file_name: value.name,
    mime_type: value.type,
    size_bytes: value.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error("uploadMaintenanceAttachment insert failed", insertError.message);
    return { ok: false as const, error: "Failed to save attachment record." };
  }

  return { ok: true as const };
}

export async function getMaintenanceAttachmentSignedUrl(storagePath: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_maintenance");

  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("maintenance-documents").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteMaintenanceAttachment(attachmentId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const supabase = createAdminClient();

  const { data: attachment } = await supabase
    .from("vehicle_maintenance_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) return { ok: false as const, error: "Attachment not found." };

  await supabase.storage.from("maintenance-documents").remove([attachment.storage_path]);
  const { error } = await supabase.from("vehicle_maintenance_attachments").delete().eq("id", attachmentId);

  if (error) {
    console.error("deleteMaintenanceAttachment failed", error.message);
    return { ok: false as const, error: "Failed to delete attachment." };
  }

  return { ok: true as const };
}
