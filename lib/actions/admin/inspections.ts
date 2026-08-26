"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser, getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { releaseVehicleBlock } from "@/lib/fleet/vehicle-blocks";
import { checkOdometerAgainstHistory, type OdometerReading } from "@/lib/fleet/odometer";
import {
  CHECKLIST_VERSION,
  INSPECTION_CHECKLIST,
  buildInspectionItemRows,
  deriveInspectionResult,
  getChecklistItem,
  safetyCriticalFailures,
  type InspectionResult,
} from "@/lib/fleet/inspection-checklist";
import {
  approveInspectionSchema,
  createInspectionSchema,
  inspectionDowntimeSchema,
  inspectionFollowUpSchema,
  inspectionItemUpdateSchema,
  normalizeInspectionListFilters,
  sanitizeSearchTerm,
  updateInspectionSchema,
  weekEndingFor,
  type InspectionFormState,
} from "@/lib/inspections/schema";
import { inspectionFollowUpKey } from "@/lib/inspections/follow-up";
import { insertVehicleBlock } from "./availability";
import { createMaintenanceRecord } from "./maintenance";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const PAGE_SIZE = 20;

const LIST_COLUMNS =
  "id, vehicle_id, week_ending, inspection_date, odometer_km, result, driver_name, inspector_name, " +
  "vehicle_registration, vehicle_make_model, approved_at, approved_by, availability_block_id, created_at, " +
  "vehicles(name, brand, model, transmission, internal_registration_ref)";

export type InspectionListRow = {
  id: string;
  vehicle_id: string;
  week_ending: string;
  inspection_date: string;
  odometer_km: number;
  result: "draft" | "completed" | "attention_required" | "failed";
  driver_name: string | null;
  inspector_name: string | null;
  vehicle_registration: string | null;
  vehicle_make_model: string | null;
  approved_at: string | null;
  approved_by: string | null;
  availability_block_id: string | null;
  created_at: string;
  vehicles: {
    name: string;
    brand: string;
    model: string;
    transmission: "manual" | "automatic";
    internal_registration_ref: string | null;
  } | null;
  /** Populated by listInspectionsAdmin from one grouped query, not per row. */
  attentionCount?: number;
  failCount?: number;
};

export type InspectionItemRow = {
  id: string;
  inspection_id: string;
  section: string;
  item_key: string;
  display_order: number;
  result: InspectionResult | null;
  remarks: string | null;
};

export type InspectionCounts = {
  pass: number;
  attention: number;
  fail: number;
  na: number;
  unanswered: number;
  total: number;
};

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

/**
 * Every odometer reading recorded for this vehicle, from every module, in the
 * shape the shared cross-module helper expects.
 *
 * Three bounded queries rather than one per row. `vehicles.current_mileage_km`
 * is deliberately absent: it carries no date, so treating it as a floor would
 * reject any legitimate backfill of an older inspection.
 */
async function collectOdometerHistory(
  supabase: ReturnType<typeof createAdminClient>,
  vehicleId: string,
  excludeInspectionId?: string
): Promise<OdometerReading[]> {
  const [{ data: fuel }, { data: maintenance }, { data: inspections }] = await Promise.all([
    supabase.from("vehicle_fuel_records").select("odometer_km, filled_at").eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_maintenance_records")
      .select("mileage_km, maintenance_date")
      .eq("vehicle_id", vehicleId)
      .not("mileage_km", "is", null),
    supabase.from("vehicle_inspections").select("id, odometer_km, inspection_date").eq("vehicle_id", vehicleId),
  ]);

  const readings: OdometerReading[] = [];
  for (const row of fuel ?? []) {
    readings.push({ odometerKm: row.odometer_km, recordedOn: row.filled_at, source: "fuel" });
  }
  for (const row of maintenance ?? []) {
    if (row.mileage_km !== null) {
      readings.push({ odometerKm: row.mileage_km, recordedOn: row.maintenance_date, source: "maintenance" });
    }
  }
  for (const row of inspections ?? []) {
    if (excludeInspectionId && row.id === excludeInspectionId) continue;
    readings.push({ odometerKm: row.odometer_km, recordedOn: row.inspection_date, source: "inspection" });
  }
  return readings;
}

/**
 * Recompute the header result from the items and store it.
 *
 * This is the ONLY thing that writes `result`. No action accepts a result from
 * the client, so an inspection can never claim to be clean while items failed.
 */
