import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth/get-current-admin-user", () => ({
  requireAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn(),
}));
vi.mock("./availability", () => ({
  closeBlockEarly: vi.fn(),
}));
vi.mock("@/lib/fleet/vehicle-blocks", () => ({
  insertVehicleBlock: vi.fn(),
  releaseVehicleBlock: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { closeBlockEarly } from "./availability";
import { insertVehicleBlock, releaseVehicleBlock } from "@/lib/fleet/vehicle-blocks";
import {
  createIncidentRecord,
  updateIncidentRecord,
  deleteIncidentRecord,
  closeIncidentAvailabilityBlock,
  uploadIncidentAttachment,
  deleteIncidentAttachment,
  getIncidentDashboardStats,
} from "./incidents";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";

const FULL_USER = {
  id: "user-1",
  email: "admin@codexia.mu",
  fullName: "Test Admin",
  roles: ["super_admin"],
  permissions: new Set(["view_incidents", "manage_incidents"]),
};

const VIEW_ONLY_USER = { ...FULL_USER, permissions: new Set(["view_incidents"]) };

function makeQueryBuilder(result: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    in: () => builder,
    is: () => builder,
    gte: () => builder,
    lt: () => builder,
    order: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

function makeIncidentSupabase(
  opts: {
    vehicleExists?: boolean;
    bookingId?: string | null;
    insertedId?: string;
    existingRepairStatus?: string;
  } = {}
) {
  const vehicleExists = opts.vehicleExists ?? true;
  return {
    from: (table: string) => {
      if (table === "vehicles") {
        return makeQueryBuilder({ data: vehicleExists ? { id: VEHICLE_ID } : null, error: null });
      }
      if (table === "bookings") {
        return makeQueryBuilder({ data: opts.bookingId ? { id: opts.bookingId } : null, error: null });
      }
      if (table === "vehicle_incident_records") {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({
            data: opts.existingRepairStatus ? { repair_status: opts.existingRepairStatus } : null,
            error: null,
          }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: opts.insertedId ?? RECORD_ID }, error: null }) }) }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
          delete: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
        return builder;
      }
      return makeQueryBuilder({ data: null, error: null });
    },
  };
}

function baseFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    vehicleId: VEHICLE_ID,
    incidentDate: "2026-03-10",
    incidentTime: "14:30",
    location: "Grand Baie roundabout",
    driverCustomerName: "Jean Dupont",
    bookingReference: "",
    incidentType: "collision",
    customType: "",
    accidentDescription: "Rear-ended at a roundabout",
    damageDescription: "Rear bumper cracked",
    affectedAreas: "Rear bumper",
    policeReportReference: "",
    insuranceClaimReference: "",
    thirdPartyDetails: "",
    estimatedRepairCostMur: "450.00",
    actualRepairCostMur: "",
    vehicleOperationalStatus: "operational",
    repairStatus: "reported",
    severity: "moderate",
    dateReported: "2026-03-10",
    dateRepairStarted: "",
    dateRepaired: "",
    downtimeStart: "",
    downtimeEnd: "",
    remarks: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireAdminUser).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(insertVehicleBlock).mockReset();
  vi.mocked(closeBlockEarly).mockReset();
});

