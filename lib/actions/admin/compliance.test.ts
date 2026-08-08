import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth/get-current-admin-user", () => ({
  requireAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn(),
}));
vi.mock("@/lib/config/get-site-settings", () => ({
  getSiteSettings: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createNotification } from "@/lib/notifications/create";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { sendEmail } from "@/lib/email/send";
import {
  createComplianceRecord,
  updateComplianceRecord,
  deleteComplianceRecord,
  uploadComplianceAttachment,
  runComplianceAlertCheck,
} from "./compliance";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";
const OLD_RECORD_ID = "33333333-3333-4333-8333-333333333333";

function expiryDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const FULL_USER = {
  id: "user-1",
  email: "admin@codexia.mu",
  fullName: "Test Admin",
  roles: ["super_admin"],
  permissions: new Set(["view_compliance", "manage_compliance"]),
};

const VIEW_ONLY_USER = { ...FULL_USER, permissions: new Set(["view_compliance"]) };

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    in: () => builder,
    is: () => builder,
    order: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

// A fake specifically shaped for the create/update/delete compliance-record
// actions, which hit `vehicle_compliance_records` three different ways in a
// single call (a head-count "is this a renewal" check, the actual
// insert/update, and the resolution step's plain history-id select) — a
// single static per-table response (as used for the maintenance module's
// simpler actions) can't represent all three at once.
function makeComplianceSupabase(opts: { insertedId?: string; historyRecordIds?: string[] } = {}) {
  const insertedId = opts.insertedId ?? RECORD_ID;
  const historyRecordIds = opts.historyRecordIds ?? [RECORD_ID];
  const calls = {
    inserts: [] as unknown[],
    deletes: 0,
    notificationUpdatePayload: undefined as unknown,
    notificationLinks: undefined as unknown,
  };

  const supabase = {
    from: (table: string) => {
      if (table === "vehicles") {
        return makeQueryBuilder({ data: { id: VEHICLE_ID }, error: null });
      }
      if (table === "vehicle_compliance_records") {
        return {
          select: (_cols: string, selOpts?: { head?: boolean }) => {
            if (selOpts?.head) {
              return { eq: () => ({ eq: () => Promise.resolve({ count: historyRecordIds.length, data: null, error: null }) }) };
            }
            return { eq: () => ({ eq: () => Promise.resolve({ data: historyRecordIds.map((id) => ({ id })), error: null }) }) };
          },
          insert: (payload: unknown) => {
            calls.inserts.push(payload);
            return { select: () => ({ single: async () => ({ data: { id: insertedId }, error: null }) }) };
          },
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
          delete: () => {
            calls.deletes++;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      }
      if (table === "notifications") {
        return {
          update: (payload: unknown) => {
            calls.notificationUpdatePayload = payload;
            return {
              in: (_col: string, links: unknown) => {
                calls.notificationLinks = links;
                return { is: () => Promise.resolve({ data: null, error: null }) };
              },
              eq: () => ({ is: () => Promise.resolve({ data: null, error: null }) }),
            };
          },
        };
      }
      return makeQueryBuilder({ data: null, error: null });
    },
  };

  return { supabase, calls };
}

function validFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    vehicleId: VEHICLE_ID,
    documentType: "insurance",
    customType: "",
    referenceNumber: "POL-1",
    provider: "Mauritius Union",
    issuedDate: "2026-01-01",
    expiryDate: "2027-01-01",
    costEur: "450.00",
    remarks: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireAdminUser).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(createNotification).mockReset();
  vi.mocked(getSiteSettings).mockReset();
  vi.mocked(sendEmail).mockReset();
});

describe("createComplianceRecord", () => {
  it("creates a record when the user has manage_compliance and the vehicle exists", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const { supabase } = makeComplianceSupabase({ historyRecordIds: [] });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createComplianceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
  });

  it("rejects with permission denied when manage_compliance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(createComplianceRecord({ status: "idle" }, validFormData())).rejects.toThrow(
      /Missing required permission: manage_compliance/
    );
  });

  it("returns an error when the selected vehicle does not exist", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    vi.mocked(createAdminClient).mockReturnValue(
      { from: () => makeQueryBuilder({ data: null, error: null }) } as unknown as ReturnType<typeof createAdminClient>
    );
    const result = await createComplianceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "error", error: "Selected vehicle does not exist." });
  });

  it("does not create a record for an invalid (negative) cost", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const fakeFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from: fakeFrom } as unknown as ReturnType<typeof createAdminClient>);
    const result = await createComplianceRecord({ status: "idle" }, validFormData({ costEur: "-5" }));
    expect(result).toEqual({ status: "error", error: "Please check the form for errors." });
    expect(fakeFrom).not.toHaveBeenCalled();
  });

  it("preserves history: creating a second (renewal) record does not delete or touch the first", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const { supabase, calls } = makeComplianceSupabase({ historyRecordIds: [OLD_RECORD_ID] });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await createComplianceRecord({ status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
    expect(calls.inserts).toHaveLength(1);
    expect(calls.deletes).toBe(0); // the prior record was never touched, let alone deleted
  });

});

