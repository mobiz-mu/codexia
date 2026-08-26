import { describe, it, expect } from "vitest";
import { releaseVehicleBlock } from "./vehicle-blocks";
import type { createAdminClient } from "@/lib/supabase/admin";

const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-01T12:00:00.000Z");

/**
 * Records every vehicle_blocks operation so a test can assert not just the
 * outcome but that the RIGHT row was touched and nothing else was.
 */
function makeSupabase(opts: {
  period?: string | null;
  readError?: { message: string } | null;
  deleteError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const calls: { op: string; id?: string; payload?: unknown }[] = [];

  const client = {
    from(table: string) {
      if (table !== "vehicle_blocks") throw new Error(`unexpected table ${table}`);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (_col: string, id: string) => {
          const last = calls[calls.length - 1];
          if (last && last.id === undefined) last.id = id;
          return builder;
        },
        maybeSingle: async () => ({
          data: opts.period === null || opts.period === undefined ? null : { period: opts.period },
          error: opts.readError ?? null,
        }),
        delete: () => {
          calls.push({ op: "delete" });
          return builder;
        },
        update: (payload: unknown) => {
          calls.push({ op: "update", payload });
          return {
            eq: async (_col: string, id: string) => {
              calls[calls.length - 1].id = id;
              return { data: null, error: opts.updateError ?? null };
            },
          };
        },
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: opts.deleteError ?? null }),
      };
      return builder;
    },
  };

  return { client: client as unknown as ReturnType<typeof createAdminClient>, calls };
}

describe("releaseVehicleBlock", () => {
  it("removes a block that has not started yet", async () => {
    const { client, calls } = makeSupabase({
      period: '["2026-09-15 06:00:00+00","2026-09-16 06:00:00+00")',
    });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result).toEqual({ ok: true, outcome: "removed" });
    expect(calls.map((c) => c.op)).toEqual(["delete"]);
    expect(calls[0].id).toBe(BLOCK_ID);
  });

  // The vehicle really was off the road, so the history must survive. This is
  // exactly why a blind ON DELETE CASCADE would be wrong.
  it("shortens a block already under way instead of deleting it", async () => {
    const { client, calls } = makeSupabase({
      period: '["2026-08-20 06:00:00+00","2026-09-20 06:00:00+00")',
    });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result).toEqual({ ok: true, outcome: "shortened" });
    expect(calls.map((c) => c.op)).toEqual(["update"]);
    expect(calls[0].payload).toEqual({
      period: '[2026-08-20 06:00:00+00,2026-09-01T12:00:00.000Z)',
    });
    expect(calls[0].id).toBe(BLOCK_ID);
  });

  it("treats an already-deleted block as nothing left to orphan", async () => {
    const { client, calls } = makeSupabase({ period: null });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result).toEqual({ ok: true, outcome: "already_gone" });
    expect(calls).toEqual([]);
  });

  it("fails closed when the block cannot be read", async () => {
    const { client } = makeSupabase({ period: "x", readError: { message: "boom" } });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result.ok).toBe(false);
  });

  it("fails closed when the delete errors", async () => {
    const { client } = makeSupabase({
      period: '["2026-09-15 06:00:00+00","2026-09-16 06:00:00+00")',
      deleteError: { message: "denied" },
    });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Failed to remove/);
  });

  it("fails closed when the shorten errors", async () => {
    const { client } = makeSupabase({
      period: '["2026-08-20 06:00:00+00","2026-09-20 06:00:00+00")',
      updateError: { message: "denied" },
    });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Failed to close/);
  });

  it("fails closed on an unreadable period rather than guessing", async () => {
    const { client, calls } = makeSupabase({ period: "not-a-range" });
    const result = await releaseVehicleBlock(client, BLOCK_ID, NOW);
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