async function recomputeResult(
  supabase: ReturnType<typeof createAdminClient>,
  inspectionId: string
): Promise<{ result: "draft" | "completed" | "attention_required" | "failed"; safetyFailures: string[] }> {
  const { data: items } = await supabase
    .from("vehicle_inspection_items")
    .select("item_key, result")
    .eq("inspection_id", inspectionId);

  const rows = (items ?? []) as { item_key: string; result: InspectionResult | null }[];
  const result = deriveInspectionResult(rows);
  const safetyFailures = safetyCriticalFailures(rows);

  await supabase.from("vehicle_inspections").update({ result }).eq("id", inspectionId);
  return { result, safetyFailures };
}

async function loadInspection(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await supabase
    .from("vehicle_inspections")
    .select("id, vehicle_id, inspection_date, odometer_km, result, approved_at, availability_block_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * The one authoritative creation path.
 *
 * The checklist is generated from the canonical catalogue — the client sends
 * no item keys at all, so it cannot introduce an unsupported one — and every
 * item starts unanswered. Identity is snapshotted here because the printed
 * sheet must stay true even if the vehicle is renamed later.
 */
export async function createInspection(
  _prev: InspectionFormState,
  formData: FormData
): Promise<InspectionFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const parsed = createInspectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }
  const d = parsed.data;

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, name, brand, model, internal_registration_ref, deleted_at")
    .eq("id", d.vehicleId)
    .maybeSingle();
  if (!vehicle || vehicle.deleted_at) {
    return { status: "error", error: "Selected vehicle does not exist." };
  }

  const weekEnding = d.weekEnding ?? weekEndingFor(d.inspectionDate);

  const history = await collectOdometerHistory(supabase, d.vehicleId);
  const odometer = checkOdometerAgainstHistory({
    odometerKm: d.odometerKm,
    recordedOn: d.inspectionDate,
    existing: history,
  });
  if (!odometer.ok) return { status: "error", error: odometer.error };

  const { data: inserted, error } = await supabase
    .from("vehicle_inspections")
    .insert({
      vehicle_id: d.vehicleId,
      checklist_version: CHECKLIST_VERSION,
      week_ending: weekEnding,
      inspection_date: d.inspectionDate,
      odometer_km: d.odometerKm,
      company_name: d.companyName,
      // Identity snapshot for historical evidence; vehicle_id stays canonical.
      vehicle_registration: vehicle.internal_registration_ref,
      vehicle_make_model: [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.name,
      driver_name: d.driverName,
      inspector_name: d.inspectorName ?? user.fullName ?? null,
      inspected_by: user.id,
      defects_notes: d.defectsNotes,
      result: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createInspection failed", error?.message);
    return { status: "error", error: "Failed to create the inspection." };
  }

  // All forty rows in ONE insert, not forty round trips.
  const { error: itemsError } = await supabase
    .from("vehicle_inspection_items")
    .insert(buildInspectionItemRows(inserted.id));

  if (itemsError) {
    // Don't leave a header with a partial or missing checklist behind it.
    await supabase.from("vehicle_inspections").delete().eq("id", inserted.id);
    console.error("createInspection items failed", itemsError.message);
    return { status: "error", error: "Failed to create the inspection checklist." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_created",
    entity: "vehicle_inspections",
    entity_id: inserted.id,
    diff: {
      vehicle_id: d.vehicleId,
      week_ending: weekEnding,
      checklist_version: CHECKLIST_VERSION,
      items: INSPECTION_CHECKLIST.length,
    },
  });

  return { status: "success", inspectionId: inserted.id };
}

// ---------------------------------------------------------------------------
// Header update
// ---------------------------------------------------------------------------

/**
 * Edits the header only. Deliberately cannot write `result`, `approved_by`,
 * `approved_at` or `approval_remarks`: approval is a separate authority and
 * the result is always derived.
 */
export async function updateInspectionHeader(
  id: string,
  _prev: InspectionFormState,
  formData: FormData
): Promise<InspectionFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const parsed = updateInspectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }
  const d = parsed.data;

  const supabase = createAdminClient();
  const existing = await loadInspection(supabase, id);
  if (!existing) return { status: "error", error: "Inspection not found." };

  const history = await collectOdometerHistory(supabase, existing.vehicle_id, id);
  const odometer = checkOdometerAgainstHistory({
    odometerKm: d.odometerKm,
    recordedOn: d.inspectionDate,
    existing: history,
  });
  if (!odometer.ok) return { status: "error", error: odometer.error };

  const { error } = await supabase
    .from("vehicle_inspections")
    .update({
      inspection_date: d.inspectionDate,
      week_ending: weekEndingFor(d.inspectionDate),
      odometer_km: d.odometerKm,
      company_name: d.companyName,
      driver_name: d.driverName,
      inspector_name: d.inspectorName,
      defects_notes: d.defectsNotes,
      driver_acknowledged_on: d.driverAcknowledgedOn,
      inspector_acknowledged_on: d.inspectorAcknowledgedOn,
    })
    .eq("id", id);

  if (error) {
    console.error("updateInspectionHeader failed", error.message);
    return { status: "error", error: "Failed to save the inspection." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_updated",
    entity: "vehicle_inspections",
    entity_id: id,
  });

  return { status: "success", inspectionId: id };
}