describe("createIncidentRecord", () => {
  it("creates a record when the user has manage_incidents and the vehicle exists", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(makeIncidentSupabase() as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord({ status: "idle" }, baseFormData());
    expect(result).toEqual({ status: "success" });
  });

  it("rejects with permission denied when manage_incidents is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(createIncidentRecord({ status: "idle" }, baseFormData())).rejects.toThrow(
      /Missing required permission: manage_incidents/
    );
  });

  it("returns an error when the selected vehicle does not exist", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeIncidentSupabase({ vehicleExists: false }) as unknown as ReturnType<typeof createAdminClient>
    );
    const result = await createIncidentRecord({ status: "idle" }, baseFormData());
    expect(result).toEqual({ status: "error", error: "Selected vehicle does not exist." });
  });

  it("links to a booking when a valid reference is provided", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    let insertedPayload: unknown;
    const base = makeIncidentSupabase({ bookingId: BOOKING_ID });
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder = base.from(table) as Record<string, unknown>;
          const originalInsert = builder.insert as (p: unknown) => unknown;
          builder.insert = (payload: unknown) => {
            insertedPayload = payload;
            return originalInsert(payload);
          };
          return builder;
        }
        return base.from(table);
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord({ status: "idle" }, baseFormData({ bookingReference: "CDX-2026-00042" }));
    expect(result).toEqual({ status: "success" });
    expect((insertedPayload as { booking_id: string }).booking_id).toBe(BOOKING_ID);
  });

  it("returns an error when the booking reference does not resolve to any booking", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      makeIncidentSupabase({ bookingId: null }) as unknown as ReturnType<typeof createAdminClient>
    );
    const result = await createIncidentRecord({ status: "idle" }, baseFormData({ bookingReference: "CDX-9999-99999" }));
    expect(result).toEqual({ status: "error", error: "Booking reference not found." });
  });

  it("creates an unlinked incident (no booking reference) with a null booking_id", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    let insertedPayload: unknown;
    const base = makeIncidentSupabase();
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder = base.from(table) as Record<string, unknown>;
          const originalInsert = builder.insert as (p: unknown) => unknown;
          builder.insert = (payload: unknown) => {
            insertedPayload = payload;
            return originalInsert(payload);
          };
          return builder;
        }
        return base.from(table);
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord({ status: "idle" }, baseFormData({ bookingReference: "" }));
    expect(result).toEqual({ status: "success" });
    expect((insertedPayload as { booking_id: string | null }).booking_id).toBeNull();
  });

  it("does not create an availability block when the checkbox is unchecked", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(makeIncidentSupabase() as unknown as ReturnType<typeof createAdminClient>);

    await createIncidentRecord({ status: "idle" }, baseFormData());
    expect(vi.mocked(insertVehicleBlock)).not.toHaveBeenCalled();
  });

  it("creates an availability block of type 'incident' when explicitly requested", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(insertVehicleBlock).mockResolvedValue({ ok: true, blockId: "block-1" });
    vi.mocked(createAdminClient).mockReturnValue(makeIncidentSupabase() as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord(
      { status: "idle" },
      baseFormData({
        createAvailabilityBlock: "true",
        blockStartAt: "2026-03-10T09:00",
        blockEndAt: "2026-03-15T09:00",
      })
    );

    expect(result).toEqual({ status: "success" });
    expect(vi.mocked(insertVehicleBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: VEHICLE_ID, type: "incident" })
    );
  });

  it("selecting vehicleOperationalStatus = 'not_operational' does NOT by itself create a block", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(makeIncidentSupabase() as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord(
      { status: "idle" },
      baseFormData({ vehicleOperationalStatus: "not_operational" })
    );

    expect(result).toEqual({ status: "success" });
    expect(vi.mocked(insertVehicleBlock)).not.toHaveBeenCalled();
  });

  it("rejects the whole submission (no record saved) when the block checkbox is checked but times are missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const fakeFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from: fakeFrom } as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord(
      { status: "idle" },
      baseFormData({ createAvailabilityBlock: "true", blockStartAt: "", blockEndAt: "" })
    );

    expect(result).toEqual({
      status: "error",
      error: "Please provide both a start and end time for the availability block.",
    });
    expect(fakeFrom).not.toHaveBeenCalled(); // fails before any DB write, not a silent skip
    expect(vi.mocked(insertVehicleBlock)).not.toHaveBeenCalled();
  });

  it("rejects the submission when the block end time is not after the start time", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const fakeFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from: fakeFrom } as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord(
      { status: "idle" },
      baseFormData({ createAvailabilityBlock: "true", blockStartAt: "2026-03-15T09:00", blockEndAt: "2026-03-10T09:00" })
    );

    expect(result).toEqual({ status: "error", error: "The availability block end time must be after the start time." });
    expect(fakeFrom).not.toHaveBeenCalled();
  });

  it("does not save the incident record when block creation itself fails (e.g. an overlapping block)", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(insertVehicleBlock).mockResolvedValue({ ok: false, error: "This vehicle already has an overlapping block or booking." });
    let recordInserted = false;
    const base = makeIncidentSupabase();
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder = base.from(table) as Record<string, unknown>;
          const originalInsert = builder.insert as (p: unknown) => unknown;
          builder.insert = (payload: unknown) => {
            recordInserted = true;
            return originalInsert(payload);
          };
          return builder;
        }
        return base.from(table);
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createIncidentRecord(
      { status: "idle" },
      baseFormData({ createAvailabilityBlock: "true", blockStartAt: "2026-03-10T09:00", blockEndAt: "2026-03-15T09:00" })
    );

    expect(result).toEqual({ status: "error", error: "This vehicle already has an overlapping block or booking." });
    expect(recordInserted).toBe(false);
  });

  it("does not create a record for an invalid (negative) cost", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const fakeFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from: fakeFrom } as unknown as ReturnType<typeof createAdminClient>);
    const result = await createIncidentRecord({ status: "idle" }, baseFormData({ estimatedRepairCostMur: "-100" }));
    expect(result).toEqual({ status: "error", error: "Please check the form for errors." });
    expect(fakeFrom).not.toHaveBeenCalled();
  });
});