// Fake shaped for the CORRECTED resolution rule: resolveComplianceAlertsIfCurrent
// re-reads the actual current record from vehicle_compliance_current (never
// infers status from "a write happened"), plus the full history-id list for
// this vehicle+type. `currentRecord: null` simulates the view finding
// nothing (shouldn't occur in practice once a record exists, but keeps the
// fake's contract explicit).
function makeResolutionSupabase(opts: {
  currentRecord: { id: string; expiry_date: string } | null;
  historyIds: string[];
  insertedId?: string;
}) {
  const calls: { notificationPayload?: unknown; notificationLinks?: unknown } = {};
  const supabase = {
    from: (table: string) => {
      if (table === "vehicles") return makeQueryBuilder({ data: { id: VEHICLE_ID }, error: null });
      if (table === "vehicle_compliance_current") {
        return makeQueryBuilder({ data: opts.currentRecord, error: null });
      }
      if (table === "vehicle_compliance_records") {
        return {
          select: (_cols: string, selOpts?: { head?: boolean }) => {
            if (selOpts?.head) {
              return { eq: () => ({ eq: () => Promise.resolve({ count: opts.historyIds.length, data: null, error: null }) }) };
            }
            return { eq: () => ({ eq: () => Promise.resolve({ data: opts.historyIds.map((id) => ({ id })), error: null }) }) };
          },
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: opts.insertedId ?? RECORD_ID }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
      if (table === "notifications") {
        return {
          update: (payload: unknown) => {
            calls.notificationPayload = payload;
            return {
              in: (_c: string, links: unknown) => {
                calls.notificationLinks = links;
                return { is: () => Promise.resolve({ data: null, error: null }) };
              },
            };
          },
        };
      }
      return makeQueryBuilder({ data: null, error: null });
    },
  };
  return { supabase, calls };
}

describe("resolveComplianceAlertsIfCurrent — corrected resolution rule", () => {
  beforeEach(() => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
  });

  it("editing remarks only leaves the alert active (still within 30 days)", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(5) },
      historyIds: [RECORD_ID],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await updateComplianceRecord(RECORD_ID, { status: "idle" }, validFormData({ remarks: "Renewal in progress" }));

    expect(calls.notificationLinks).toBeUndefined();
  });

  it("editing provider/reference number only leaves the alert active", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(5) },
      historyIds: [RECORD_ID],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await updateComplianceRecord(
      RECORD_ID,
      { status: "idle" },
      validFormData({ provider: "New Insurer Ltd", referenceNumber: "POL-9999" })
    );

    expect(calls.notificationLinks).toBeUndefined();
  });

  it("uploading an attachment does not touch notifications at all", async () => {
    const notificationsFrom = vi.fn();
    const supabase = {
      from: (table: string) => {
        if (table === "vehicle_compliance_records") return makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
        if (table === "vehicle_compliance_attachments") return makeQueryBuilder({ data: null, error: null });
        if (table === "notifications") {
          notificationsFrom();
          return makeQueryBuilder({ data: null, error: null });
        }
        return makeQueryBuilder({ data: null, error: null });
      },
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    };
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const fd = new FormData();
    fd.set("document", new File(["policy contents"], "policy.pdf", { type: "application/pdf" }));
    const result = await uploadComplianceAttachment(RECORD_ID, fd);

    expect(result.ok).toBe(true);
    expect(notificationsFrom).not.toHaveBeenCalled();
  });

  it("expiry changed from 5 days to 20 days away leaves the alert active (still within 30)", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(20) },
      historyIds: [RECORD_ID],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await updateComplianceRecord(RECORD_ID, { status: "idle" }, validFormData({ expiryDate: expiryDaysFromNow(20) }));

    expect(calls.notificationLinks).toBeUndefined();
  });

  it("resolves the alert when an in-place edit moves expiry to 31+ days away", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(35) },
      historyIds: [RECORD_ID],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await updateComplianceRecord(RECORD_ID, { status: "idle" }, validFormData({ expiryDate: expiryDaysFromNow(35) }));

    expect(calls.notificationLinks).toEqual([`/admin/compliance/${RECORD_ID}`]);
  });

  it("resolves immediately when an expired document is renewed to more than 30 days out", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(35) },
      historyIds: [OLD_RECORD_ID, RECORD_ID],
      insertedId: RECORD_ID,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await createComplianceRecord({ status: "idle" }, validFormData({ expiryDate: expiryDaysFromNow(35) }));

    expect(calls.notificationLinks).toEqual([`/admin/compliance/${OLD_RECORD_ID}`, `/admin/compliance/${RECORD_ID}`]);
  });

  it("archives only the superseded record's link when renewed to another expiry within 30 days — never appears compliant", async () => {
    const { supabase, calls } = makeResolutionSupabase({
      currentRecord: { id: RECORD_ID, expiry_date: expiryDaysFromNow(20) },
      historyIds: [OLD_RECORD_ID, RECORD_ID],
      insertedId: RECORD_ID,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    await createComplianceRecord({ status: "idle" }, validFormData({ expiryDate: expiryDaysFromNow(20) }));

    // Only the OLD (superseded) record's stale link is archived. The new
    // current record's own link is left alone (it isn't valid — still 20
    // days out — so no notification is falsely cleared).
    expect(calls.notificationLinks).toEqual([`/admin/compliance/${OLD_RECORD_ID}`]);
  });
});