// ---------------------------------------------------------------------------
// Checklist answers
// ---------------------------------------------------------------------------

export async function setInspectionItemResult(
  inspectionId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; result?: string; safetyFailures?: string[] }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const parsed = inspectionItemUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checklist answer." };
  }
  const d = parsed.data;

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false, error: "Inspection not found." };

  // An approved sheet is evidence. Changing an answer under a signature would
  // make the approval describe something that no longer exists.
  if (inspection.approved_at) {
    return { ok: false, error: "This inspection has been approved and can no longer be edited." };
  }

  const { error } = await supabase
    .from("vehicle_inspection_items")
    .update({ result: d.result, remarks: d.remarks })
    .eq("inspection_id", inspectionId)
    .eq("item_key", d.itemKey);

  if (error) {
    console.error("setInspectionItemResult failed", error.message);
    return { ok: false, error: "Failed to save the checklist answer." };
  }

  const { result, safetyFailures } = await recomputeResult(supabase, inspectionId);
  return { ok: true, result, safetyFailures };
}

/**
 * Bulk pass.
 *
 * Deliberately only fills items that are still UNANSWERED. Overwriting an
 * existing attention/fail/n-a would silently erase a defect somebody had
 * already recorded, which is the one thing a bulk control must never do — so
 * the safe interpretation is "finish the sheet", not "mark everything pass".
 */
export async function bulkPassUnansweredItems(
  inspectionId: string
): Promise<{ ok: boolean; error?: string; updated?: number; result?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false, error: "Inspection not found." };
  if (inspection.approved_at) {
    return { ok: false, error: "This inspection has been approved and can no longer be edited." };
  }

  const { data: updatedRows, error } = await supabase
    .from("vehicle_inspection_items")
    .update({ result: "pass" })
    .eq("inspection_id", inspectionId)
    .is("result", null)
    .select("id");

  if (error) {
    console.error("bulkPassUnansweredItems failed", error.message);
    return { ok: false, error: "Failed to mark the remaining items as pass." };
  }

  const updated = updatedRows?.length ?? 0;
  const { result } = await recomputeResult(supabase, inspectionId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_bulk_passed",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    // Recorded so a rubber-stamped sheet is traceable afterwards.
    diff: { items_marked_pass: updated, result },
  });

  return { ok: true, updated, result };
}

/**
 * Completion is not a stored state of its own — it is the moment every item
 * has an answer, at which point the derived result stops being `draft`. If
 * anything is unanswered this refuses rather than letting an incomplete sheet
 * present itself as finished.
 */
export async function completeInspection(
  inspectionId: string
): Promise<{ ok: boolean; error?: string; result?: string; safetyFailures?: string[] }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false, error: "Inspection not found." };

  const { data: items } = await supabase
    .from("vehicle_inspection_items")
    .select("item_key, result")
    .eq("inspection_id", inspectionId);

  const rows = (items ?? []) as { item_key: string; result: InspectionResult | null }[];
  const unanswered = rows.filter((r) => r.result === null).length;
  if (unanswered > 0 || rows.length < INSPECTION_CHECKLIST.length) {
    return {
      ok: false,
      error: `${unanswered || INSPECTION_CHECKLIST.length - rows.length} checklist item(s) still have no answer. Complete the sheet before finishing it.`,
    };
  }

  const { result, safetyFailures } = await recomputeResult(supabase, inspectionId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_completed",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    diff: { result, safety_critical_failures: safetyFailures },
  });

  return { ok: true, result, safetyFailures };
}

