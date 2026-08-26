import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/get-current-admin-user", () => ({
  requireAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn(),
}));
vi.mock("@/lib/fleet/vehicle-blocks", () => ({ releaseVehicleBlock: vi.fn() }));
vi.mock("./availability", () => ({ insertVehicleBlock: vi.fn() }));
vi.mock("./maintenance", () => ({ createMaintenanceRecord: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { releaseVehicleBlock } from "@/lib/fleet/vehicle-blocks";
import { insertVehicleBlock } from "./availability";
import { createMaintenanceRecord } from "./maintenance";
import { INSPECTION_CHECKLIST } from "@/lib/fleet/inspection-checklist";
import {
  approveInspection,
  bulkPassUnansweredItems,
  completeInspection,
  createInspection,
  createInspectionDowntime,
  createMaintenanceFromInspection,
  deleteInspection,
  releaseInspectionDowntime,
  setInspectionItemResult,
  updateInspectionHeader,
  uploadInspectionAttachment,
  deleteInspectionAttachment,
} from "./inspections";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const INSPECTION_ID = "22222222-2222-4222-8222-222222222222";
const BLOCK_ID = "33333333-3333-4333-8333-333333333333";

const MANAGER = {
  id: "user-1",
  email: "fleet@codexia.mu",
  fullName: "Fleet Manager",
  roles: ["fleet_manager"],
  permissions: new Set([
    "view_inspections",
    "manage_inspections",
    "approve_inspections",
    "manage_maintenance",
  ]),
};
/** Can run an inspection but may NOT sign it off. */
const INSPECTOR = { ...MANAGER, id: "user-2", permissions: new Set(["view_inspections", "manage_inspections"]) };
const VIEWER = { ...MANAGER, id: "user-3", permissions: new Set(["view_inspections"]) };

type ItemRow = { id: string; item_key: string; result: string | null; remarks: string | null; inspection_id: string };

function allItems(result: string | null = null): ItemRow[] {
  return INSPECTION_CHECKLIST.map((i, n) => ({
    id: `item-${n}`,
    item_key: i.key,
    result,
    remarks: null,
    inspection_id: INSPECTION_ID,
  }));
}

/**
 * A small fake Supabase that records writes, so tests can assert not just the
 * returned value but exactly which columns an action touched — which is how
 * the approval privilege boundary is proven.
 */
function makeSupabase(opts: {
  inspection?: Record<string, unknown> | null;
  items?: ItemRow[];
  vehicle?: Record<string, unknown> | null;
  attachmentCount?: number;
  attachment?: Record<string, unknown> | null;
  maintenanceRows?: { id: string; repairs_performed: string | null }[];
  insertItemsError?: { message: string } | null;
  storageRemoveError?: { message: string } | null;
}) {
  const writes: { table: string; op: string; payload?: unknown }[] = [];
  const storageOps: { op: string; args: unknown }[] = [];
  const items = opts.items ? [...opts.items] : [];

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        _filters: {} as Record<string, unknown>,
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          (builder._filters as Record<string, unknown>)[col] = val;
          return builder;
        },
        in(col: string, vals: unknown[]) {
          (builder._filters as Record<string, unknown>)[`in_${col}`] = vals;
          return builder;
        },
        is(col: string, val: unknown) {
          (builder._filters as Record<string, unknown>)[`is_${col}`] = val;
          return builder;
        },
        not() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        range() {
          return builder;
        },
        async maybeSingle() {
          if (table === "vehicle_inspections") return { data: opts.inspection ?? null, error: null };
          if (table === "vehicles") {
            const v = "vehicle" in opts ? opts.vehicle : { id: VEHICLE_ID };
            return { data: v ?? null, error: null };
          }
          if (table === "vehicle_inspection_attachments") return { data: opts.attachment ?? null, error: null };
          if (table === "vehicle_inspection_items") {
            const id = (builder._filters as Record<string, unknown>).id;
            return { data: items.find((i) => i.id === id) ?? null, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          if (table === "vehicle_inspections") return { data: { id: INSPECTION_ID }, error: null };
          return { data: null, error: null };
        },
        insert(payload: unknown) {
          writes.push({ table, op: "insert", payload });
          if (table === "vehicle_inspection_items" && opts.insertItemsError) {
            return {
              select: () => ({ single: async () => ({ data: null, error: opts.insertItemsError }) }),
              then: (r: (v: unknown) => void) => r({ data: null, error: opts.insertItemsError }),
            };
          }
          return {
            select: () => ({ single: async () => ({ data: { id: INSPECTION_ID }, error: null }) }),
            then: (r: (v: unknown) => void) => r({ data: null, error: null }),
          };
        },
        update(payload: unknown) {
          writes.push({ table, op: "update", payload });
          const chain: Record<string, unknown> = {
            eq: () => chain,
            is: (col: string) => {
              // Bulk pass targets only unanswered rows.
              if (table === "vehicle_inspection_items" && col === "result") {
                const targets = items.filter((i) => i.result === null);
                for (const t of targets) t.result = (payload as { result: string }).result;
                (chain as Record<string, unknown>)._targets = targets;
              }
              return chain;
            },
            select: async () => ({
              data: ((chain as Record<string, unknown>)._targets as ItemRow[]) ?? [],
              error: null,
            }),
            then: (r: (v: unknown) => void) => r({ data: null, error: null }),
          };
          return chain;
        },
        delete() {
          writes.push({ table, op: "delete" });
          const chain: Record<string, unknown> = {
            eq: () => chain,
            then: (r: (v: unknown) => void) => r({ data: null, error: null }),
          };
          return chain;
        },
        then(resolve: (v: unknown) => void) {
          if (table === "vehicle_inspection_items") {
            const keys = (builder._filters as Record<string, unknown>).in_item_key as string[] | undefined;
            const rows = keys ? items.filter((i) => keys.includes(i.item_key)) : items;
            return resolve({ data: rows, error: null });
          }
          if (table === "vehicle_maintenance_records") {
            return resolve({ data: opts.maintenanceRows ?? [], error: null });
          }
          if (table === "vehicle_inspection_attachments") {
            return resolve({ data: [], error: null, count: opts.attachmentCount ?? 0 });
          }
          if (table === "vehicle_fuel_records") return resolve({ data: [], error: null });
          return resolve({ data: [], error: null });
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          async upload(...args: unknown[]) {
            storageOps.push({ op: "upload", args });
            return { error: null };
          },
          async remove(...args: unknown[]) {
            storageOps.push({ op: "remove", args });
            return { error: opts.storageRemoveError ?? null };
          },
          async createSignedUrl() {
            return { data: { signedUrl: "https://signed" }, error: null };
          },
        };
      },
    },
  };

  return {
    client: client as unknown as ReturnType<typeof createAdminClient>,
    writes,
    storageOps,
    items,
  };
}

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireAdminUser).mockResolvedValue(MANAGER);
  vi.mocked(releaseVehicleBlock).mockReset();
  vi.mocked(insertVehicleBlock).mockReset();
  vi.mocked(createMaintenanceRecord).mockReset();
});

