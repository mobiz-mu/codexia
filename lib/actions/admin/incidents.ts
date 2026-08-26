"use server";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser, getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { incidentSchema, normalizeIncidentListFilters, sanitizeSearchTerm } from "@/lib/incidents/schema";
import { OPEN_REPAIR_STATUSES, type Severity } from "@/lib/incidents/schema";
import { ATTACHMENT_CATEGORIES, type AttachmentCategory } from "@/lib/incidents/schema";
import { closeBlockEarly } from "./availability";
import { insertVehicleBlock, releaseVehicleBlock, type BlockReleaseOutcome } from "@/lib/fleet/vehicle-blocks";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 20;

const LIST_COLUMNS =
  "id, vehicle_id, incident_date, incident_type, custom_type, severity, repair_status, location, estimated_repair_cost_cents, actual_repair_cost_cents, availability_block_id, downtime_start, downtime_end, created_at, vehicles(name, brand, model, transmission, internal_registration_ref)";

export type IncidentListRow = {
  id: string;
  vehicle_id: string;
  incident_date: string;
  incident_type: string;
  custom_type: string | null;
  severity: string;
  repair_status: string;
  location: string | null;
  estimated_repair_cost_cents: number | null;
  actual_repair_cost_cents: number | null;
  availability_block_id: string | null;
  downtime_start: string | null;
  downtime_end: string | null;
  created_at: string;
  vehicles: {
    name: string;
    brand: string;
    model: string;
    transmission: 'manual' | 'automatic';
    internal_registration_ref: string | null;
  } | null;
};

export async function listIncidentRecordsAdmin(rawFilters: {
  vehicleId?: string;
  severity?: string;
  repairStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: string;
}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const filters = normalizeIncidentListFilters(rawFilters);
  const supabase = createAdminClient();

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("vehicle_incident_records")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("incident_date", { ascending: false })
    .range(from, to);

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.repairStatus) query = query.eq("repair_status", filters.repairStatus);
  if (filters.dateFrom) query = query.gte("incident_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("incident_date", filters.dateTo);
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term.length > 0) {
      query = query.or(
        `location.ilike.%${term}%,police_report_reference.ilike.%${term}%,insurance_claim_reference.ilike.%${term}%,remarks.ilike.%${term}%`
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("listIncidentRecordsAdmin failed", error.message);
    return { records: [] as IncidentListRow[], total: 0, page: filters.page, pageSize: PAGE_SIZE, filters };
  }

  return {
    records: (data ?? []) as unknown as IncidentListRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    filters,
  };
}