// ---------------------------------------------------------------------------
// Approval — separate authority
// ---------------------------------------------------------------------------

/**
 * Fleet-manager sign-off. The ONLY path that writes the approval columns.
 *
 * Gated on approve_inspections, not manage_inspections, so an inspector
 * cannot sign off their own sheet merely because they can edit it. The
 * approver is taken from the authenticated session and is never accepted from
 * the client, and the result is left exactly as derived — an approved failure
 * still reads `failed`.
 */
export async function approveInspection(
  inspectionId: string,
  _prev: InspectionFormState,
  formData: FormData
): Promise<InspectionFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_inspections");

  const parsed = approveInspectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: "Please check the approval remarks." };
  }

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { status: "error", error: "Inspection not found." };
  if (inspection.approved_at) return { status: "error", error: "This inspection is already approved." };
  if (inspection.result === "draft") {
    return { status: "error", error: "Finish the checklist before approving this inspection." };
  }

  const { error } = await supabase
    .from("vehicle_inspections")
    .update({
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_remarks: parsed.data.approvalRemarks,
    })
    .eq("id", inspectionId);

  if (error) {
    console.error("approveInspection failed", error.message);
    return { status: "error", error: "Failed to approve the inspection." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_approved",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    // The result is recorded as-is: approving a failure does not clear it.
    diff: { result_at_approval: inspection.result },
  });

  return { status: "success", inspectionId };
}

// ---------------------------------------------------------------------------
// Maintenance follow-up
// ---------------------------------------------------------------------------

/**
 * Raise a maintenance job from selected inspection defects.
 *
 * Goes through the canonical createMaintenanceRecord action rather than
 * inserting a maintenance row here, so an inspection follow-up is an ordinary
 * maintenance record with ordinary validation, costs and audit — plus a
 * source_inspection_id linking it back.
 *
 * One inspection may raise several jobs (a tyre job and an electrical job are
 * legitimately separate), so the guard against a double-click is an identical
 * pending job, not a rule that an inspection may only have one.
 */