describe("updateIncidentRecord — status transitions", () => {
  it("logs a distinct audit entry when repair_status changes", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const auditInserts: unknown[] = [];
    const base = makeIncidentSupabase({ existingRepairStatus: "reported" });
    const supabase = {
      from: (table: string) => {
        if (table === "audit_logs") {
          return { insert: (payload: unknown) => Promise.resolve((auditInserts.push(payload), { data: null, error: null })) };
        }
        return base.from(table);
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await updateIncidentRecord(RECORD_ID, { status: "idle" }, baseFormData({ repairStatus: "under_repair" }));

    expect(result).toEqual({ status: "success" });
    const statusChangeEntry = auditInserts.find((a) => (a as { action: string }).action === "incident_status_changed");
    expect(statusChangeEntry).toBeDefined();
    expect((statusChangeEntry as { diff: { from: string; to: string } }).diff).toEqual({ from: "reported", to: "under_repair" });
  });

  it("does not log a status-change entry when repair_status is unchanged", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const auditInserts: unknown[] = [];
    const base = makeIncidentSupabase({ existingRepairStatus: "reported" });
    const supabase = {
      from: (table: string) => {
        if (table === "audit_logs") {
          return { insert: (payload: unknown) => Promise.resolve((auditInserts.push(payload), { data: null, error: null })) };
        }
        return base.from(table);
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await updateIncidentRecord(RECORD_ID, { status: "idle" }, baseFormData({ repairStatus: "reported" }));

    expect(auditInserts.some((a) => (a as { action: string }).action === "incident_status_changed")).toBe(false);
  });

  it("rejects with permission denied when manage_incidents is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(updateIncidentRecord(RECORD_ID, { status: "idle" }, baseFormData())).rejects.toThrow(
      /Missing required permission: manage_incidents/
    );
  });
});

describe("deleteIncidentRecord", () => {
  it("deletes a record when the user has manage_incidents", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(makeIncidentSupabase() as unknown as ReturnType<typeof createAdminClient>);
    const result = await deleteIncidentRecord(RECORD_ID);
    expect(result).toEqual({ ok: true });
  });

  it("rejects with permission denied when manage_incidents is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(deleteIncidentRecord(RECORD_ID)).rejects.toThrow(/Missing required permission: manage_incidents/);
  });
});

describe("closeIncidentAvailabilityBlock", () => {
  it("closes the linked block and clears availability_block_id on the incident", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(closeBlockEarly).mockResolvedValue({ ok: true });
    let updatedPayload: unknown;
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { availability_block_id: "block-1" }, error: null }),
            update: (payload: unknown) => {
              updatedPayload = payload;
              return { eq: async () => ({ data: null, error: null }) };
            },
          };
          return builder;
        }
        return makeQueryBuilder({ data: null, error: null });
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await closeIncidentAvailabilityBlock(RECORD_ID);
    expect(result).toEqual({ ok: true });
    expect(vi.mocked(closeBlockEarly)).toHaveBeenCalledWith("block-1");
    expect(updatedPayload).toEqual({ availability_block_id: null });
  });

  it("returns an error when the incident has no active block", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const supabase = {
      from: () => makeQueryBuilder({ data: { availability_block_id: null }, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await closeIncidentAvailabilityBlock(RECORD_ID);
    expect(result).toEqual({ ok: false, error: "No active block on this incident." });
    expect(vi.mocked(closeBlockEarly)).not.toHaveBeenCalled();
  });
});