export async function getIncidentRecordAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const supabase = createAdminClient();
  const [{ data: record }, { data: attachments }] = await Promise.all([
    supabase
      .from("vehicle_incident_records")
      .select(
        "*, vehicles(name, brand, model, transmission, internal_registration_ref), bookings(reference)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vehicle_incident_attachments")
      .select("id, category, file_name, mime_type, size_bytes, storage_path, created_at")
      .eq("incident_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return { record, attachments: attachments ?? [] };
}

// Non-throwing — backs the vehicle-detail compact Accidents & Damage
// section, reachable by anyone with manage_vehicles even without
// view_incidents; the section just renders empty for them rather than
// breaking the vehicle page. Returns both a bounded "recent" list (for
// display) and a genuine open-incident COUNT (a cheap head-count query, not
// derived from the bounded recent list, which could otherwise undercount if
// more than `limit` incidents exist).
export async function getRecentIncidentsForVehicle(vehicleId: string, limit = 5) {
  const user = await getCurrentAdminUser();
  if (!user || !user.permissions.has("view_incidents")) return { recent: [], openCount: 0 };

  const supabase = createAdminClient();
  const [{ data: recent }, { count: openCount }] = await Promise.all([
    supabase
      .from("vehicle_incident_records")
      .select(
        "id, incident_date, incident_type, custom_type, severity, repair_status, estimated_repair_cost_cents, actual_repair_cost_cents, downtime_start, downtime_end"
      )
      .eq("vehicle_id", vehicleId)
      .order("incident_date", { ascending: false })
      .limit(limit),
    supabase
      .from("vehicle_incident_records")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .in("repair_status", OPEN_REPAIR_STATUSES),
  ]);

  return { recent: recent ?? [], openCount: openCount ?? 0 };
}

export async function listVehiclesForIncidentSelect() {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  return data ?? [];
}

export type IncidentFormState = { status: "idle" | "success" | "error"; error?: string };

function mapToRow(parsed: { data: ReturnType<typeof incidentSchema.parse> }, bookingId: string | null) {
  const d = parsed.data;
  return {
    vehicle_id: d.vehicleId,
    booking_id: bookingId,
    incident_date: d.incidentDate,
    incident_time: d.incidentTime,
    location: d.location,
    driver_customer_name: d.driverCustomerName,
    incident_type: d.incidentType,
    custom_type: d.customType,
    accident_description: d.accidentDescription,
    damage_description: d.damageDescription,
    affected_areas: d.affectedAreas,
    police_report_reference: d.policeReportReference,
    insurance_claim_reference: d.insuranceClaimReference,
    third_party_details: d.thirdPartyDetails,
    estimated_repair_cost_cents: d.estimatedRepairCostMur,
    actual_repair_cost_cents: d.actualRepairCostMur,
    vehicle_operational_status: d.vehicleOperationalStatus,
    repair_status: d.repairStatus,
    severity: d.severity,
    date_reported: d.dateReported,
    date_repair_started: d.dateRepairStarted,
    date_repaired: d.dateRepaired,
    downtime_start: d.downtimeStart,
    downtime_end: d.downtimeEnd,
    remarks: d.remarks,
  };
}

// Audit diffs deliberately exclude free-text fields that can carry customer
// or third-party PII (driver_customer_name, third_party_details,
// descriptions, remarks, police/insurance reference numbers) — only
// structural facts are recorded.
function auditDiff(d: ReturnType<typeof incidentSchema.parse>) {
  return {
    vehicle_id: d.vehicleId,
    incident_type: d.incidentType,
    severity: d.severity,
    repair_status: d.repairStatus,
  };
}

async function resolveBookingId(
  supabase: ReturnType<typeof createAdminClient>,
  reference: string | null
): Promise<{ ok: true; bookingId: string | null } | { ok: false; error: string }> {
  if (!reference) return { ok: true, bookingId: null };

  const { data } = await supabase.from("bookings").select("id").eq("reference", reference).maybeSingle();
  if (!data) return { ok: false, error: "Booking reference not found." };
  return { ok: true, bookingId: data.id };
}

// Reads and validates the optional availability-block request from the
// form WITHOUT touching the database — kept as a pure step so an invalid
// request (checkbox checked, but times missing/malformed/out of order) is
// caught and reported to the admin before anything is written, rather than
// silently skipping block creation while the incident still saves. Never
// triggered by anything other than the explicit checkbox — in particular,
// selecting vehicle_operational_status = "not_operational" does NOT imply
// a block on its own.
function readAvailabilityBlockRequest(
  formData: FormData
): { wantsBlock: false } | { wantsBlock: true; startAt: string; endAt: string } | { wantsBlock: true; error: string } {
  const wantsBlock = formData.get("createAvailabilityBlock") === "true";
  if (!wantsBlock) return { wantsBlock: false };

  const startRaw = formData.get("blockStartAt");
  const endRaw = formData.get("blockEndAt");
  if (typeof startRaw !== "string" || typeof endRaw !== "string" || !startRaw || !endRaw) {
    return { wantsBlock: true, error: "Please provide both a start and end time for the availability block." };
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { wantsBlock: true, error: "The availability block start/end times are not valid dates." };
  }
  if (end <= start) {
    return { wantsBlock: true, error: "The availability block end time must be after the start time." };
  }

  return { wantsBlock: true, startAt: start.toISOString(), endAt: end.toISOString() };
}

async function createAvailabilityBlock(
  vehicleId: string,
  startAt: string,
  endAt: string,
  actorId: string
): Promise<{ ok: true; blockId: string } | { ok: false; error: string }> {
  const result = await insertVehicleBlock({
    vehicleId,
    type: "incident",
    note: "Created from an accident/damage incident record.",
    startAt,
    endAt,
    actorId,
  });
  return result.ok ? { ok: true, blockId: result.blockId } : { ok: false, error: result.error };
}

export async function createIncidentRecord(
  _prev: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  // Validated before any write — an invalid block request (checkbox
  // checked, times missing/malformed/out of order) must be reported to the
  // admin, not silently dropped while the incident still saves.
  const blockRequest = readAvailabilityBlockRequest(formData);
  if (blockRequest.wantsBlock && "error" in blockRequest) {
    return { status: "error", error: blockRequest.error };
  }

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  const bookingResolution = await resolveBookingId(supabase, parsed.data.bookingReference);
  if (!bookingResolution.ok) return { status: "error", error: bookingResolution.error };

  let availabilityBlockId: string | null = null;
  if (blockRequest.wantsBlock) {
    const blockResult = await createAvailabilityBlock(parsed.data.vehicleId, blockRequest.startAt, blockRequest.endAt, user.id);
    if (!blockResult.ok) return { status: "error", error: blockResult.error };
    availabilityBlockId = blockResult.blockId;
  }

  const { data: inserted, error } = await supabase
    .from("vehicle_incident_records")
    .insert({
      ...mapToRow(parsed, bookingResolution.bookingId),
      availability_block_id: availabilityBlockId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createIncidentRecord failed", error?.message);
    return { status: "error", error: "Failed to save incident record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_record_created",
    entity: "vehicle_incident_records",
    entity_id: inserted.id,
    diff: auditDiff(parsed.data),
  });

  return { status: "success" };
}

export async function updateIncidentRecord(
  id: string,
  _prev: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  const bookingResolution = await resolveBookingId(supabase, parsed.data.bookingReference);
  if (!bookingResolution.ok) return { status: "error", error: bookingResolution.error };

  const { data: existing } = await supabase
    .from("vehicle_incident_records")
    .select("repair_status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("vehicle_incident_records")
    .update(mapToRow(parsed, bookingResolution.bookingId))
    .eq("id", id);

  if (error) {
    console.error("updateIncidentRecord failed", error.message);
    return { status: "error", error: "Failed to update incident record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_record_updated",
    entity: "vehicle_incident_records",
    entity_id: id,
    diff: auditDiff(parsed.data),
  });

  // Status changes are audited as their own distinct, easy-to-find entry —
  // separate from the general "something was edited" log line.
  if (existing && existing.repair_status !== parsed.data.repairStatus) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "incident_status_changed",
      entity: "vehicle_incident_records",
      entity_id: id,
      diff: { from: existing.repair_status, to: parsed.data.repairStatus },
    });
  }

  return { status: "success" };
}

export async function deleteIncidentRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const supabase = createAdminClient();

  // The incident owns the reference to its downtime, and the FK is
  // on-delete-set-null in the other direction, so deleting the record on its
  // own would leave the vehicle_blocks row behind with nothing pointing at
  // it — a car silently held out of service that no screen can explain.
  // Release the downtime FIRST, through the shared primitive, and only then
  // delete. Fail-closed: if the block cannot be released the incident stays,
  // so the block always remains explainable by the record that created it.
  const { data: existing } = await supabase
    .from("vehicle_incident_records")
    .select("availability_block_id")
    .eq("id", id)
    .maybeSingle();

  let blockOutcome: BlockReleaseOutcome | null = null;
  if (existing?.availability_block_id) {
    const release = await releaseVehicleBlock(supabase, existing.availability_block_id);
    if (!release.ok) {
      return {
        ok: false,
        error: `${release.error} The incident was not deleted, so the vehicle's downtime stays linked to it.`,
      };
    }
    blockOutcome = release.outcome;
  }

  const { error } = await supabase.from("vehicle_incident_records").delete().eq("id", id);
  if (error) {
    console.error("deleteIncidentRecord failed", error.message);
    return { ok: false, error: "Failed to delete incident record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_record_deleted",
    entity: "vehicle_incident_records",
    entity_id: id,
    diff: blockOutcome ? { availability_block: blockOutcome } : null,
  });

  return { ok: true };
}