// ---------------------------------------------------------------------------

describe("createInspection", () => {
  const valid = { vehicleId: VEHICLE_ID, inspectionDate: "2026-09-18", odometerKm: "50000" };

  it("creates the header and exactly the 40 canonical items, all unanswered", async () => {
    const { client, writes } = makeSupabase({
      vehicle: { id: VEHICLE_ID, name: "Swift", brand: "Suzuki", model: "Swift", internal_registration_ref: "ABC123", deleted_at: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await createInspection({ status: "idle" }, form(valid));

    expect(result.status).toBe("success");
    const itemInsert = writes.find((w) => w.table === "vehicle_inspection_items" && w.op === "insert");
    const rows = itemInsert?.payload as { item_key: string; result: string | null }[];
    expect(rows).toHaveLength(40);
    expect(rows.every((r) => r.result === null)).toBe(true);
    expect(new Set(rows.map((r) => r.item_key)).size).toBe(40);
  });

  it("snapshots vehicle identity for the printed sheet", async () => {
    const { client, writes } = makeSupabase({
      vehicle: { id: VEHICLE_ID, name: "Swift", brand: "Suzuki", model: "Swift", internal_registration_ref: "ABC123", deleted_at: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await createInspection({ status: "idle" }, form(valid));

    const header = writes.find((w) => w.table === "vehicle_inspections" && w.op === "insert")
      ?.payload as Record<string, unknown>;
    expect(header.vehicle_registration).toBe("ABC123");
    expect(header.vehicle_make_model).toBe("Suzuki Swift");
    expect(header.result).toBe("draft");
  });

  // The client sends no item keys at all, so an injected one cannot land.
  it("ignores client-submitted checklist keys entirely", async () => {
    const { client, writes } = makeSupabase({
      vehicle: { id: VEHICLE_ID, name: "Swift", brand: "Suzuki", model: "Swift", internal_registration_ref: null, deleted_at: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await createInspection({ status: "idle" }, form({ ...valid, itemKeys: "ext_sunroof", result: "pass" }));

    const rows = writes.find((w) => w.table === "vehicle_inspection_items")?.payload as { item_key: string }[];
    expect(rows.some((r) => r.item_key === "ext_sunroof")).toBe(false);
    expect(rows).toHaveLength(40);
  });

  it("derives the Sunday week ending from the inspection date", async () => {
    const { client, writes } = makeSupabase({
      vehicle: { id: VEHICLE_ID, name: "Swift", brand: "Suzuki", model: "Swift", internal_registration_ref: null, deleted_at: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await createInspection({ status: "idle" }, form(valid));

    const header = writes.find((w) => w.table === "vehicle_inspections")?.payload as Record<string, unknown>;
    expect(header.week_ending).toBe("2026-09-20");
  });

  it("rejects a vehicle that does not exist", async () => {
    const { client } = makeSupabase({ vehicle: null });
    vi.mocked(createAdminClient).mockReturnValue(client);
    const result = await createInspection({ status: "idle" }, form(valid));
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/does not exist/);
  });

  it("rolls the header back if the checklist cannot be written", async () => {
    const { client, writes } = makeSupabase({
      vehicle: { id: VEHICLE_ID, name: "Swift", brand: "Suzuki", model: "Swift", internal_registration_ref: null, deleted_at: null },
      insertItemsError: { message: "boom" },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await createInspection({ status: "idle" }, form(valid));

    expect(result.status).toBe("error");
    expect(writes.some((w) => w.table === "vehicle_inspections" && w.op === "delete")).toBe(true);
  });

  it("requires manage_inspections", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEWER);
    await expect(createInspection({ status: "idle" }, form(valid))).rejects.toThrow(
      /Missing required permission: manage_inspections/
    );
  });
});

// ---------------------------------------------------------------------------

describe("checklist answers and derived result", () => {
  function setup(items: ItemRow[], inspection: Record<string, unknown> = {}) {
    const { client, writes } = makeSupabase({
      items,
      inspection: {
        id: INSPECTION_ID,
        vehicle_id: VEHICLE_ID,
        inspection_date: "2026-09-18",
        odometer_km: 50000,
        result: "draft",
        approved_at: null,
        availability_block_id: null,
        ...inspection,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    return { writes };
  }

  function derivedResult(writes: { table: string; op: string; payload?: unknown }[]) {
    const update = writes
      .filter((w) => w.table === "vehicle_inspections" && w.op === "update")
      .map((w) => w.payload as Record<string, unknown>)
      .find((p) => "result" in p);
    return update?.result;
  }

  it("stores a pass and derives completed once every item is answered", async () => {
    const items = allItems("pass");
    const { writes } = setup(items);
    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "pass" }));
    expect(res.ok).toBe(true);
    expect(derivedResult(writes)).toBe("completed");
  });

  it("derives attention_required from an attention item", async () => {
    const items = allItems("pass");
    items[5].result = "attention";
    const { writes } = setup(items);
    await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "ext_brake_lights", result: "attention" }));
    expect(derivedResult(writes)).toBe("attention_required");
  });

  it("derives failed from a fail item even alongside attention", async () => {
    const items = allItems("pass");
    items[5].result = "attention";
    items[35].result = "fail";
    const { writes } = setup(items);
    await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "fail" }));
    expect(derivedResult(writes)).toBe("failed");
  });

  it("treats n/a as answered and not a defect", async () => {
    const items = allItems("pass");
    items[3].result = "na";
    const { writes } = setup(items);
    await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "ext_wiper_blades", result: "na" }));
    expect(derivedResult(writes)).toBe("completed");
  });

  it("stays draft while an item is unanswered", async () => {
    const items = allItems("pass");
    items[10].result = null;
    const { writes } = setup(items);
    await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "tyre_front_tread", result: "" }));
    expect(derivedResult(writes)).toBe("draft");
  });

  it("reports safety-critical failures back to the caller", async () => {
    const items = allItems("pass");
    items[35].result = "fail"; // road_brakes
    const { writes } = setup(items);
    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "fail" }));
    expect(res.safetyFailures).toContain("road_brakes");
    expect(derivedResult(writes)).toBe("failed");
  });

  it("rejects an unknown checklist key", async () => {
    setup(allItems("pass"));
    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "ext_sunroof", result: "pass" }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Unknown checklist item/);
  });

  it("refuses to edit an approved inspection", async () => {
    setup(allItems("pass"), { approved_at: "2026-09-21T08:00:00Z", result: "failed" });
    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "pass" }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/approved/);
  });
});