describe("updateComplianceRecord", () => {
  it("updates a record when the user has manage_compliance and the vehicle exists", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const { supabase } = makeComplianceSupabase({ historyRecordIds: [RECORD_ID] });
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await updateComplianceRecord(RECORD_ID, { status: "idle" }, validFormData());
    expect(result).toEqual({ status: "success" });
  });

  it("rejects with permission denied when manage_compliance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(updateComplianceRecord(RECORD_ID, { status: "idle" }, validFormData())).rejects.toThrow(
      /Missing required permission: manage_compliance/
    );
  });
});

describe("deleteComplianceRecord", () => {
  it("deletes a record when the user has manage_compliance", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(FULL_USER);
    const { supabase } = makeComplianceSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteComplianceRecord(RECORD_ID);
    expect(result).toEqual({ ok: true });
  });

  it("rejects with permission denied when manage_compliance is missing", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEW_ONLY_USER);
    await expect(deleteComplianceRecord(RECORD_ID)).rejects.toThrow(/Missing required permission: manage_compliance/);
  });
});

describe("runComplianceAlertCheck — daily-alert idempotency", () => {
  function makeCronSupabase(currentRows: unknown[], alreadyAlertedIds: Set<string>, inserted: unknown[]) {
    return {
      from: (table: string) => {
        if (table === "vehicle_compliance_current") {
          return { select: () => ({ lte: () => ({ order: () => Promise.resolve({ data: currentRows, error: null }) }) }) };
        }
        if (table === "vehicle_compliance_alert_logs") {
          return {
            insert: (payload: { compliance_record_id: string }) => {
              if (alreadyAlertedIds.has(payload.compliance_record_id)) {
                return Promise.resolve({ data: null, error: { message: "duplicate key value violates unique constraint" } });
              }
              alreadyAlertedIds.add(payload.compliance_record_id);
              inserted.push(payload);
              return Promise.resolve({ data: payload, error: null });
            },
          };
        }
        return makeQueryBuilder({ data: null, error: null });
      },
    };
  }

  const EXPIRED_ROW = {
    id: RECORD_ID,
    vehicle_id: VEHICLE_ID,
    document_type: "insurance",
    custom_type: null,
    expiry_date: "2020-01-01", // long expired relative to any "today"
    vehicles: { name: "Suzuki Dzire" },
  };
  const VALID_ROW = {
    id: OLD_RECORD_ID,
    vehicle_id: VEHICLE_ID,
    document_type: "road_tax",
    custom_type: null,
    expiry_date: "2099-01-01", // far future — never alarming
    vehicles: { name: "Suzuki Dzire" },
  };

  it("creates exactly one notification per alarming record, and skips non-alarming ones, on the first run", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({ email: "ops@codexia.mu" } as unknown as Awaited<ReturnType<typeof getSiteSettings>>);
    const alreadyAlerted = new Set<string>();
    const inserted: unknown[] = [];
    vi.mocked(createAdminClient).mockReturnValue(
      makeCronSupabase([EXPIRED_ROW, VALID_ROW], alreadyAlerted, inserted) as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await runComplianceAlertCheck();

    expect(result.newAlerts).toBe(1);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNotification)).toHaveBeenCalledWith(
      "compliance_expiry",
      expect.objectContaining({ vehicleName: "Suzuki Dzire", documentType: "insurance" }),
      `/admin/compliance/${RECORD_ID}`
    );
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
  });

  it("does not create a second notification or email if the cron runs again the same day", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({ email: "ops@codexia.mu" } as unknown as Awaited<ReturnType<typeof getSiteSettings>>);
    const alreadyAlerted = new Set<string>();
    const inserted: unknown[] = [];
    const supabase = makeCronSupabase([EXPIRED_ROW], alreadyAlerted, inserted);
    vi.mocked(createAdminClient).mockReturnValue(supabase as unknown as ReturnType<typeof createAdminClient>);

    const first = await runComplianceAlertCheck();
    const second = await runComplianceAlertCheck();

    expect(first.newAlerts).toBe(1);
    expect(second.newAlerts).toBe(0);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1); // not 2
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1); // not 2 — the digest email reuses the same insert-first dedup
    expect(inserted).toHaveLength(1);
  });

  it("skips the email entirely when no document is newly alarming (nothing to report)", async () => {
    const inserted: unknown[] = [];
    vi.mocked(createAdminClient).mockReturnValue(
      makeCronSupabase([VALID_ROW], new Set(), inserted) as unknown as ReturnType<typeof createAdminClient>
    );
    const result = await runComplianceAlertCheck();
    expect(result.newAlerts).toBe(0);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(getSiteSettings)).not.toHaveBeenCalled();
  });

  it("upserts a single persistent notification across multiple days rather than creating duplicates", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({ email: "ops@codexia.mu" } as unknown as Awaited<ReturnType<typeof getSiteSettings>>);

    // createNotification is fully mocked at module level, so a real insert
    // never reaches the fake supabase — this test needs it to actually
    // write into a store so the SECOND day's "does a notification already
    // exist for this link" lookup can find it and take the update path.
    const notificationsStore = new Map<string, { id: string; archived_at: string | null }>();
    let nextNotifId = 1;
    vi.mocked(createNotification).mockImplementation(async (_type, _payload, link) => {
      notificationsStore.set(link!, { id: `notif-${nextNotifId++}`, archived_at: null });
    });

    function makeDaySupabase(alertLogsAlreadyToday: Set<string>) {
      return {
        from: (table: string) => {
          if (table === "vehicle_compliance_current") {
            return { select: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [EXPIRED_ROW], error: null }) }) }) };
          }
          if (table === "vehicle_compliance_alert_logs") {
            return {
              insert: (payload: { compliance_record_id: string }) => {
                if (alertLogsAlreadyToday.has(payload.compliance_record_id)) {
                  return Promise.resolve({ data: null, error: { message: "duplicate key value violates unique constraint" } });
                }
                alertLogsAlreadyToday.add(payload.compliance_record_id);
                return Promise.resolve({ data: payload, error: null });
              },
            };
          }
          if (table === "notifications") {
            return {
              select: () => ({
                eq: (_c: string, link: string) => ({
                  is: () => ({
                    maybeSingle: async () => {
                      const existing = notificationsStore.get(link);
                      return { data: existing && !existing.archived_at ? { id: existing.id } : null, error: null };
                    },
                  }),
                }),
              }),
              update: () => ({
                eq: async () => ({ data: null, error: null }),
              }),
            };
          }
          return makeQueryBuilder({ data: null, error: null });
        },
      };
    }

    // Day 1: nothing alerted yet today, no existing notification -> insert path.
    vi.mocked(createAdminClient).mockReturnValue(makeDaySupabase(new Set()) as unknown as ReturnType<typeof createAdminClient>);
    await runComplianceAlertCheck();
    expect(notificationsStore.size).toBe(1);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1);

    // Day 2: a fresh alert_logs "today" set (a new calendar day), but the
    // SAME notificationsStore persists — the existing row should be found
    // and updated, not duplicated.
    vi.mocked(createAdminClient).mockReturnValue(makeDaySupabase(new Set()) as unknown as ReturnType<typeof createAdminClient>);
    await runComplianceAlertCheck();

    expect(notificationsStore.size).toBe(1); // still exactly one row
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1); // not called again on day 2
  });
});
