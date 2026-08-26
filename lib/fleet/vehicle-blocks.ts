import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one place that decides what "release this vehicle block" means.
 *
 * Two callers need it for different reasons — an operator explicitly
 * returning a car to service, and a maintenance/incident record being
 * deleted while it still holds downtime — and they must not drift apart.
 * It deliberately lives outside the "use server" action modules: an export
 * from one of those becomes a remotely callable server action, and this
 * helper performs no permission check of its own. Callers authenticate and
 * authorise first, then call this.
 *
 * The rule, unchanged from the behaviour established for incidents:
 *
 *   - a block that has not started yet is REMOVED. There is no downtime to
 *     preserve, and it cannot be shortened to end before it begins.
 *   - a block already under way is SHORTENED to end now. The vehicle really
 *     was off the road for that period and the history must survive; this is
 *     why the FK is on-delete-set-null and not a blind cascade.
 */

export type BlockReleaseOutcome = "removed" | "shortened" | "already_gone";

export type BlockReleaseResult =
  | { ok: true; outcome: BlockReleaseOutcome }
  | { ok: false; error: string };

/** Postgres range literal: ["2026-09-15 06:00:00+00","2026-09-16 06:00:00+00") */
const RANGE_PATTERN = /\[([^,]+),([^)]+)\)/;

export async function releaseVehicleBlock(
  supabase: ReturnType<typeof createAdminClient>,
  blockId: string,
  now: Date = new Date()
): Promise<BlockReleaseResult> {
  const { data: block, error: readError } = await supabase
    .from("vehicle_blocks")
    .select("period")
    .eq("id", blockId)
    .maybeSingle();

  if (readError) {
    console.error("releaseVehicleBlock read failed", readError.message);
    return { ok: false, error: "Could not read the vehicle's downtime." };
  }

  // Already deleted by another operator. Nothing is left holding the vehicle,
  // so a caller trying to guarantee "no orphan" has got what it needed.
  if (!block) return { ok: true, outcome: "already_gone" };

  const rawPeriod = block.period as unknown as string;
  const start = RANGE_PATTERN.exec(rawPeriod)?.[1]?.trim().replace(/^"|"$/g, "");
  if (!start) return { ok: false, error: "Could not read the block's start time." };

  const startedAt = new Date(start);
  if (Number.isNaN(startedAt.getTime())) {
    return { ok: false, error: "Could not read the block's start time." };
  }

  if (startedAt >= now) {
    const { error } = await supabase.from("vehicle_blocks").delete().eq("id", blockId);
    if (error) {
      console.error("releaseVehicleBlock delete failed", error.message);
      return { ok: false, error: "Failed to remove the vehicle's downtime." };
    }
    return { ok: true, outcome: "removed" };
  }

  const { error } = await supabase
    .from("vehicle_blocks")
    .update({ period: `[${start},${now.toISOString()})` })
    .eq("id", blockId);

  if (error) {
    console.error("releaseVehicleBlock shorten failed", error.message);
    return { ok: false, error: "Failed to close the vehicle's downtime." };
  }

  return { ok: true, outcome: "shortened" };
}