describe("uploadIncidentAttachment — validation", () => {
  const validSupabase = () => ({
    from: (table: string) => {
      if (table === "vehicle_incident_records") return makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
      if (table === "vehicle_incident_attachments") return makeQueryBuilder({ data: null, error: null });
      return makeQueryBuilder({ data: null, error: null });
    },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  });

  it("rejects a missing category", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(validSupabase() as unknown as ReturnType<typeof createAdminClient>);
    const fd = new FormData();
    fd.set("document", new File(["x"], "photo.jpg", { type: "image/jpeg" }));
    const result = await uploadIncidentAttachment(RECORD_ID, fd);
    expect(result).toEqual({ ok: false, error: "Please select a document category." });
  });

  it("rejects a disallowed MIME type", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(validSupabase() as unknown as ReturnType<typeof createAdminClient>);
    const fd = new FormData();
    fd.set("category", "photo");
    fd.set("document", new File(["x"], "malware.exe", { type: "application/x-msdownload" }));
    const result = await uploadIncidentAttachment(RECORD_ID, fd);
    expect(result).toEqual({ ok: false, error: "File must be a PDF, JPEG, PNG, or WebP." });
  });

  it("rejects a file over the size limit", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(validSupabase() as unknown as ReturnType<typeof createAdminClient>);
    const fd = new FormData();
    fd.set("category", "photo");
    const oversized = new File([new Uint8Array(16 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    fd.set("document", oversized);
    const result = await uploadIncidentAttachment(RECORD_ID, fd);
    expect(result).toEqual({ ok: false, error: "File must be under 15 MB." });
  });

  it("accepts a valid PDF for the police_report category", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(validSupabase() as unknown as ReturnType<typeof createAdminClient>);
    const fd = new FormData();
    fd.set("category", "police_report");
    fd.set("document", new File(["contents"], "report.pdf", { type: "application/pdf" }));
    const result = await uploadIncidentAttachment(RECORD_ID, fd);
    expect(result).toEqual({ ok: true });
  });
});

describe("deleteIncidentAttachment", () => {
  it("deletes the storage object and the DB row when storage removal succeeds", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const removedPaths: string[][] = [];
    let dbDeleteCalled = false;
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_attachments") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { storage_path: "abc/file.pdf", incident_id: RECORD_ID }, error: null }) }),
            }),
            delete: () => ({
              eq: async () => {
                dbDeleteCalled = true;
                return { data: null, error: null };
              },
            }),
          };
        }
        return makeQueryBuilder({ data: null, error: null });
      },
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removedPaths.push(paths);
            return { error: null };
          },
        }),
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteIncidentAttachment("attachment-1");
    expect(result).toEqual({ ok: true });
    expect(removedPaths).toEqual([["abc/file.pdf"]]);
    expect(dbDeleteCalled).toBe(true);
  });

  it("aborts (leaves the DB row) when storage removal fails, to avoid an untracked orphan", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    let dbDeleteCalled = false;
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_attachments") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { storage_path: "abc/file.pdf", incident_id: RECORD_ID }, error: null }) }),
            }),
            delete: () => ({
              eq: async () => {
                dbDeleteCalled = true;
                return { data: null, error: null };
              },
            }),
          };
        }
        return makeQueryBuilder({ data: null, error: null });
      },
      storage: {
        from: () => ({
          remove: async () => ({ error: { message: "network error" } }),
        }),
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteIncidentAttachment("attachment-1");
    expect(result.ok).toBe(false);
    expect(dbDeleteCalled).toBe(false); // the row is left in place, not silently dropped
  });

  it("rejects with permission denied when manage_incidents is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(deleteIncidentAttachment("attachment-1")).rejects.toThrow(/Missing required permission: manage_incidents/);
  });
});

