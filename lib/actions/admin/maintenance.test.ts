import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth/get-current-admin-user", () => ({
  requireAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn(),
}));
vi.mock("@/lib/fleet/vehicle-blocks", () => ({
  releaseVehicleBlock: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { releaseVehicleBlock } from "@/lib/fleet/vehicle-blocks";
import { createMaintenanceRecord, updateMaintenanceRecord, deleteMaintenanceRecord } from "./maintenance";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";

const FULL_USER = {
  id: "user-1",
  email: "admin@codexia.mu",
  fullName: "Test Admin",
  roles: ["super_admin"],
  permissions: new Set(["view_maintenance", "manage_maintenance"]),
};

const VIEW_ONLY_USER = {
  ...FULL_USER,
  permissions: new Set(["view_maintenance"]),
};

// Minimal fake query builder — every chain method returns itself, `.single()`
// / `.maybeSingle()` resolve immediately, and the builder itself is
// thenable so `await` on a bare filter chain (e.g. delete().eq(...)) works
// without a terminal method call. Configured per-table since each action
// under test touches every table at most once per invocation.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

function makeFakeSupabase(byTable: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: (table: string) => makeQueryBuilder(byTable[table] ?? { data: null, error: null }),
  };
}

function validFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    vehicleId: VEHICLE_ID,
    maintenanceDate: "2026-01-15",
    maintenanceType: "scheduled_service",
    customType: "",
    repairsPerformed: "",
    partsChanged: "",
    tyreChanges: "",
    batteryChanges: "",
    servicingDetails: "Full service",
    oilFilterChanges: "",
    brakeWork: "",
    suspensionWork: "",
    electricalWork: "",
    mileageKm: "45000",
    serviceProvider: "Auto Garage Ltd",
    costMur: "120.50",
    remarks: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireAdminUser).mockReset();
  vi.mocked(createAdminClient).mockReset();
});

describe("createMaintenanceRecord", () => {
  it("creates a record when the user has manage_maintenance and the vehicle exists", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeFakeSupabase({
        vehicles: { data: { id: VEHICLE_ID }, error: null },
        vehicle_maintenance_records: { data: { id: RECORD_ID }, error: null },
        audit_logs: { data: null, error: null },
      }) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await createMaintenanceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
  });

  it("rejects with permission denied when manage_maintenance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);

    await expect(createMaintenanceRecord({ status: "idle" }, validFormData())).rejects.toThrow(
      /Missing required permission: manage_maintenance/
    );
  });

  it("returns an error when the selected vehicle does not exist", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeFakeSupabase({
        vehicles: { data: null, error: null },
      }) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await createMaintenanceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "error", error: "Selected vehicle does not exist." });
  });

  it("returns a validation error for a negative cost without touching the database", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const fakeFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from: fakeFrom } as unknown as ReturnType<typeof createAdminClient>);

    const result = await createMaintenanceRecord({ status: "idle" }, validFormData({ costMur: "-10" }));
    expect(result).toEqual({ status: "error", error: "Please check the form for errors." });
    expect(fakeFrom).not.toHaveBeenCalled();
  });
});

describe("vehicle info sync (opt-in checkbox)", () => {
  it("does NOT touch the vehicles table when updateVehicleInfo is unchecked", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const vehicleUpdateCalls: unknown[] = [];
    const supabase = {
      from: (table: string) => {
        if (table === "vehicles") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { id: VEHICLE_ID }, error: null }),
            update: (payload: unknown) => {
              vehicleUpdateCalls.push(payload);
              return builder;
            },
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return builder;
        }
        return makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createMaintenanceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
    expect(vehicleUpdateCalls).toHaveLength(0);
  });

  it("updates last_service_date and current_mileage_km when updateVehicleInfo is checked", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const vehicleUpdateCalls: unknown[] = [];
    const supabase = {
      from: (table: string) => {
        if (table === "vehicles") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { id: VEHICLE_ID }, error: null }),
            update: (payload: unknown) => {
              vehicleUpdateCalls.push(payload);
              return builder;
            },
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return builder;
        }
        return makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createMaintenanceRecord(
      { status: "idle" },
      validFormData({ updateVehicleInfo: "true", mileageKm: "52000", maintenanceDate: "2026-02-01" })
    );
    expect(result).toEqual({ status: "success" });
    expect(vehicleUpdateCalls).toEqual([{ last_service_date: "2026-02-01", current_mileage_km: 52000 }]);
  });

  it("omits current_mileage_km from the vehicle update when mileage was left blank", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const vehicleUpdateCalls: unknown[] = [];
    const supabase = {
      from: (table: string) => {
        if (table === "vehicles") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { id: VEHICLE_ID }, error: null }),
            update: (payload: unknown) => {
              vehicleUpdateCalls.push(payload);
              return builder;
            },
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return builder;
        }
        return makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await createMaintenanceRecord({ status: "idle" }, validFormData({ updateVehicleInfo: "true", mileageKm: "" }));
    expect(vehicleUpdateCalls).toEqual([{ last_service_date: "2026-01-15" }]);
  });
});

