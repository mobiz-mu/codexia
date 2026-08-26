"use server";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser, getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import {
  complianceSchema,
  normalizeComplianceListFilters,
  sanitizeSearchTerm,
  statusFilterToExpiryRange,
  type DocumentType,
} from "@/lib/compliance/schema";
import {
  addDaysIso,
  computeComplianceStatus,
  isAlarmStatus,
  COMPLIANCE_STATUS_SORT_ORDER,
} from "@/lib/compliance/status";

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
  "id, vehicle_id, document_type, custom_type, reference_number, provider, issued_date, expiry_date, cost_cents, remarks, created_at, vehicles(name)";

export type ComplianceListRow = {
  id: string;
  vehicle_id: string;
  document_type: string;
  custom_type: string | null;
  reference_number: string | null;
  provider: string | null;
  issued_date: string | null;
  expiry_date: string;
  cost_cents: number | null;
  remarks: string | null;
  created_at: string;
  vehicles: { name: string } | null;
};

export async function listComplianceRecordsAdmin(rawFilters: {
  vehicleId?: string;
  documentType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: string;
}) {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const filters = normalizeComplianceListFilters(rawFilters);
  const supabase = createAdminClient();

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("vehicle_compliance_records")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("expiry_date", { ascending: true })
    .range(from, to);

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.documentType) query = query.eq("document_type", filters.documentType);
  if (filters.dateFrom) query = query.gte("expiry_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("expiry_date", filters.dateTo);
  if (filters.status) {
    // Status is never stored — translated into an indexed expiry_date range
    // predicate so filtering by status stays a bounded range scan.
    const range = statusFilterToExpiryRange(filters.status, todayIso());
    if (range.gte) query = query.gte("expiry_date", range.gte);
    if (range.lte) query = query.lte("expiry_date", range.lte);
    if (range.lt) query = query.lt("expiry_date", range.lt);
  }
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term.length > 0) {
      query = query.or(`remarks.ilike.%${term}%,provider.ilike.%${term}%,reference_number.ilike.%${term}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("listComplianceRecordsAdmin failed", error.message);
    return { records: [] as ComplianceListRow[], total: 0, page: filters.page, pageSize: PAGE_SIZE, filters };
  }

  return {
    records: (data ?? []) as unknown as ComplianceListRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    filters,
  };
}

export async function getComplianceRecordAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const supabase = createAdminClient();
  const [{ data: record }, { data: attachments }] = await Promise.all([
    supabase.from("vehicle_compliance_records").select("*, vehicles(name)").eq("id", id).maybeSingle(),
    supabase
      .from("vehicle_compliance_attachments")
      .select("id, file_name, mime_type, size_bytes, storage_path, created_at")
      .eq("compliance_record_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return { record, attachments: attachments ?? [] };
}

// Non-throwing — backs the vehicle-detail compact Compliance section, which
// is otherwise reachable by anyone with manage_vehicles even if they lack
// view_compliance specifically; the section just renders empty for them
// rather than breaking the whole vehicle page.
export async function getCurrentComplianceForVehicle(vehicleId: string) {
  const user = await getCurrentAdminUser();
  if (!user || !user.permissions.has("view_compliance")) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicle_compliance_current")
    .select("id, document_type, custom_type, expiry_date, provider, reference_number")
    .eq("vehicle_id", vehicleId);

  return data ?? [];
}

export async function listVehiclesForComplianceSelect() {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  return data ?? [];
}

export type ComplianceFormState = { status: "idle" | "success" | "error"; error?: string };

function mapToRow(parsed: { data: ReturnType<typeof complianceSchema.parse> }) {
  const d = parsed.data;
  return {
    vehicle_id: d.vehicleId,
    document_type: d.documentType,
    custom_type: d.customType,
    reference_number: d.referenceNumber,
    provider: d.provider,
    issued_date: d.issuedDate,
    expiry_date: d.expiryDate,
    cost_cents: d.costMur,
    remarks: d.remarks,
  };
}

// Called after a successful create/update. Uses the ACTUAL current status
// of the vehicle+document_type (recomputed from vehicle_compliance_current,
// never inferred from "a write happened") to decide what to archive:
//
//   - Any notification linked to a record that is no longer the current one
//     for this vehicle+type is always archived — its expiry information is
//     stale regardless of the new record's own status, and leaving it
//     visible would show an outdated document reference.
//   - The current record's OWN notification (if any) is archived only when
//     the current record's real status is genuinely "valid" (>30 days out).
//     Editing remarks/provider/reference/attachments, or moving the expiry
//     date anywhere still inside the 30-day window, leaves it untouched —
//     the alert must persist until the document is genuinely no longer at
//     risk, not merely because a write occurred.
//
// This never *creates* a notification — only the daily cron does that, so
// the "warn every day" cadence stays governed by one place.
async function resolveComplianceAlertsIfCurrent(
  supabase: ReturnType<typeof createAdminClient>,
  vehicleId: string,
  documentType: DocumentType,
  customType: string | null
) {
  let currentQuery = supabase
    .from("vehicle_compliance_current")
    .select("id, expiry_date")
    .eq("vehicle_id", vehicleId)
    .eq("document_type", documentType);
  let historyQuery = supabase
    .from("vehicle_compliance_records")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("document_type", documentType);
  if (documentType === "other" && customType) {
    currentQuery = currentQuery.eq("custom_type", customType);
    historyQuery = historyQuery.eq("custom_type", customType);
  }

  const [{ data: current }, { data: history }] = await Promise.all([currentQuery.maybeSingle(), historyQuery]);
  if (!history || history.length === 0) return;

  const currentId = current?.id ?? null;
  const currentIsValid = current ? !isAlarmStatus(computeComplianceStatus(current.expiry_date).status) : true;

  const linksToArchive = history
    .filter((r) => r.id !== currentId || currentIsValid)
    .map((r) => `/admin/compliance/${r.id}`);
  if (linksToArchive.length === 0) return;

  await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .in("link", linksToArchive)
    .is("archived_at", null);
}

export async function createComplianceRecord(
  _prev: ComplianceFormState,
  formData: FormData
): Promise<ComplianceFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_compliance");

  const parsed = complianceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  // Renewal detection is purely informational (for the audit-log diff) —
  // any prior record for this vehicle+type already exists in history
  // regardless, since this table never overwrites past rows.
  const { count: priorCount } = await supabase
    .from("vehicle_compliance_records")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", parsed.data.vehicleId)
    .eq("document_type", parsed.data.documentType);

  const { data: inserted, error } = await supabase
    .from("vehicle_compliance_records")
    .insert({ ...mapToRow({ data: parsed.data }), created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createComplianceRecord failed", error?.message);
    return { status: "error", error: "Failed to save compliance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "compliance_record_created",
    entity: "vehicle_compliance_records",
    entity_id: inserted.id,
    diff: {
      vehicle_id: parsed.data.vehicleId,
      document_type: parsed.data.documentType,
      expiry_date: parsed.data.expiryDate,
      is_renewal: (priorCount ?? 0) > 0,
    },
  });

  await resolveComplianceAlertsIfCurrent(supabase, parsed.data.vehicleId, parsed.data.documentType, parsed.data.customType);

  return { status: "success" };
}

export async function updateComplianceRecord(
  id: string,
  _prev: ComplianceFormState,
  formData: FormData
): Promise<ComplianceFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_compliance");

  const parsed = complianceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", parsed.data.vehicleId).maybeSingle();
  if (!vehicle) return { status: "error", error: "Selected vehicle does not exist." };

  const { error } = await supabase.from("vehicle_compliance_records").update(mapToRow({ data: parsed.data })).eq("id", id);

  if (error) {
    console.error("updateComplianceRecord failed", error.message);
    return { status: "error", error: "Failed to update compliance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "compliance_record_updated",
    entity: "vehicle_compliance_records",
    entity_id: id,
    diff: {
      vehicle_id: parsed.data.vehicleId,
      document_type: parsed.data.documentType,
      expiry_date: parsed.data.expiryDate,
    },
  });

  await resolveComplianceAlertsIfCurrent(supabase, parsed.data.vehicleId, parsed.data.documentType, parsed.data.customType);

  return { status: "success" };
}

export async function deleteComplianceRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_compliance");

  const supabase = createAdminClient();

  const { error } = await supabase.from("vehicle_compliance_records").delete().eq("id", id);
  if (error) {
    console.error("deleteComplianceRecord failed", error.message);
    return { ok: false, error: "Failed to delete compliance record." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "compliance_record_deleted",
    entity: "vehicle_compliance_records",
    entity_id: id,
  });

  await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("link", `/admin/compliance/${id}`)
    .is("archived_at", null);

  return { ok: true };
}

const MAX_COMPLIANCE_DOCUMENT_SIZE = 15 * 1024 * 1024;
const ALLOWED_COMPLIANCE_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const COMPLIANCE_DOCUMENT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadComplianceAttachment(recordId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_compliance");

  const value = formData.get("document");
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: "Please choose a file." };
  }
  if (value.size > MAX_COMPLIANCE_DOCUMENT_SIZE) {
    return { ok: false as const, error: "File must be under 15 MB." };
  }
  if (!ALLOWED_COMPLIANCE_DOCUMENT_TYPES.has(value.type)) {
    return { ok: false as const, error: "File must be a PDF, JPEG, PNG, or WebP." };
  }

  const supabase = createAdminClient();

  const { data: record } = await supabase
    .from("vehicle_compliance_records")
    .select("id")
    .eq("id", recordId)
    .maybeSingle();
  if (!record) return { ok: false as const, error: "Compliance record not found." };

  const extension = COMPLIANCE_DOCUMENT_EXTENSION_BY_MIME_TYPE[value.type];
  const path = `${recordId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await value.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("compliance-documents")
    .upload(path, buffer, { contentType: value.type, upsert: false });

  if (uploadError) {
    console.error("uploadComplianceAttachment failed", uploadError.message);
    return { ok: false as const, error: "Failed to upload file." };
  }

  const { error: insertError } = await supabase.from("vehicle_compliance_attachments").insert({
    compliance_record_id: recordId,
    storage_path: path,
    file_name: value.name,
    mime_type: value.type,
    size_bytes: value.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error("uploadComplianceAttachment insert failed", insertError.message);
    return { ok: false as const, error: "Failed to save attachment record." };
  }

  return { ok: true as const };
}

export async function getComplianceAttachmentSignedUrl(storagePath: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("compliance-documents").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteComplianceAttachment(attachmentId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_compliance");

  const supabase = createAdminClient();

  const { data: attachment } = await supabase
    .from("vehicle_compliance_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) return { ok: false as const, error: "Attachment not found." };

  // Ownership/path validation: the storage path is only ever read from our
  // own attachment row (never accepted as raw client input), so there is no
  // way to pass a path outside this record's own compliance_record_id/*
  // prefix.
  // Storage first, then the row. This order can only ever leave a row
  // pointing at a missing file — visible and recoverable — never a file with
  // no row, which nothing would ever find again. Incidents and Inspections
  // already checked this error; these two did not, and would delete the row
  // regardless, orphaning the object in a private bucket.
  const { error: storageError } = await supabase.storage.from("compliance-documents").remove([attachment.storage_path]);
  if (storageError) {
    console.error("deleteComplianceAttachment storage removal failed", storageError.message);
    return { ok: false as const, error: "Failed to delete the stored file — the attachment was not removed." };
  }
  const { error } = await supabase.from("vehicle_compliance_attachments").delete().eq("id", attachmentId);

  if (error) {
    console.error("deleteComplianceAttachment failed", error.message);
    return { ok: false as const, error: "Failed to delete attachment." };
  }

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Dashboard / alarm surfaces — all read from vehicle_compliance_current (the
// "latest per vehicle+type" view), never the full history table, so these
// stay bounded by current fleet size rather than growing with years of past
// renewals.
// ---------------------------------------------------------------------------

type ComplianceAlarmRow = {
  id: string;
  vehicle_id: string;
  document_type: string;
  custom_type: string | null;
  expiry_date: string;
  vehicles: { name: string } | null;
};

// Request-scoped memoization (React.cache()) — NOT a data cache across
// requests. On the dashboard page, the KPI cards, the red alert list, and
// the sidebar badge (via AdminShell) would otherwise each issue their own
// near-duplicate query against the exact same "everything expiring within
// 30 days, including already-expired" row set. Wrapping the single shared
// fetch in cache() collapses that to one DB round trip per request; every
// new request (i.e. every page load) still hits the database fresh, so the
// alarm data is exactly as current as an uncached query would be — this
// never trades freshness for speed, only removes duplicate work within one
// render pass. Bounded by current fleet size (one row per vehicle+type
// currently in the window), never by history depth.
const getComplianceAlarmRows = cache(async (): Promise<ComplianceAlarmRow[]> => {
  const supabase = createAdminClient();
  const in30 = addDaysIso(todayIso(), 30);

  const { data } = await supabase
    .from("vehicle_compliance_current")
    .select("id, vehicle_id, document_type, custom_type, expiry_date, vehicles(name)")
    .lte("expiry_date", in30)
    .order("expiry_date", { ascending: true });

  return (data ?? []) as unknown as ComplianceAlarmRow[];
});

export type ComplianceDashboardStats = {
  expiringWithin30: number;
  expiringWithin7: number;
  expired: number;
  vehiclesWithProblem: number;
};

export async function getComplianceDashboardStats(): Promise<ComplianceDashboardStats> {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const rows = await getComplianceAlarmRows();
  const today = todayIso();

  let expiringWithin30 = 0;
  let expiringWithin7 = 0;
  let expired = 0;
  const vehiclesWithProblem = new Set<string>();

  for (const row of rows) {
    const { status, daysRemaining } = computeComplianceStatus(row.expiry_date, today);
    if (!isAlarmStatus(status)) continue;
    vehiclesWithProblem.add(row.vehicle_id);
    if (status === "expired") {
      expired++;
    } else {
      expiringWithin30++;
      if (daysRemaining <= 7) expiringWithin7++;
    }
  }

  return { expiringWithin30, expiringWithin7, expired, vehiclesWithProblem: vehiclesWithProblem.size };
}

export type ComplianceAlert = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  documentType: string;
  customType: string | null;
  expiryDate: string;
  status: ReturnType<typeof computeComplianceStatus>["status"];
  daysRemaining: number;
};

export async function getComplianceAlerts(limit = 20): Promise<ComplianceAlert[]> {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const rows = await getComplianceAlarmRows();
  const today = todayIso();

  const alerts: ComplianceAlert[] = rows.map((r) => {
    const { status, daysRemaining } = computeComplianceStatus(r.expiry_date, today);
    return {
      id: r.id,
      vehicleId: r.vehicle_id,
      vehicleName: r.vehicles?.name ?? "—",
      documentType: r.document_type,
      customType: r.custom_type,
      expiryDate: r.expiry_date,
      status,
      daysRemaining,
    };
  });

  // Expired first, then expires-today, then urgent, then warning — a
  // merely-upcoming document must never rank above one that's already
  // overdue.
  return alerts
    .filter((a) => isAlarmStatus(a.status))
    .sort((a, b) => COMPLIANCE_STATUS_SORT_ORDER[a.status] - COMPLIANCE_STATUS_SORT_ORDER[b.status] || a.daysRemaining - b.daysRemaining)
    .slice(0, limit);
}

// Non-throwing — backs the sidebar badge, which every admin page render
// touches indirectly via AdminShell; must never break navigation for a
// staff member without view_compliance. Every row returned by
// getComplianceAlarmRows() already satisfies expiry_date <= today+30, which
// per computeComplianceStatus always yields a non-"valid" status — so the
// row count IS the badge count, no extra query needed. On the dashboard
// page this reuses the exact same request-scoped fetch as the KPI cards and
// alert list; on any other admin page it's the only compliance query that
// runs at all.
export async function getComplianceSidebarBadgeCount(): Promise<number> {
  const user = await getCurrentAdminUser();
  if (!user || !user.permissions.has("view_compliance")) return 0;

  const rows = await getComplianceAlarmRows();
  return rows.length;
}


/**
 * Every compliance document for one vehicle, grouped by document type.
 *
 * The reference system opens a vehicle and shows its whole document register
 * at once, which is how a fleet manager actually thinks: "is this car legal
 * to rent?", not "show me every insurance record in the fleet". The
 * document-type list is the current record for each type (from the existing
 * vehicle_compliance_current view), with the full renewal history beneath it,
 * so an expired-then-renewed document reads correctly rather than appearing
 * twice with no indication which one counts.
 */
export async function getComplianceDossier(vehicleId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const supabase = createAdminClient();

  const [{ data: vehicle }, { data: current }, { data: history }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, name, brand, model, transmission, internal_registration_ref, is_staff_car, status")
      .eq("id", vehicleId)
      .maybeSingle(),
    supabase.from("vehicle_compliance_current").select("*").eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_compliance_records")
      .select("id, document_type, custom_type, reference_number, provider, issued_date, expiry_date, cost_cents, currency, remarks, created_at")
      .eq("vehicle_id", vehicleId)
      .order("expiry_date", { ascending: false }),
  ]);

  const currentIds = new Set((current ?? []).map((c) => (c as { id: string }).id));

  return {
    vehicle,
    current: (current ?? []) as unknown as {
      id: string;
      document_type: string;
      custom_type: string | null;
      reference_number: string | null;
      provider: string | null;
      issued_date: string | null;
      expiry_date: string;
      cost_cents: number | null;
      currency: string;
      remarks: string | null;
    }[],
    history: (history ?? []).filter((h) => !currentIds.has(h.id)),
  };
}

/** Vehicles with their current document count, for the dossier index. */
export async function listComplianceVehicles() {
  const user = await requireAdminUser();
  assertPermission(user, "view_compliance");

  const supabase = createAdminClient();
  const [{ data: vehicles }, { data: current }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, name, brand, model, transmission, internal_registration_ref, is_staff_car")
      .neq("status", "archived")
      .order("name"),
    supabase.from("vehicle_compliance_current").select("vehicle_id, expiry_date"),
  ]);

  const byVehicle = new Map<string, string[]>();
  for (const c of (current ?? []) as unknown as { vehicle_id: string; expiry_date: string }[]) {
    const list = byVehicle.get(c.vehicle_id) ?? [];
    list.push(c.expiry_date);
    byVehicle.set(c.vehicle_id, list);
  }

  return (vehicles ?? []).map((v) => ({
    ...v,
    expiryDates: byVehicle.get(v.id) ?? [],
  }));
}