describe("getIncidentDashboardStats — aggregation", () => {
  it("derives openCases/vehiclesUnderRepair/majorIncidents from the open-rows set, and cost from the date-scoped query", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);

    const openRows = [
      { id: "i1", vehicle_id: "v1", incident_date: "2026-03-01", incident_type: "collision", custom_type: null, severity: "major", repair_status: "under_repair", estimated_repair_cost_cents: 50000, actual_repair_cost_cents: null, vehicles: { name: "Car A" } },
      { id: "i2", vehicle_id: "v2", incident_date: "2026-03-02", incident_type: "windscreen", custom_type: null, severity: "minor", repair_status: "reported", estimated_repair_cost_cents: 10000, actual_repair_cost_cents: null, vehicles: { name: "Car B" } },
      { id: "i3", vehicle_id: "v1", incident_date: "2026-03-03", incident_type: "vandalism", custom_type: null, severity: "write_off", repair_status: "under_repair", estimated_repair_cost_cents: null, actual_repair_cost_cents: null, vehicles: { name: "Car A" } },
    ];
    const repairedThisMonth = [
      { actual_repair_cost_cents: 30000, estimated_repair_cost_cents: null },
      { actual_repair_cost_cents: null, estimated_repair_cost_cents: 15000 },
    ];

    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            in: () => ({ order: () => Promise.resolve({ data: openRows, error: null }) }),
            gte: () => builder,
            lt: () => Promise.resolve({ data: repairedThisMonth, error: null }),
          };
          return builder;
        }
        return makeQueryBuilder({ data: null, error: null });
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const stats = await getIncidentDashboardStats();

    expect(stats.openCases).toBe(3);
    expect(stats.vehiclesUnderRepair).toBe(1); // v1 has 2 under_repair rows but counts once
    expect(stats.majorIncidents).toBe(2); // major + write_off
    expect(stats.repairCostThisMonthCents).toBe(45000); // 30000 + 15000
  });

  it("rejects with permission denied when view_incidents is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue({ ...FULL_USER, permissions: new Set() });
    await expect(getIncidentDashboardStats()).rejects.toThrow(/Missing required permission: view_incidents/);
  });
});

/**
 * An admin deleting an incident must never leave the vehicle silently held
 * out of service. The incident owns the only reference to its block, so the
 * downtime has to be released before the record goes.
 */
describe("deleteIncidentRecord — downtime must never be orphaned", () => {
  function supabaseWithBlock(blockId: string | null) {
    const deleted: string[] = [];
    const audits: unknown[] = [];
    const client = {
      from: (table: string) => {
        if (table === "vehicle_incident_records") {
          const builder: Record<string, unknown> = {
            select: () => builder,
            eq: (_c: string, id: string) => {
              builder._id = id;
              return builder;
            },
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

  it("deletes normally when the incident has no block, without touching any block", async () => {
    const { client, deleted } = supabaseWithBlock(null);
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteIncidentRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([RECORD_ID]);
    expect(releaseVehicleBlock).not.toHaveBeenCalled();
  });

  it("removes a future block and only then deletes the incident", async () => {
    const { client, deleted, audits } = supabaseWithBlock("block-future");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "removed" });

    const result = await deleteIncidentRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(releaseVehicleBlock).toHaveBeenCalledWith(expect.anything(), "block-future");
    expect(deleted).toEqual([RECORD_ID]);
    expect(audits[0]).toMatchObject({
      action: "incident_record_deleted",
      diff: { availability_block: "removed" },
    });
  });

  it("shortens an already-started block, preserving the downtime actually served", async () => {
    const { client, deleted, audits } = supabaseWithBlock("block-started");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "shortened" });

    const result = await deleteIncidentRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([RECORD_ID]);
    expect(audits[0]).toMatchObject({ diff: { availability_block: "shortened" } });
  });

  // Fail-closed: a half-done cleanup that removes the record but keeps the
  // block is the exact failure this whole change exists to prevent.
  it("keeps the incident when the block cannot be released", async () => {
    const { client, deleted } = supabaseWithBlock("block-stuck");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({
      ok: false,
      error: "Failed to close the vehicle's downtime.",
    });

    const result = await deleteIncidentRecord(RECORD_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/was not deleted/);
    expect(deleted).toEqual([]);
  });

  it("never touches a block belonging to a different record", async () => {
    const { client } = supabaseWithBlock("block-mine");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "removed" });

    await deleteIncidentRecord(RECORD_ID);

    expect(releaseVehicleBlock).toHaveBeenCalledTimes(1);
    expect(releaseVehicleBlock).toHaveBeenCalledWith(expect.anything(), "block-mine");
  });

  it("succeeds when the block was already gone, leaving nothing orphaned", async () => {
    const { client, deleted } = supabaseWithBlock("block-vanished");
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(releaseVehicleBlock).mockResolvedValue({ ok: true, outcome: "already_gone" });

    const result = await deleteIncidentRecord(RECORD_ID);

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([RECORD_ID]);
  });
});
