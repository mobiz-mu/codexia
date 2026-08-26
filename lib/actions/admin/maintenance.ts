"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { insertVehicleBlock, releaseVehicleBlock, type BlockReleaseOutcome } from "@/lib/fleet/vehicle-blocks";
import { requireAdminUser, getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { maintenanceSchema, normalizeMaintenanceListFilters, sanitizeSearchTerm } from "@/lib/maintenance/schema";
import { closeBlockEarly } from "@/lib/actions/admin/availability";
import { findAvailabilityConflicts } from "@/lib/booking/availability-conflicts";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const PAGE_SIZE = 20;

const LIST_COLUMNS =
  "id, vehicle_id, maintenance_date, maintenance_type, custom_type, mileage_km, service_provider, invoice_reference, cost_cents, parts_cost_cents, labour_cost_cents, other_cost_cents, availability_block_id, next_service_date, remarks, created_at, vehicles(name, brand, model, transmission, internal_registration_ref)";

export type MaintenanceListRow = {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  maintenance_type: string;
  custom_type: string | null;
  mileage_km: number | null;
  service_provider: string | null;
  invoice_reference: string | null;
  cost_cents: number;
  parts_cost_cents: number;
  labour_cost_cents: number;
  other_cost_cents: number;
  availability_block_id: string | null;
  next_service_date: string | null;
  remarks: string | null;
  created_at: string;
  vehicles: {
    name: string;
    brand: string;
    model: string;
    transmission: 'manual' | 'automatic';
    internal_registration_ref: string | null;
  } | null;
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
    supabase
      .from("vehicle_maintenance_records")
      // Vehicle identity comes back on the same read the record does, so the
      // detail header can show the car rather than just its name in a title.
      .select("*, vehicles(name, brand, model, transmission, internal_registration_ref)")
      .eq("id", id)
      .maybeSingle(),
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

/**
 * Take a vehicle off the road for maintenance, through the SAME
 * vehicle_blocks primitive incidents and manual blocks already use.
 *
 * There is one unavailability engine; this is a second caller, not a second
 * system. Conflicts are explained in the operator's own terms — naming the
 * booking or block in the way — rather than surfacing an exclusion-constraint
 * error, and nothing is written until the window is genuinely free.
 */
async function createMaintenanceDowntime(input: {
  vehicleId: string;
  startAt: string;
  endAt: string;
  note: string;
  actorId: string;
}): Promise<{ ok: true; blockId: string } | { ok: false; error: string }> {
  const startIso = new Date(input.startAt).toISOString();
  const endIso = new Date(input.endAt).toISOString();

  const conflicts = await findAvailabilityConflicts(input.vehicleId, startIso, endIso);
  if (conflicts.length > 0) {
    const detail = conflicts
      .map((c) => `${c.label} (${c.detail}) ${c.from} → ${c.to}`)
      .join("; ");
    return {
      ok: false,
      error: `Cannot take this vehicle off the road for that window — it clashes with: ${detail}. Resolve the clash first; nothing has been changed.`,
    };
  }

  const result = await insertVehicleBlock({
    vehicleId: input.vehicleId,
    type: "maintenance",
    note: input.note,
    startAt: startIso,
    endAt: endIso,
    actorId: input.actorId,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, blockId: result.blockId };
}

/**
 * Return a vehicle to service early, when the work finished sooner than
 * planned.
 *
 * Uses the shared closeBlockEarly primitive rather than deleting the block:
 * a block that has already started is shortened to end now, so the record of
 * the car having genuinely been off the road survives. Only a block that has
 * not started yet is removed outright, because there is no history to keep.
 * The maintenance record itself is untouched either way — the service
 * happened regardless of when the car went back on the road.
 */
export async function closeMaintenanceDowntime(
  recordId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_maintenance");

  const supabase = createAdminClient();
  const { data: record } = await supabase
    .from("vehicle_maintenance_records")
    .select("id, availability_block_id")
    .eq("id", recordId)
    .maybeSingle();

  if (!record) return { ok: false, error: "Maintenance record not found." };
  if (!record.availability_block_id) {
    return { ok: false, error: "This record has no downtime to close." };
  }

  const result = await closeBlockEarly(record.availability_block_id);
  if (!result.ok) return result;

  // The block may have been deleted outright (if it had not started), so drop
  // the dangling reference rather than leaving a link to nothing.
  await supabase
    .from("vehicle_maintenance_records")
    .update({ availability_block_id: null })
    .eq("id", recordId);

  return { ok: true };
}

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
    invoice_reference: d.invoiceReference,
    // cost_cents is the authoritative MUR total; the three components are an
    // optional breakdown and are summed into it when the operator uses them.
    cost_cents: d.costMur > 0 ? d.costMur : d.partsCostMur + d.labourCostMur + d.otherCostMur,
    parts_cost_cents: d.partsCostMur,
    labour_cost_cents: d.labourCostMur,
    other_cost_cents: d.otherCostMur,
    next_service_date: d.nextServiceDate,
    next_service_mileage_km: d.nextServiceMileageKm,
    remarks: d.remarks,
    source_inspection_id: d.sourceInspectionId,
    source_inspection_followup_key: d.sourceInspectionFollowupKey,
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

  // Downtime is created BEFORE the record, so a clash with an existing
  // booking or block aborts the whole thing. Writing the history first and
  // discovering the conflict afterwards would leave a record claiming the car
  // was off the road when it never was.
  let blockId: string | null = null;
  if (parsed.data.markUnavailable && parsed.data.downtimeStart && parsed.data.downtimeEnd) {
    const downtime = await createMaintenanceDowntime({
      vehicleId: parsed.data.vehicleId,
      startAt: parsed.data.downtimeStart,
      endAt: parsed.data.downtimeEnd,
      note: parsed.data.serviceProvider ? `Maintenance — ${parsed.data.serviceProvider}` : "Maintenance",
      actorId: user.id,
    });
    if (!downtime.ok) return { status: "error", error: downtime.error };
    blockId = downtime.blockId;
  }

  const { data: inserted, error } = await supabase
    .from("vehicle_maintenance_records")
    .insert({ ...mapToRow(parsed), availability_block_id: blockId, created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    // Don't strand the block we just took out on the vehicle.
    if (blockId) await supabase.from("vehicle_blocks").delete().eq("id", blockId);

    // 23505 on the follow-up index means a concurrent request won the race to
    // raise this exact selection. That is a duplicate, not a failure, and the
    // operator gets told in their own terms rather than shown a constraint.
    if (error?.code === "23505" && error.message.includes("inspection_followup")) {
      return {
        status: "error",
        error: "A maintenance follow-up for these inspection defects already exists.",
      };
    }

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
      cost_cents: parsed.data.costMur,
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
      cost_cents: parsed.data.costMur,
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

  // Same hazard as the incident path, and deliberately the same primitive so
  // the two cannot drift: a maintenance record that opted into downtime owns
  // the only reference to its vehicle_blocks row, so deleting it alone would
  // strand the block and hold the vehicle off the road with nothing to
  // explain it. Release first, fail-closed, then delete.
  const { data: existing } = await supabase
    .from("vehicle_maintenance_records")
    .select("availability_block_id")
    .eq("id", id)
    .maybeSingle();

  let blockOutcome: BlockReleaseOutcome | null = null;
  if (existing?.availability_block_id) {
    const release = await releaseVehicleBlock(supabase, existing.availability_block_id);
    if (!release.ok) {
      return {
        ok: false,
        error: `${release.error} The maintenance record was not deleted, so the vehicle's downtime stays linked to it.`,
      };
    }
    blockOutcome = release.outcome;
  }

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
    diff: blockOutcome ? { availability_block: blockOutcome } : null,
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