export async function createMaintenanceFromInspection(
  inspectionId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");
  assertPermission(user, "manage_maintenance");

  const itemKeys = formData.getAll("itemKeys").map(String).filter(Boolean);
  const parsed = inspectionFollowUpSchema.safeParse({
    itemKeys,
    maintenanceType: formData.get("maintenanceType")?.toString(),
    serviceProvider: formData.get("serviceProvider")?.toString(),
    notes: formData.get("notes")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Select the defects to raise maintenance for." };
  }

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false, error: "Inspection not found." };

  // Deduplicate before the ownership check: a request may legitimately repeat
  // an id (a double-toggled checkbox), and comparing a raw count against the
  // returned rows would reject that as if it referenced another inspection.
  const requestedKeys = [...new Set(parsed.data.itemKeys)];

  // The selected items must belong to THIS inspection and must actually be
  // defects — you cannot raise a repair job against a passing check.
  const { data: items } = await supabase
    .from("vehicle_inspection_items")
    .select("item_key, result, remarks")
    .eq("inspection_id", inspectionId)
    .in("item_key", requestedKeys);

  const found = (items ?? []) as { item_key: string; result: InspectionResult | null; remarks: string | null }[];
  if (found.length !== requestedKeys.length) {
    return { ok: false, error: "One or more selected items do not belong to this inspection." };
  }
  const notDefects = found.filter((i) => i.result !== "fail" && i.result !== "attention");
  if (notDefects.length > 0) {
    return {
      ok: false,
      error: "Only items marked Fail or Attention can raise a maintenance job.",
    };
  }

  // Identity of this follow-up: the selected checklist keys, canonicalised.
  // Deliberately NOT the description below — that embeds display labels and
  // editable remarks, so the same selection would stop matching itself the
  // moment somebody reworded a remark.
  const followUpKey = inspectionFollowUpKey(found.map((i) => i.item_key));
  if (!followUpKey) return { ok: false, error: "Select at least one defect to raise maintenance for." };

  const description = found
    .slice()
    .sort((a, b) => a.item_key.localeCompare(b.item_key))
    .map((i) => {
      const label = getChecklistItem(i.item_key)?.label ?? i.item_key;
      const suffix = i.remarks ? ` — ${i.remarks}` : "";
      return `[${(i.result ?? "").toUpperCase()}] ${label}${suffix}`;
    })
    .join("\n");

  // Friendly pre-check. This is a courtesy, not the guarantee: two genuinely
  // concurrent requests can both pass it, which is why 0035 adds a partial
  // unique index and createMaintenanceRecord translates its 23505.
  const { data: existing } = await supabase
    .from("vehicle_maintenance_records")
    .select("id, source_inspection_followup_key")
    .eq("source_inspection_id", inspectionId);

  if ((existing ?? []).some((r) => r.source_inspection_followup_key === followUpKey)) {
    // A second click on the same selection is a no-op, not a second job.
    return { ok: true, duplicate: true };
  }

  // Through the canonical maintenance path — no duplicated maintenance logic.
  const maintenanceForm = new FormData();
  maintenanceForm.set("vehicleId", inspection.vehicle_id);
  maintenanceForm.set("maintenanceDate", inspection.inspection_date);
  maintenanceForm.set("maintenanceType", parsed.data.maintenanceType || "repair");
  maintenanceForm.set("mileageKm", String(inspection.odometer_km));
  maintenanceForm.set("repairsPerformed", description);
  maintenanceForm.set("sourceInspectionId", inspectionId);
  maintenanceForm.set("sourceInspectionFollowupKey", followUpKey);
  if (parsed.data.serviceProvider) maintenanceForm.set("serviceProvider", parsed.data.serviceProvider);
  maintenanceForm.set(
    "remarks",
    parsed.data.notes || `Raised from weekly inspection ${inspectionId} (${inspection.inspection_date}).`
  );
  // Costs are left at zero: the job has not been quoted yet and inventing a
  // figure would put a fictional rupee amount into the fleet expense ledger.
  maintenanceForm.set("costMur", "");
  maintenanceForm.set("partsCostMur", "");
  maintenanceForm.set("labourCostMur", "");
  maintenanceForm.set("otherCostMur", "");

  const created = await createMaintenanceRecord({ status: "idle" }, maintenanceForm);
  if (created.status !== "success") {
    // The database rejected a concurrent duplicate. Report it as the no-op it
    // is rather than as a failure the operator should retry.
    if (created.error?.includes("already exists")) return { ok: true, duplicate: true };
    return { ok: false, error: created.error ?? "Failed to raise the maintenance job." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_maintenance_raised",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    diff: { item_keys: requestedKeys.slice().sort(), follow_up_key: followUpKey },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Downtime
// ---------------------------------------------------------------------------

/**
 * Take the vehicle off the road because of this inspection.
 *
 * Explicit only. A safety-critical failure raises a prominent warning in the
 * UI and offers this action; it never fires it. Uses the shared
 * insertVehicleBlock primitive with type 'inspection' — one availability
 * engine, one more caller.
 */
export async function createInspectionDowntime(
  inspectionId: string,
  _prev: InspectionFormState,
  formData: FormData
): Promise<InspectionFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const parsed = inspectionDowntimeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Check the downtime dates." };
  }

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { status: "error", error: "Inspection not found." };
  if (inspection.availability_block_id) {
    return { status: "error", error: "This inspection already has the vehicle off the road." };
  }

  const block = await insertVehicleBlock({
    vehicleId: inspection.vehicle_id,
    type: "inspection",
    note: parsed.data.note ?? `Weekly inspection ${inspection.inspection_date} — defects found.`,
    startAt: new Date(parsed.data.startAt).toISOString(),
    endAt: new Date(parsed.data.endAt).toISOString(),
    actorId: user.id,
  });
  if (!block.ok) return { status: "error", error: block.error };

  const { error } = await supabase
    .from("vehicle_inspections")
    .update({ availability_block_id: block.blockId })
    .eq("id", inspectionId);

  if (error) {
    // Never strand a block on the vehicle that no record explains.
    await supabase.from("vehicle_blocks").delete().eq("id", block.blockId);
    console.error("createInspectionDowntime failed", error.message);
    return { status: "error", error: "Failed to record the downtime against this inspection." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_downtime_created",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    diff: { block_id: block.blockId, start_at: parsed.data.startAt, end_at: parsed.data.endAt },
  });

  return { status: "success", inspectionId };
}

/**
 * Return the vehicle to service. Uses the Phase D shared primitive, so an
 * unstarted block is removed and a block already under way is shortened —
 * the downtime genuinely served is never erased.
 */
export async function releaseInspectionDowntime(
  inspectionId: string
): Promise<{ ok: boolean; error?: string; outcome?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false, error: "Inspection not found." };
  if (!inspection.availability_block_id) {
    return { ok: false, error: "This inspection has no downtime to release." };
  }

  const released = await releaseVehicleBlock(supabase, inspection.availability_block_id);
  if (!released.ok) return { ok: false, error: released.error };

  await supabase.from("vehicle_inspections").update({ availability_block_id: null }).eq("id", inspectionId);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_downtime_released",
    entity: "vehicle_inspections",
    entity_id: inspectionId,
    diff: { availability_block: released.outcome },
  });

  return { ok: true, outcome: released.outcome };
}

