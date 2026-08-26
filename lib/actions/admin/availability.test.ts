import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/get-current-admin-user", () => ({
  requireAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { closeBlockEarly } from "./availability";

/**
 * The Availability screen must not be able to destroy downtime a vehicle
 * genuinely underwent.
 *
 * `releaseVehicleBlock` is deliberately NOT mocked here. Asserting that a
 * mock was called would only prove the wiring; these tests run the real
 * primitive against a fake Supabase so they prove the actual outcome — that a
 * started block is shortened and never deleted.
 */

const BLOCK_ID = "33333333-3333-4333-8333-333333333333";

const MANAGER = {
  id: "user-1",
  email: "fleet@codexia.mu",
  fullName: "Fleet Manager",
  roles: ["fleet_manager"],
  permissions: new Set(["manage_vehicles"]),
};
/** Authenticated, but holds no vehicle permission at all. */
const VIEWER = { ...MANAGER, id: "user-2", permissions: new Set(["view_maintenance"]) };

type Write = { op: "delete" | "update"; id?: string; payload?: Record<string, unknown> };

function makeSupabase(opts: { period?: string | null; readError?: { message: string } | null; writeError?: { message: string } | null }) {
  const writes: Write[] = [];

  const from = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () =>
          opts.readError
            ? { data: null, error: opts.readError }
            : { data: opts.period === null ? null : { period: opts.period }, error: null },
      }),
    }),
    delete: () => ({
      eq: async (_col: string, id: string) => {
        writes.push({ op: "delete", id });
        return { error: opts.writeError ?? null };
      },
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: async (_col: string, id: string) => {
        writes.push({ op: "update", id, payload });
        return { error: opts.writeError ?? null };
      },
    }),
  });

  return { client: { from } as unknown as ReturnType<typeof createAdminClient>, writes };
}

const period = (startIso: string, endIso: string) => `["${startIso}","${endIso}")`;

beforeEach(() => {
  vi.mocked(requireAdminUser).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(requireAdminUser).mockResolvedValue(MANAGER as never);
});

describe("Availability release cannot destroy historical downtime", () => {
  it("shortens a block that has already started instead of deleting it", async () => {
    const { client, writes } = makeSupabase({
      period: period("2020-01-01 06:00:00+00", "2099-01-01 06:00:00+00"),
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("shortened");
    // The load-bearing assertion of this whole fix.
    expect(writes.some((w) => w.op === "delete")).toBe(false);
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
  });

  it("keeps the original start time when it shortens", async () => {
    const start = "2020-01-01 06:00:00+00";
    const { client, writes } = makeSupabase({ period: period(start, "2099-01-01 06:00:00+00") });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await closeBlockEarly(BLOCK_ID);

    // The period the vehicle really was off the road has to survive intact.
    expect(String(writes[0].payload?.period)).toContain(start);
  });

  it("removes a block that has not started yet", async () => {
    const { client, writes } = makeSupabase({
      period: period("2099-01-01 06:00:00+00", "2099-01-02 06:00:00+00"),
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("removed");
    expect(writes).toEqual([{ op: "delete", id: BLOCK_ID }]);
  });

  it("reports a block that is already gone rather than claiming success", async () => {
    const { client, writes } = makeSupabase({ period: null });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no longer exists/i);
    expect(writes).toHaveLength(0);
  });

  it("fails closed and writes nothing when the block cannot be read", async () => {
    const { client, writes } = makeSupabase({ readError: { message: "connection reset" } });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("connection reset");
    expect(writes).toHaveLength(0);
  });

  it("fails closed when the shorten write itself fails", async () => {
    const { client } = makeSupabase({
      period: period("2020-01-01 06:00:00+00", "2099-01-01 06:00:00+00"),
      writeError: { message: "deadlock detected" },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/close the vehicle's downtime/i);
  });

  it("fails closed on an unreadable period rather than guessing", async () => {
    const { client, writes } = makeSupabase({ period: "not-a-range" });
    vi.mocked(createAdminClient).mockReturnValue(client);

    const result = await closeBlockEarly(BLOCK_ID);

    expect(result.ok).toBe(false);
    expect(writes).toHaveLength(0);
  });
});

describe("Availability release authorization", () => {
  it("refuses an anonymous caller", async () => {
    vi.mocked(requireAdminUser).mockRejectedValue(new Error("Not authenticated"));
    await expect(closeBlockEarly(BLOCK_ID)).rejects.toThrow(/not authenticated/i);
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
  });

  it("refuses an authenticated user without manage_vehicles", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(VIEWER as never);
    await expect(closeBlockEarly(BLOCK_ID)).rejects.toThrow(/manage_vehicles/);
    // Authorization has to happen before any database work, not after.
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
  });

  it("allows a user holding manage_vehicles", async () => {
    const { client } = makeSupabase({ period: period("2099-01-01 06:00:00+00", "2099-01-02 06:00:00+00") });
    vi.mocked(createAdminClient).mockReturnValue(client);
    await expect(closeBlockEarly(BLOCK_ID)).resolves.toEqual({ ok: true, outcome: "removed" });
  });
});