// Closes an incident-created availability block early (vehicle returned to
// service) via the shared vehicle_blocks primitive — never a second
// availability mechanism.
export async function closeIncidentAvailabilityBlock(incidentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const supabase = createAdminClient();
  const { data: incident } = await supabase
    .from("vehicle_incident_records")
    .select("availability_block_id")
    .eq("id", incidentId)
    .maybeSingle();

  if (!incident?.availability_block_id) return { ok: false, error: "No active block on this incident." };

  const result = await closeBlockEarly(incident.availability_block_id);
  if (!result.ok) return result;

  await supabase.from("vehicle_incident_records").update({ availability_block_id: null }).eq("id", incidentId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_availability_block_closed",
    entity: "vehicle_incident_records",
    entity_id: incidentId,
  });

  return { ok: true };
}

const MAX_INCIDENT_DOCUMENT_SIZE = 15 * 1024 * 1024;
const ALLOWED_INCIDENT_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const INCIDENT_DOCUMENT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadIncidentAttachment(incidentId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const categoryRaw = formData.get("category");
  if (typeof categoryRaw !== "string" || !(ATTACHMENT_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return { ok: false as const, error: "Please select a document category." };
  }
  const category = categoryRaw as AttachmentCategory;

  const value = formData.get("document");
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: "Please choose a file." };
  }
  if (value.size > MAX_INCIDENT_DOCUMENT_SIZE) {
    return { ok: false as const, error: "File must be under 15 MB." };
  }
  if (!ALLOWED_INCIDENT_DOCUMENT_TYPES.has(value.type)) {
    return { ok: false as const, error: "File must be a PDF, JPEG, PNG, or WebP." };
  }

  const supabase = createAdminClient();

  const { data: incident } = await supabase.from("vehicle_incident_records").select("id").eq("id", incidentId).maybeSingle();
  if (!incident) return { ok: false as const, error: "Incident record not found." };

  const extension = INCIDENT_DOCUMENT_EXTENSION_BY_MIME_TYPE[value.type];
  const path = `${incidentId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await value.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("incident-documents")
    .upload(path, buffer, { contentType: value.type, upsert: false });

  if (uploadError) {
    console.error("uploadIncidentAttachment failed", uploadError.message);
    return { ok: false as const, error: "Failed to upload file." };
  }

  const { error: insertError } = await supabase.from("vehicle_incident_attachments").insert({
    incident_id: incidentId,
    category,
    storage_path: path,
    file_name: value.name,
    mime_type: value.type,
    size_bytes: value.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error("uploadIncidentAttachment insert failed", insertError.message);
    return { ok: false as const, error: "Failed to save attachment record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_attachment_uploaded",
    entity: "vehicle_incident_attachments",
    entity_id: incidentId,
    diff: { category, mime_type: value.type, size_bytes: value.size },
  });

  return { ok: true as const };
}

export async function getIncidentAttachmentSignedUrl(storagePath: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("incident-documents").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

// Deletes the storage object BEFORE the DB row, and aborts (leaving the row
// in place) if the storage removal fails — the opposite order would risk an
// orphaned file with no tracking row pointing at it, which is exactly what
// "verify no orphan files remain" rules out.
export async function deleteIncidentAttachment(attachmentId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_incidents");

  const supabase = createAdminClient();

  const { data: attachment } = await supabase
    .from("vehicle_incident_attachments")
    .select("storage_path, incident_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) return { ok: false as const, error: "Attachment not found." };

  const { error: storageError } = await supabase.storage.from("incident-documents").remove([attachment.storage_path]);
  if (storageError) {
    console.error("deleteIncidentAttachment storage removal failed", storageError.message);
    return { ok: false as const, error: "Failed to delete the stored file — the attachment was not removed." };
  }

  const { error } = await supabase.from("vehicle_incident_attachments").delete().eq("id", attachmentId);
  if (error) {
    console.error("deleteIncidentAttachment failed", error.message);
    return { ok: false as const, error: "Failed to delete attachment." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "incident_attachment_deleted",
    entity: "vehicle_incident_attachments",
    entity_id: attachment.incident_id,
  });

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Dashboard — request-scoped shared fetch (React.cache()) of every currently
// OPEN incident, reused by both the KPI counts and the compact open-incident
// list, so a dashboard render issues one query for this instead of three.
// Bounded by "currently open" (not all-time history), same reasoning as the
// compliance module's "current" view.
// ---------------------------------------------------------------------------

type OpenIncidentRow = {
  id: string;
  vehicle_id: string;
  incident_date: string;
  incident_type: string;
  custom_type: string | null;
  severity: Severity;
  repair_status: string;
  estimated_repair_cost_cents: number | null;
  actual_repair_cost_cents: number | null;
  vehicles: { name: string } | null;
};

const getOpenIncidentRows = cache(async (): Promise<OpenIncidentRow[]> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicle_incident_records")
    .select(
      "id, vehicle_id, incident_date, incident_type, custom_type, severity, repair_status, estimated_repair_cost_cents, actual_repair_cost_cents, vehicles(name)"
    )
    .in("repair_status", OPEN_REPAIR_STATUSES)
    .order("incident_date", { ascending: false });

  return (data ?? []) as unknown as OpenIncidentRow[];
});

export type IncidentDashboardStats = {
  openCases: number;
  vehiclesUnderRepair: number;
  majorIncidents: number;
  repairCostThisMonthCents: number;
};

export async function getIncidentDashboardStats(): Promise<IncidentDashboardStats> {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const supabase = createAdminClient();
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(y, m, 1));
  const monthEnd = nextMonth.toISOString().slice(0, 10);

  const [openRows, repairedThisMonth] = await Promise.all([
    getOpenIncidentRows(),
    supabase
      .from("vehicle_incident_records")
      .select("actual_repair_cost_cents, estimated_repair_cost_cents")
      .gte("date_repaired", monthStart)
      .lt("date_repaired", monthEnd),
  ]);

  const vehiclesUnderRepair = new Set(openRows.filter((r) => r.repair_status === "under_repair").map((r) => r.vehicle_id)).size;
  const majorIncidents = openRows.filter((r) => r.severity === "major" || r.severity === "write_off").length;
  const repairCostThisMonthCents = (repairedThisMonth.data ?? []).reduce(
    (sum, r) => sum + (r.actual_repair_cost_cents ?? r.estimated_repair_cost_cents ?? 0),
    0
  );

  return {
    openCases: openRows.length,
    vehiclesUnderRepair,
    majorIncidents,
    repairCostThisMonthCents,
  };
}

export type OpenIncidentSummary = {
  id: string;
  vehicleName: string;
  incidentDate: string;
  incidentType: string;
  customType: string | null;
  severity: Severity;
  repairStatus: string;
  estimatedRepairCostCents: number | null;
  actualRepairCostCents: number | null;
};

const SEVERITY_SORT_ORDER: Record<Severity, number> = { write_off: 0, major: 1, moderate: 2, minor: 3 };

export async function getOpenIncidentsList(limit = 10): Promise<OpenIncidentSummary[]> {
  const user = await requireAdminUser();
  assertPermission(user, "view_incidents");

  const rows = await getOpenIncidentRows();

  return rows
    .map((r) => ({
      id: r.id,
      vehicleName: r.vehicles?.name ?? "—",
      incidentDate: r.incident_date,
      incidentType: r.incident_type,
      customType: r.custom_type,
      severity: r.severity,
      repairStatus: r.repair_status,
      estimatedRepairCostCents: r.estimated_repair_cost_cents,
      actualRepairCostCents: r.actual_repair_cost_cents,
    }))
    .sort((a, b) => SEVERITY_SORT_ORDER[a.severity] - SEVERITY_SORT_ORDER[b.severity])
    .slice(0, limit);
}

// NOTE: nothing may be re-exported from this module that is not an async
// function. Every export of a "use server" file becomes a server action, and
// a synchronous re-export (this file previously re-exported the pure helper
// isOpenRepairStatus) invalidates the action manifest for the WHOLE file —
// every form pointing at createIncidentRecord then failed with
// "Failed to find Server Action ..." and a 404 on POST. Import pure helpers
// straight from @/lib/incidents/schema instead.