// ---------------------------------------------------------------------------

describe("bulkPassUnansweredItems", () => {
  it("fills only unanswered items and leaves recorded defects alone", async () => {
    const items = allItems(null);
    items[5].result = "fail";
    items[6].result = "attention";
    items[7].result = "na";

    const { client } = makeSupabase({
      items,
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await bulkPassUnansweredItems(INSPECTION_ID);

    expect(res.ok).toBe(true);
    expect(res.updated).toBe(37);
    expect(items[5].result).toBe("fail");
    expect(items[6].result).toBe("attention");
    expect(items[7].result).toBe("na");
  });

  it("audits the bulk operation so a rubber-stamped sheet is traceable", async () => {
    const { client, writes } = makeSupabase({
      items: allItems(null),
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await bulkPassUnansweredItems(INSPECTION_ID);

    const audit = writes.find(
      (w) => w.table === "audit_logs" && (w.payload as { action?: string }).action === "inspection_bulk_passed"
    );
    expect(audit).toBeDefined();
    expect((audit?.payload as { diff: { items_marked_pass: number } }).diff.items_marked_pass).toBe(40);
  });

  it("refuses on an approved inspection", async () => {
    const { client } = makeSupabase({
      items: allItems(null),
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "failed", approved_at: "2026-09-21T08:00:00Z", availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    const res = await bulkPassUnansweredItems(INSPECTION_ID);
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("completeInspection", () => {
  it("refuses while any item is unanswered", async () => {
    const items = allItems("pass");
    items[9].result = null;
    const { client } = makeSupabase({
      items,
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await completeInspection(INSPECTION_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no answer/);
  });

  it("completes once every item is answered", async () => {
    const { client } = makeSupabase({
      items: allItems("pass"),
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await completeInspection(INSPECTION_ID);
    expect(res.ok).toBe(true);
    expect(res.result).toBe("completed");
  });

  it("completes as failed and surfaces the safety-critical failures", async () => {
    const items = allItems("pass");
    items[35].result = "fail"; // road_brakes
    const { client } = makeSupabase({
      items,
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await completeInspection(INSPECTION_ID);
    expect(res.result).toBe("failed");
    expect(res.safetyFailures).toContain("road_brakes");
  });
});

// ---------------------------------------------------------------------------

describe("approval privilege boundary", () => {
  function setup(inspection: Record<string, unknown> = {}) {
    const { client, writes } = makeSupabase({
      items: allItems("pass"),
      inspection: {
        id: INSPECTION_ID,
        vehicle_id: VEHICLE_ID,
        result: "failed",
        approved_at: null,
        availability_block_id: null,
        ...inspection,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    return { writes };
  }

  it("denies approval to someone holding only manage_inspections", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(INSPECTOR);
    setup();
    await expect(approveInspection(INSPECTION_ID, { status: "idle" }, form({}))).rejects.toThrow(
      /Missing required permission: approve_inspections/
    );
  });

  it("approves with the server-side user, never a client-supplied name", async () => {
    const { writes } = setup();
    const res = await approveInspection(
      INSPECTION_ID,
      { status: "idle" },
      form({ approvalRemarks: "Reviewed", approvedBy: "somebody-else", approved_by: "somebody-else" })
    );

    expect(res.status).toBe("success");
    const update = writes.find((w) => w.table === "vehicle_inspections" && w.op === "update")
      ?.payload as Record<string, unknown>;
    expect(update.approved_by).toBe(MANAGER.id);
    expect(update.approved_at).toBeTruthy();
    expect(update.approval_remarks).toBe("Reviewed");
  });

  // The whole point of splitting approval out of the result enum.
  it("never touches result when approving — FAILED stays FAILED", async () => {
    const { writes } = setup({ result: "failed" });
    await approveInspection(INSPECTION_ID, { status: "idle" }, form({}));

    const updates = writes
      .filter((w) => w.table === "vehicle_inspections" && w.op === "update")
      .map((w) => w.payload as Record<string, unknown>);
    expect(updates.every((u) => !("result" in u))).toBe(true);
    expect(updates.every((u) => !("defects_notes" in u))).toBe(true);
  });

  it("refuses to approve a draft inspection", async () => {
    setup({ result: "draft" });
    const res = await approveInspection(INSPECTION_ID, { status: "idle" }, form({}));
    expect(res.status).toBe("error");
    expect(res.error).toMatch(/Finish the checklist/);
  });

  it("refuses to approve twice", async () => {
    setup({ approved_at: "2026-09-21T08:00:00Z" });
    const res = await approveInspection(INSPECTION_ID, { status: "idle" }, form({}));
    expect(res.status).toBe("error");
    expect(res.error).toMatch(/already approved/);
  });

  // The ordinary edit path must not be a back door into the approval columns.
  it("updateInspectionHeader cannot write approval columns", async () => {
    const { client, writes } = makeSupabase({
      items: allItems("pass"),
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "completed", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(requireAdminUser).mockResolvedValue(INSPECTOR);

    await updateInspectionHeader(
      INSPECTION_ID,
      { status: "idle" },
      form({
        inspectionDate: "2026-09-18",
        odometerKm: "50000",
        approved_by: INSPECTOR.id,
        approved_at: "2026-09-21T08:00:00Z",
        approvalRemarks: "self-approved",
        result: "completed",
      })
    );

    const update = writes.find((w) => w.table === "vehicle_inspections" && w.op === "update")
      ?.payload as Record<string, unknown>;
    expect("approved_by" in update).toBe(false);
    expect("approved_at" in update).toBe(false);
    expect("approval_remarks" in update).toBe(false);
    expect("result" in update).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("maintenance follow-up", () => {
  function setup(items: ItemRow[], maintenanceRows: { id: string; repairs_performed: string | null }[] = []) {
    const { client, writes } = makeSupabase({
      items,
      maintenanceRows,
      inspection: {
        id: INSPECTION_ID,
        vehicle_id: VEHICLE_ID,
        inspection_date: "2026-09-18",
        odometer_km: 50000,
        result: "failed",
        approved_at: null,
        availability_block_id: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    return { writes };
  }

  function followUpForm(keys: string[]) {
    const fd = new FormData();
    for (const k of keys) fd.append("itemKeys", k);
    return fd;
  }

  it("raises a maintenance job through the canonical path with the inspection link", async () => {
    const items = allItems("pass");
    items[35].result = "fail"; // road_brakes
    setup(items);
    vi.mocked(createMaintenanceRecord).mockResolvedValue({ status: "success" });

    const res = await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["road_brakes"]));

    expect(res.ok).toBe(true);
    expect(createMaintenanceRecord).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(createMaintenanceRecord).mock.calls[0][1] as FormData;
    expect(sent.get("sourceInspectionId")).toBe(INSPECTION_ID);
    expect(sent.get("vehicleId")).toBe(VEHICLE_ID);
    expect(sent.get("maintenanceDate")).toBe("2026-09-18");
    expect(sent.get("mileageKm")).toBe("50000");
    expect(String(sent.get("repairsPerformed"))).toContain("Brakes operating correctly");
  });

  it("does not fabricate a cost", async () => {
    const items = allItems("pass");
    items[35].result = "fail";
    setup(items);
    vi.mocked(createMaintenanceRecord).mockResolvedValue({ status: "success" });

    await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["road_brakes"]));

    const sent = vi.mocked(createMaintenanceRecord).mock.calls[0][1] as FormData;
    expect(sent.get("costMur")).toBe("");
    expect(sent.get("partsCostMur")).toBe("");
  });

  it("refuses items that are not a defect", async () => {
    setup(allItems("pass"));
    const res = await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["road_brakes"]));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Fail or Attention/);
    expect(createMaintenanceRecord).not.toHaveBeenCalled();
  });

  it("accepts an attention item", async () => {
    const items = allItems("pass");
    items[24].result = "attention"; // int_air_conditioning
    setup(items);
    vi.mocked(createMaintenanceRecord).mockResolvedValue({ status: "success" });
    const res = await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["int_air_conditioning"]));
    expect(res.ok).toBe(true);
  });

  // Guards a double-click without forbidding a genuinely different second job.
  it("treats a repeated identical submission as a no-op", async () => {
    const items = allItems("pass");
    items[35].result = "fail";
    const existingDescription = "[FAIL] Brakes operating correctly";
    setup(items, [{ id: "m1", repairs_performed: existingDescription }]);
    vi.mocked(createMaintenanceRecord).mockResolvedValue({ status: "success" });

    const res = await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["road_brakes"]));

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(true);
    expect(createMaintenanceRecord).not.toHaveBeenCalled();
  });

  it("still allows a different selection to raise a second job", async () => {
    const items = allItems("pass");
    items[35].result = "fail"; // road_brakes
    items[24].result = "fail"; // int_air_conditioning
    setup(items, [{ id: "m1", repairs_performed: "[FAIL] Brakes operating correctly" }]);
    vi.mocked(createMaintenanceRecord).mockResolvedValue({ status: "success" });

    const res = await createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["int_air_conditioning"]));

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBeUndefined();
    expect(createMaintenanceRecord).toHaveBeenCalledTimes(1);
  });

  it("requires manage_maintenance as well as manage_inspections", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(INSPECTOR);
    setup(allItems("fail"));
    await expect(
      createMaintenanceFromInspection(INSPECTION_ID, followUpForm(["road_brakes"]))
    ).rejects.toThrow(/Missing required permission: manage_maintenance/);
  });
});

// ---------------------------------------------------------------------------

describe("inspection downtime", () => {
  const downtime = { startAt: "2026-09-21T10:00", endAt: "2026-09-22T10:00" };

  function setup(inspection: Record<string, unknown> = {}) {
    const { client, writes } = makeSupabase({
      inspection: {
        id: INSPECTION_ID,
        vehicle_id: VEHICLE_ID,
        inspection_date: "2026-09-18",
        result: "failed",
        approved_at: null,
        availability_block_id: null,
        ...inspection,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    return { writes };
  }

  it("creates a canonical block of type inspection", async () => {
    setup();
    vi.mocked(insertVehicleBlock).mockResolvedValue({ ok: true, blockId: BLOCK_ID });

    const res = await createInspectionDowntime(INSPECTION_ID, { status: "idle" }, form(downtime));

    expect(res.status).toBe("success");
    expect(insertVehicleBlock).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: VEHICLE_ID, type: "inspection" })
    );
  });

  it("stores the block id against the inspection", async () => {
    const { writes } = setup();
    vi.mocked(insertVehicleBlock).mockResolvedValue({ ok: true, blockId: BLOCK_ID });

    await createInspectionDowntime(INSPECTION_ID, { status: "idle" }, form(downtime));

    const update = writes.find((w) => w.table === "vehicle_inspections" && w.op === "update")
      ?.payload as Record<string, unknown>;
    expect(update.availability_block_id).toBe(BLOCK_ID);
  });

  it("surfaces an overlap rejection from the shared primitive", async () => {
    setup();
    vi.mocked(insertVehicleBlock).mockResolvedValue({
      ok: false,
      error: "This vehicle already has an overlapping block or booking.",
    });

    const res = await createInspectionDowntime(INSPECTION_ID, { status: "idle" }, form(downtime));

    expect(res.status).toBe("error");
    expect(res.error).toMatch(/overlapping/);
  });

  it("refuses a second block on the same inspection", async () => {
    setup({ availability_block_id: BLOCK_ID });
    const res = await createInspectionDowntime(INSPECTION_ID, { status: "idle" }, form(downtime));
    expect(res.status).toBe("error");
    expect(insertVehicleBlock).not.toHaveBeenCalled();
  });

  it("rejects an end before the start without touching the block engine", async () => {
    setup();
    const res = await createInspectionDowntime(
      INSPECTION_ID,
      { status: "idle" },
      form({ startAt: "2026-09-22T10:00", endAt: "2026-09-21T10:00" })
    );
    expect(res.status).toBe("error");
    expect(insertVehicleBlock).not.toHaveBeenCalled();
  });

  it("releases a future block through the shared primitive", async () => {
    const { writes } = setup({ availability_block_id: BLOCK_ID });
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "removed" });

    const res = await releaseInspectionDowntime(INSPECTION_ID);

    expect(res.ok).toBe(true);
    expect(res.outcome).toBe("removed");
    expect(releaseVehicleBlock).toHaveBeenCalledWith(expect.anything(), BLOCK_ID);
    const update = writes.find(
      (w) => w.table === "vehicle_inspections" && (w.payload as Record<string, unknown>).availability_block_id === null
    );
    expect(update).toBeDefined();
  });

  it("shortens a started block rather than deleting it", async () => {
    setup({ availability_block_id: BLOCK_ID });
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "shortened" });
    const res = await releaseInspectionDowntime(INSPECTION_ID);
    expect(res.outcome).toBe("shortened");
  });

  it("fails closed when the release fails", async () => {
    const { writes } = setup({ availability_block_id: BLOCK_ID });
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: false, error: "Failed to close the vehicle's downtime." });

    const res = await releaseInspectionDowntime(INSPECTION_ID);

    expect(res.ok).toBe(false);
    expect(
      writes.some(
        (w) => w.table === "vehicle_inspections" && (w.payload as Record<string, unknown>)?.availability_block_id === null
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("deletion lifecycle", () => {
  function setup(inspection: Record<string, unknown>, attachmentCount = 0) {
    const { client, writes } = makeSupabase({
      attachmentCount,
      inspection: {
        id: INSPECTION_ID,
        vehicle_id: VEHICLE_ID,
        result: "draft",
        approved_at: null,
        availability_block_id: null,
        ...inspection,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    return { writes };
  }

  it("deletes a draft, unapproved inspection with no attachments", async () => {
    const { writes } = setup({});
    const res = await deleteInspection(INSPECTION_ID);
    expect(res.ok).toBe(true);
    expect(writes.some((w) => w.table === "vehicle_inspections" && w.op === "delete")).toBe(true);
  });

  it("refuses to delete a completed inspection", async () => {
    const { writes } = setup({ result: "completed" });
    const res = await deleteInspection(INSPECTION_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Only a draft inspection/);
    expect(writes.some((w) => w.op === "delete")).toBe(false);
  });

  it("refuses to delete a failed inspection", async () => {
    const res = await (setup({ result: "failed" }), deleteInspection(INSPECTION_ID));
    expect(res.ok).toBe(false);
  });

  it("refuses to delete an approved inspection", async () => {
    setup({ result: "failed", approved_at: "2026-09-21T08:00:00Z" });
    const res = await deleteInspection(INSPECTION_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/signed record/);
  });

  it("refuses when evidence is attached rather than orphaning stored files", async () => {
    setup({}, 2);
    const res = await deleteInspection(INSPECTION_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Remove the attached evidence/);
  });

  it("releases downtime before deleting, so no block is orphaned", async () => {
    const { writes } = setup({ availability_block_id: BLOCK_ID });
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "removed" });

    const res = await deleteInspection(INSPECTION_ID);

    expect(res.ok).toBe(true);
    expect(releaseVehicleBlock).toHaveBeenCalledWith(expect.anything(), BLOCK_ID);
    expect(writes.some((w) => w.table === "vehicle_inspections" && w.op === "delete")).toBe(true);
  });

  it("keeps the inspection when the block cannot be released", async () => {
    const { writes } = setup({ availability_block_id: BLOCK_ID });
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: false, error: "Failed to close the vehicle's downtime." });

    const res = await deleteInspection(INSPECTION_ID);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/was not deleted/);
    expect(writes.some((w) => w.table === "vehicle_inspections" && w.op === "delete")).toBe(false);
  });

  // The FK is ON DELETE SET NULL, so no maintenance row is ever removed here.
  it("never deletes maintenance follow-ups", async () => {
    const { writes } = setup({});
    await deleteInspection(INSPECTION_ID);
    expect(writes.some((w) => w.table === "vehicle_maintenance_records" && w.op === "delete")).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("attachments", () => {
  const file = (name: string, type: string, size: number) => {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  function attachmentForm(f: File, extra: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("document", f);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  }

  it("accepts an allowed MIME type", async () => {
    const { client, storageOps } = makeSupabase({
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await uploadInspectionAttachment(INSPECTION_ID, attachmentForm(file("tyre.jpg", "image/jpeg", 1024)));

    expect(res.ok).toBe(true);
    expect(storageOps.some((o) => o.op === "upload")).toBe(true);
  });

  it("rejects a disallowed MIME type before touching storage", async () => {
    const { client, storageOps } = makeSupabase({
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await uploadInspectionAttachment(
      INSPECTION_ID,
      attachmentForm(file("evil.exe", "application/x-msdownload", 1024))
    );

    expect(res.ok).toBe(false);
    expect(storageOps).toHaveLength(0);
  });

  it("rejects an oversize file", async () => {
    const { client } = makeSupabase({
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await uploadInspectionAttachment(
      INSPECTION_ID,
      attachmentForm(file("huge.pdf", "application/pdf", 16 * 1024 * 1024))
    );

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/15 MB/);
  });

  it("rejects an item that belongs to a different inspection", async () => {
    const { client } = makeSupabase({
      items: [],
      inspection: { id: INSPECTION_ID, vehicle_id: VEHICLE_ID, result: "draft", approved_at: null, availability_block_id: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await uploadInspectionAttachment(
      INSPECTION_ID,
      attachmentForm(file("tyre.jpg", "image/jpeg", 1024), { inspectionItemId: "item-from-elsewhere" })
    );

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/does not belong to this inspection/);
  });

  // Storage first, then the row: a failed storage delete must leave the
  // metadata behind rather than creating an invisible orphan in the bucket.
  it("keeps the database row when storage deletion fails", async () => {
    const { client, writes } = makeSupabase({
      attachment: { storage_path: "path/x.jpg", inspection_id: INSPECTION_ID },
      storageRemoveError: { message: "denied" },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await deleteInspectionAttachment("att-1");

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/was not removed/);
    expect(writes.some((w) => w.table === "vehicle_inspection_attachments" && w.op === "delete")).toBe(false);
  });

  it("deletes storage then the row when storage succeeds", async () => {
    const { client, writes, storageOps } = makeSupabase({
      attachment: { storage_path: "path/x.jpg", inspection_id: INSPECTION_ID },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await deleteInspectionAttachment("att-1");

    expect(res.ok).toBe(true);
    expect(storageOps.some((o) => o.op === "remove")).toBe(true);
    expect(writes.some((w) => w.table === "vehicle_inspection_attachments" && w.op === "delete")).toBe(true);
  });

  it("requires manage_inspections to upload", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEWER);
    await expect(
      uploadInspectionAttachment(INSPECTION_ID, attachmentForm(file("t.jpg", "image/jpeg", 10)))
    ).rejects.toThrow(/Missing required permission: manage_inspections/);
  });
});

/**
 * The cleanup path relied on by live verification.
 *
 * Completion makes an inspection non-draft, and deleteInspection refuses
 * anything but a draft — so a completed synthetic record could otherwise
 * never be removed without bypassing the immutability policy. Clearing one
 * answer through the ordinary action returns the derived result to `draft`,
 * which makes the record deletable again through the ordinary action too.
 *
 * This works only while the inspection is UNAPPROVED. Once approved it is a
 * signed historical record and both paths refuse, by design.
 */
describe("draft walk-back — how a completed synthetic inspection is cleaned", () => {
  const completedInspection = {
    id: INSPECTION_ID,
    vehicle_id: VEHICLE_ID,
    inspection_date: "2026-09-18",
    odometer_km: 50000,
    result: "failed",
    approved_at: null,
    availability_block_id: null,
  };

  it("allows clearing an answer on a completed but unapproved inspection", async () => {
    const items = allItems("pass");
    items[35].result = "fail";
    const { client, writes } = makeSupabase({ items, inspection: completedInspection });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "" }));

    expect(res.ok).toBe(true);
    const itemUpdate = writes.find((w) => w.table === "vehicle_inspection_items" && w.op === "update");
    expect((itemUpdate?.payload as { result: unknown }).result).toBeNull();
  });

  it("recomputes the result back to draft once an item is unanswered", async () => {
    const items = allItems("pass");
    items[35].result = null; // already cleared
    const { client, writes } = makeSupabase({ items, inspection: completedInspection });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "" }));

    const headerUpdate = writes
      .filter((w) => w.table === "vehicle_inspections" && w.op === "update")
      .map((w) => w.payload as Record<string, unknown>)
      .find((p) => "result" in p);
    expect(headerUpdate?.result).toBe("draft");
  });

  it("then permits deletion, because the record is a draft again", async () => {
    const { client, writes } = makeSupabase({
      inspection: { ...completedInspection, result: "draft" },
      attachmentCount: 0,
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await deleteInspection(INSPECTION_ID);

    expect(res.ok).toBe(true);
    expect(writes.some((w) => w.table === "vehicle_inspections" && w.op === "delete")).toBe(true);
  });

  // The escape hatch must not exist for a signed record.
  it("refuses the walk-back entirely once the inspection is approved", async () => {
    const { client, writes } = makeSupabase({
      items: allItems("pass"),
      inspection: { ...completedInspection, approved_at: "2026-09-21T08:00:00Z" },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const res = await setInspectionItemResult(INSPECTION_ID, form({ itemKey: "road_brakes", result: "" }));

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/approved/);
    expect(writes.some((w) => w.table === "vehicle_inspection_items")).toBe(false);
  });
});