describe("updateMaintenanceRecord", () => {
  it("updates a record when the user has manage_maintenance and the vehicle exists", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeFakeSupabase({
        vehicles: { data: { id: VEHICLE_ID }, error: null },
        vehicle_maintenance_records: { data: null, error: null },
        audit_logs: { data: null, error: null },
      }) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await updateMaintenanceRecord(RECORD_ID, { status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
  });

  it("rejects with permission denied when manage_maintenance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);

    await expect(updateMaintenanceRecord(RECORD_ID, { status: "idle" }, validFormData())).rejects.toThrow(
      /Missing required permission: manage_maintenance/
    );
  });
});

describe("deleteMaintenanceRecord", () => {
  it("deletes a record when the user has manage_maintenance", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeFakeSupabase({
        vehicle_maintenance_records: { data: null, error: null },
        audit_logs: { data: null, error: null },
      }) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await deleteMaintenanceRecord(RECORD_ID);
    expect(result).toEqual({ ok: true });
  });

  it("rejects with permission denied when manage_maintenance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);

    await expect(deleteMaintenanceRecord(RECORD_ID)).rejects.toThrow(/Missing required permission: manage_maintenance/);
  });

  it("returns an error when the delete fails", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeFakeSupabase({
        vehicle_maintenance_records: { data: null, error: { message: "db error" } },
      }) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await deleteMaintenanceRecord(RECORD_ID);
    expect(result.ok).toBe(false);
  });
});

/**
 * Maintenance downtime is released on delete by the SAME primitive the
 * incident path uses, so the two cannot drift apart.
 */
describe("deleteMaintenanceRecord — downtime must never be orphaned", () => {
  function supabaseWithBlock(blockId: string | null) {
    const deleted: string[] = [];
    const audits: unknown[] = [];
    const client = {
      from: (table: string) => {
        if (table === "vehicle_maintenance_records") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { availability_block_id: blockId }, error: null }),
            delete: () => ({
              eq: async (_c: string, id: string) => {
                deleted.push(id);
                return { data: null, error: null };
              },
            }),
          };
          return builder;
        }
        if (table === "audit_logs") {
          return {
            insert: async (payload: unknown) => {
              audits.push(payload);
              return { data: null, error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    return { client, deleted, audits };
  }

  beforeEach(() => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(releaseVehicleBlock).mockReset();
  });

  it("deletes a history-only record without touching any block", async () => {
    const { client, deleted } = supabaseWithBlock(null);
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteMaintenanceRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([RECORD_ID]);
    expect(releaseVehicleBlock).not.toHaveBeenCalled();
  });

  it("releases downtime before deleting a record that took the car off the road", async () => {
    const { client, deleted, audits } = supabaseWithBlock("block-1");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "removed" });

    const result = await deleteMaintenanceRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(releaseVehicleBlock).toHaveBeenCalledWith(expect.anything(), "block-1");
    expect(deleted).toEqual([RECORD_ID]);
    expect(audits[0]).toMatchObject({ diff: { availability_block: "removed" } });
  });

  it("preserves an already-served downtime by shortening rather than deleting it", async () => {
    const { client, audits } = supabaseWithBlock("block-started");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "shortened" });

    const result = await deleteMaintenanceRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(audits[0]).toMatchObject({ diff: { availability_block: "shortened" } });
  });

  it("keeps the record when the block cannot be released", async () => {
    const { client, deleted } = supabaseWithBlock("block-stuck");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: false, error: "Failed to close the vehicle's downtime." });

    const result = await deleteMaintenanceRecord(RECORD_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/was not deleted/);
    expect(deleted).toEqual([]);
  });
});