// ---------------------------------------------------------------------------
// Deletion — conservative by design
// ---------------------------------------------------------------------------

/**
 * Only a DRAFT, UNAPPROVED inspection may be deleted.
 *
 * A completed, attention or failed sheet is a record that an inspection was
 * performed and what it found; an approved one carries a signature. Neither
 * is disposable, so this refuses rather than offering a privileged override
 * that would quietly become routine.
 *
 * Fail-closed on downtime, exactly as the incident and maintenance paths do:
 * the block is released through the shared primitive FIRST, and if that fails
 * nothing is deleted. Attachments are refused rather than silently destroyed
 * along with their stored files.
 */
export async function deleteInspection(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, id);
  if (!inspection) return { ok: false, error: "Inspection not found." };

  if (inspection.approved_at) {
    return { ok: false, error: "An approved inspection is a signed record and cannot be deleted." };
  }
  if (inspection.result !== "draft") {
    return {
      ok: false,
      error:
        "Only a draft inspection can be deleted. A completed inspection records that the check was carried out and what it found.",
    };
  }

  const { count: attachmentCount } = await supabase
    .from("vehicle_inspection_attachments")
    .select("id", { count: "exact", head: true })
    .eq("inspection_id", id);

  if ((attachmentCount ?? 0) > 0) {
    return {
      ok: false,
      error: "Remove the attached evidence first — deleting the inspection would leave its files stored with nothing pointing at them.",
    };
  }

  // Release downtime before deleting, so a block can never be left holding a
  // vehicle off the road with no record explaining it.
  let blockOutcome: string | null = null;
  if (inspection.availability_block_id) {
    const released = await releaseVehicleBlock(supabase, inspection.availability_block_id);
    if (!released.ok) {
      return {
        ok: false,
        error: `${released.error} The inspection was not deleted, so the vehicle's downtime stays linked to it.`,
      };
    }
    blockOutcome = released.outcome;
  }

  const { error } = await supabase.from("vehicle_inspections").delete().eq("id", id);
  if (error) {
    console.error("deleteInspection failed", error.message);
    return { ok: false, error: "Failed to delete the inspection." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_deleted",
    entity: "vehicle_inspections",
    entity_id: id,
    diff: blockOutcome ? { availability_block: blockOutcome } : null,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

const MAX_INSPECTION_DOCUMENT_SIZE = 15 * 1024 * 1024;
const ALLOWED_INSPECTION_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const INSPECTION_DOCUMENT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadInspectionAttachment(inspectionId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const value = formData.get("document");
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: "Please choose a file." };
  }
  if (!ALLOWED_INSPECTION_DOCUMENT_TYPES.has(value.type)) {
    return { ok: false as const, error: "Only PDF, JPEG, PNG and WebP files can be attached." };
  }
  if (value.size > MAX_INSPECTION_DOCUMENT_SIZE) {
    return { ok: false as const, error: "That file is larger than 15 MB." };
  }

  const supabase = createAdminClient();
  const inspection = await loadInspection(supabase, inspectionId);
  if (!inspection) return { ok: false as const, error: "Inspection not found." };

  // An item-scoped photo must belong to the same inspection, or evidence
  // could be attached to another vehicle's sheet.
  const rawItemId = formData.get("inspectionItemId");
  let inspectionItemId: string | null = null;
  if (typeof rawItemId === "string" && rawItemId.trim().length > 0) {
    const { data: item } = await supabase
      .from("vehicle_inspection_items")
      .select("id")
      .eq("id", rawItemId.trim())
      .eq("inspection_id", inspectionId)
      .maybeSingle();
    if (!item) return { ok: false as const, error: "That checklist item does not belong to this inspection." };
    inspectionItemId = item.id;
  }

  const extension = INSPECTION_DOCUMENT_EXTENSION_BY_MIME_TYPE[value.type] ?? "bin";
  const storagePath = `${inspectionId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("inspection-documents")
    .upload(storagePath, value, { contentType: value.type, upsert: false });

  if (uploadError) {
    console.error("uploadInspectionAttachment storage failed", uploadError.message);
    return { ok: false as const, error: "Failed to upload the file." };
  }

  const { error } = await supabase.from("vehicle_inspection_attachments").insert({
    inspection_id: inspectionId,
    inspection_item_id: inspectionItemId,
    storage_path: storagePath,
    file_name: value.name,
    mime_type: value.type,
    size_bytes: value.size,
    uploaded_by: user.id,
  });

  if (error) {
    // Roll the stored object back rather than leaving a file nothing records.
    await supabase.storage.from("inspection-documents").remove([storagePath]);
    console.error("uploadInspectionAttachment insert failed", error.message);
    return { ok: false as const, error: "Failed to record the attachment." };
  }

  return { ok: true as const };
}

export async function getInspectionAttachmentSignedUrl(storagePath: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_inspections");

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("inspection-documents").createSignedUrl(storagePath, 60);
  if (error || !data) return { ok: false as const, error: "Could not open that file." };
  return { ok: true as const, url: data.signedUrl };
}

/**
 * Storage first, then the row — the same fail-safe order the incident and
 * maintenance modules use. If the stored file cannot be removed the metadata
 * stays, so the attachment remains visible and retryable rather than becoming
 * an invisible orphan in the bucket.
 */
export async function deleteInspectionAttachment(attachmentId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_inspections");

  const supabase = createAdminClient();
  const { data: attachment } = await supabase
    .from("vehicle_inspection_attachments")
    .select("storage_path, inspection_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) return { ok: false as const, error: "Attachment not found." };

  const { error: storageError } = await supabase.storage
    .from("inspection-documents")
    .remove([attachment.storage_path]);
  if (storageError) {
    console.error("deleteInspectionAttachment storage removal failed", storageError.message);
    return { ok: false as const, error: "Failed to delete the stored file — the attachment was not removed." };
  }

  const { error } = await supabase.from("vehicle_inspection_attachments").delete().eq("id", attachmentId);
  if (error) {
    console.error("deleteInspectionAttachment failed", error.message);
    return { ok: false as const, error: "Failed to delete the attachment." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "inspection_attachment_deleted",
    entity: "vehicle_inspection_attachments",
    entity_id: attachment.inspection_id,
  });

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export async function listInspectionsAdmin(rawFilters: {
  vehicleId?: string;
  weekEnding?: string;
  result?: string;
  approval?: string;
  defectsOnly?: string;
  search?: string;
  page?: string;
}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_inspections");

  const filters = normalizeInspectionListFilters(rawFilters);
  const supabase = createAdminClient();

  const from = (filters.page - 1) * PAGE_SIZE;
  let query = supabase
    .from("vehicle_inspections")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("week_ending", { ascending: false })
    .order("inspection_date", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.weekEnding) query = query.eq("week_ending", filters.weekEnding);
  if (filters.result) query = query.eq("result", filters.result);
  if (filters.approval === "approved") query = query.not("approved_at", "is", null);
  if (filters.approval === "unapproved") query = query.is("approved_at", null);
  if (filters.defectsOnly) query = query.in("result", ["attention_required", "failed"]);
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term.length > 0) {
      query = query.or(
        `inspector_name.ilike.%${term}%,driver_name.ilike.%${term}%,defects_notes.ilike.%${term}%,vehicle_registration.ilike.%${term}%`
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("listInspectionsAdmin failed", error.message);
    return { records: [] as InspectionListRow[], total: 0, page: filters.page, pageSize: PAGE_SIZE, filters };
  }

  const rows = (data ?? []) as unknown as InspectionListRow[];

  // Defect counts for the whole page in ONE query, grouped in memory. Never a
  // count query per row, and never one per checklist item.
  let defectCounts = new Map<string, { attention: number; fail: number }>();
  if (rows.length > 0) {
    const { data: items } = await supabase
      .from("vehicle_inspection_items")
      .select("inspection_id, result")
      .in(
        "inspection_id",
        rows.map((r) => r.id)
      )
      .in("result", ["attention", "fail"]);

    defectCounts = (items ?? []).reduce((acc, item) => {
      const entry = acc.get(item.inspection_id) ?? { attention: 0, fail: 0 };
      if (item.result === "attention") entry.attention += 1;
      if (item.result === "fail") entry.fail += 1;
      acc.set(item.inspection_id, entry);
      return acc;
    }, new Map<string, { attention: number; fail: number }>());
  }

  return {
    records: rows.map((r) => ({
      ...r,
      attentionCount: defectCounts.get(r.id)?.attention ?? 0,
      failCount: defectCounts.get(r.id)?.fail ?? 0,
    })),
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    filters,
  };
}

/**
 * One inspection with everything the detail screen and the PDF need, in four
 * bounded queries — never one per checklist item.
 */
export async function getInspectionAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_inspections");

  const supabase = createAdminClient();
  const [{ data: record }, { data: items }, { data: attachments }, { data: followUps }] = await Promise.all([
    supabase
      .from("vehicle_inspections")
      .select(
        "*, vehicles(name, brand, model, transmission, internal_registration_ref), " +
          "approver:profiles!vehicle_inspections_approved_by_fkey(full_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vehicle_inspection_items")
      .select("id, inspection_id, section, item_key, display_order, result, remarks")
      .eq("inspection_id", id)
      .order("display_order", { ascending: true }),
    supabase
      .from("vehicle_inspection_attachments")
      .select("id, inspection_item_id, file_name, mime_type, size_bytes, storage_path, created_at")
      .eq("inspection_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_maintenance_records")
      .select("id, maintenance_date, maintenance_type, cost_cents, service_provider")
      .eq("source_inspection_id", id)
      .order("maintenance_date", { ascending: false }),
  ]);

  const itemRows = (items ?? []) as unknown as InspectionItemRow[];
  const counts: InspectionCounts = {
    pass: itemRows.filter((i) => i.result === "pass").length,
    attention: itemRows.filter((i) => i.result === "attention").length,
    fail: itemRows.filter((i) => i.result === "fail").length,
    na: itemRows.filter((i) => i.result === "na").length,
    unanswered: itemRows.filter((i) => i.result === null).length,
    total: itemRows.length,
  };

  return {
    record,
    items: itemRows,
    attachments: attachments ?? [],
    followUps: followUps ?? [],
    counts,
    safetyFailures: safetyCriticalFailures(itemRows),
  };
}

/**
 * Recent inspections for the vehicle detail page. Non-throwing, like the
 * equivalent maintenance reader: an admin without view_inspections should
 * still be able to open the vehicle page, just without this panel.
 */
export async function getRecentInspectionsForVehicle(vehicleId: string, limit = 5) {
  const user = await getCurrentAdminUser();
  if (!user || !user.permissions.has("view_inspections")) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicle_inspections")
    .select("id, week_ending, inspection_date, odometer_km, result, inspector_name, approved_at")
    .eq("vehicle_id", vehicleId)
    .order("week_ending", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Defect counts for the whole page in ONE query, then grouped in memory —
  // not one count query per inspection.
  const { data: items } = await supabase
    .from("vehicle_inspection_items")
    .select("inspection_id, result")
    .in(
      "inspection_id",
      rows.map((r) => r.id)
    );

  const byInspection = new Map<string, { attention: number; fail: number }>();
  for (const item of items ?? []) {
    const entry = byInspection.get(item.inspection_id) ?? { attention: 0, fail: 0 };
    if (item.result === "attention") entry.attention += 1;
    if (item.result === "fail") entry.fail += 1;
    byInspection.set(item.inspection_id, entry);
  }

  return rows.map((r) => ({
    ...r,
    attentionCount: byInspection.get(r.id)?.attention ?? 0,
    failCount: byInspection.get(r.id)?.fail ?? 0,
  }));
}

export async function listVehiclesForInspectionSelect() {
  const user = await requireAdminUser();
  assertPermission(user, "view_inspections");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, name, internal_registration_ref")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  return data ?? [];
}
