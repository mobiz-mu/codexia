import { weekEndingFor, weekStartFor } from "@/lib/inspections/schema";

/**
 * Weekly inspection due status — pure derivation, no database access.
 *
 * Every function here takes data and returns a conclusion, so the rules can be
 * tested exhaustively and the query layer stays a separate concern.
 *
 * WHAT THIS CANNOT KNOW: the fleet has no in-service date. `vehicles.created_at`
 * is when the ROW was created, not when the car entered service — three of the
 * current vehicles share one creation date because they were entered in a
 * batch. Treating it as an in-service date would invent history, so it is used
 * only as a FLOOR: a vehicle cannot be judged overdue for a week that ended
 * before its record existed, because it could not have been inspected in this
 * system then. That is a weaker claim than "it entered service on this date",
 * and it is the strongest claim the data supports.
 */

/**
 * Mauritius is UTC+4 year-round and has had no DST since 2009, so a wall-clock
 * week boundary converts to an instant by a fixed offset. This is the one
 * direction Intl cannot do for us (instant → local is easy, local → instant is
 * not), and the fixed offset is exact for this timezone.
 */
const MAURITIUS_OFFSET = "+04:00";

export type WeekInterval = { weekEnding: string; weekStart: string; startsAt: Date; endsAt: Date };

/** The absolute interval of a Mauritius week: Monday 00:00 up to the next Monday 00:00. */
export function mauritiusWeekInterval(weekEnding: string): WeekInterval {
  const weekStart = weekStartFor(weekEnding);
  const startsAt = new Date(`${weekStart}T00:00:00${MAURITIUS_OFFSET}`);
  // Exclusive end: the instant the following Monday begins.
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { weekEnding, weekStart, startsAt, endsAt };
}

export function weekIntervalContaining(dateIso: string): WeekInterval {
  return mauritiusWeekInterval(weekEndingFor(dateIso));
}

/** Shifts a week ending by whole weeks — negative goes back. */
export function shiftWeekEnding(weekEnding: string, weeks: number): string {
  const at = new Date(`${weekEnding}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + weeks * 7);
  return at.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type EligibilityVehicle = {
  status: string;
  deleted_at?: string | null;
  is_staff_car?: boolean | null;
};

/**
 * Staff cars ARE inspected: is_staff_car governs public rentability, not
 * whether the company drives the car. Draft and archived vehicles are not in
 * service, and a soft-deleted record is not fleet at all.
 */
export function isInspectionEligible(vehicle: EligibilityVehicle): boolean {
  if (vehicle.deleted_at) return false;
  return vehicle.status === "active";
}

// ---------------------------------------------------------------------------
// Off-road coverage
// ---------------------------------------------------------------------------

/**
 * Block types that genuinely mean the vehicle could not operate.
 *
 * `cleaning` and `preparing` are turnaround work between rentals — the car is
 * on the premises and inspectable — so they never exempt. `internal` is
 * excluded too: it is an unspecified internal hold with no guarantee the
 * vehicle was off the road in the sense that matters here.
 */
export const EXEMPTING_BLOCK_TYPES = ["maintenance", "incident", "inspection", "stop_sell"] as const;
export type ExemptingBlockType = (typeof EXEMPTING_BLOCK_TYPES)[number];

export function isExemptingBlockType(type: string): type is ExemptingBlockType {
  return (EXEMPTING_BLOCK_TYPES as readonly string[]).includes(type);
}

export type BlockRange = { type: string; startsAt: Date; endsAt: Date };

/** Parses a Postgres `["…","…")` tstzrange literal into absolute instants. */
export function parseBlockPeriod(period: string): { startsAt: Date; endsAt: Date } | null {
  const match = /\[([^,]+),([^)]+)\)/.exec(period);
  if (!match) return null;
  // Postgres renders the offset as `+00`, which Date cannot parse reliably —
  // it needs `+00:00`. Normalising this is not cosmetic: without it every
  // block parses as Invalid Date and no vehicle would ever read as exempt.
  const clean = (raw: string) =>
    raw
      .trim()
      .replace(/^"|"$/g, "")
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00");
  const startsAt = new Date(clean(match[1]));
  const endsAt = new Date(clean(match[2]));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  return { startsAt, endsAt };
}

/**
 * Merges overlapping AND touching ranges. Touching matters: two consecutive
 * blocks that meet exactly at midnight leave no moment on the road, so they
 * must combine into continuous coverage rather than reading as a gap.
 */
export function mergeRanges(ranges: { startsAt: Date; endsAt: Date }[]): { startsAt: Date; endsAt: Date }[] {
  const sorted = [...ranges]
    .filter((r) => r.endsAt.getTime() > r.startsAt.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const merged: { startsAt: Date; endsAt: Date }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.startsAt.getTime() <= last.endsAt.getTime()) {
      if (range.endsAt.getTime() > last.endsAt.getTime()) last.endsAt = range.endsAt;
    } else {
      merged.push({ startsAt: new Date(range.startsAt), endsAt: new Date(range.endsAt) });
    }
  }
  return merged;
}

/**
 * True when qualifying downtime covers the ENTIRE week with no gap. Several
 * blocks may combine — a maintenance block handing over to an incident block
 * is still a car that never turned a wheel.
 */
export function isExemptForWeek(blocks: BlockRange[], week: WeekInterval): boolean {
  const qualifying = blocks.filter((b) => isExemptingBlockType(b.type));
  if (qualifying.length === 0) return false;

  return mergeRanges(qualifying).some(
    (range) => range.startsAt.getTime() <= week.startsAt.getTime() && range.endsAt.getTime() >= week.endsAt.getTime()
  );
}

/** The distinct qualifying block types covering a week, for honest labelling. */
export function exemptingTypesForWeek(blocks: BlockRange[], week: WeekInterval): ExemptingBlockType[] {
  return [
    ...new Set(
      blocks
        .filter((b) => isExemptingBlockType(b.type))
        .filter((b) => b.endsAt.getTime() > week.startsAt.getTime() && b.startsAt.getTime() < week.endsAt.getTime())
        .map((b) => b.type as ExemptingBlockType)
    ),
  ];
}

// ---------------------------------------------------------------------------
// Weekly status
// ---------------------------------------------------------------------------

export type WeeklyInspectionStatus =
  | "not_required"
  | "exempt_off_road"
  | "failed"
  | "attention_required"
  | "completed"
  | "due"
  | "overdue";

export type WeekInspection = {
  id: string;
  inspection_date: string;
  /** Derived result. `draft` never satisfies the weekly requirement. */
  result: "draft" | "completed" | "attention_required" | "failed";
  approved_at?: string | null;
  created_at?: string | null;
  hasSafetyFailure?: boolean;
};

export type WeeklyStatusResult = {
  status: WeeklyInspectionStatus;
  /** The inspection that decides this week's outcome, if any. */
  inspection: WeekInspection | null;
  exemptTypes: ExemptingBlockType[];
  /** True once a completed inspection exists — approval is irrelevant here. */
  performed: boolean;
  hasSafetyFailure: boolean;
};

/**
 * The week's deciding inspection: the latest completed one.
 *
 * Drafts are ignored entirely — an unfinished sheet is not an inspection. Ties
 * on date fall back to created_at then id so the choice is deterministic
 * rather than dependent on row order.
 */
export function selectWeekInspection(inspections: WeekInspection[]): WeekInspection | null {
  const completed = inspections.filter((i) => i.result !== "draft");
  if (completed.length === 0) return null;

  return completed.slice().sort((a, b) => {
    if (a.inspection_date !== b.inspection_date) return a.inspection_date < b.inspection_date ? 1 : -1;
    const aCreated = a.created_at ?? "";
    const bCreated = b.created_at ?? "";
    if (aCreated !== bCreated) return aCreated < bCreated ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  })[0];
}

export function resolveWeeklyStatus(input: {
  vehicle: EligibilityVehicle & { created_at?: string | null };
  week: WeekInterval;
  inspections: WeekInspection[];
  blocks: BlockRange[];
  /** "Now" as an instant, so an in-progress week reads as due rather than overdue. */
  now: Date;
  /**
   * The earliest week this system may call missed. Before Weekly Inspections
   * were in use here nobody failed to perform one, so a week older than this
   * is not required rather than overdue. See historyBoundaryWeek.
   */
  earliestWeekEnding?: string | null;
}): WeeklyStatusResult {
  const { vehicle, week, inspections, blocks, now } = input;

  const base = { exemptTypes: [] as ExemptingBlockType[], performed: false, hasSafetyFailure: false };

  if (!isInspectionEligible(vehicle)) {
    return { ...base, status: "not_required", inspection: null };
  }

  const inspection = selectWeekInspection(inspections);
  if (inspection) {
    const hasSafetyFailure = inspection.hasSafetyFailure === true;
    // Approval is a governance dimension and never changes the outcome: an
    // approved failure is still a failure, and still a week that was inspected.
    const status: WeeklyInspectionStatus =
      inspection.result === "failed"
        ? "failed"
        : inspection.result === "attention_required"
          ? "attention_required"
          : "completed";
    return { ...base, status, inspection, performed: true, hasSafetyFailure };
  }

  // No completed inspection. Off-road for the whole week excuses it.
  if (isExemptForWeek(blocks, week)) {
    return {
      ...base,
      status: "exempt_off_road",
      inspection: null,
      exemptTypes: exemptingTypesForWeek(blocks, week),
    };
  }

  // A week still running is DUE, not missed — the operator has time left.
  if (now.getTime() < week.endsAt.getTime()) {
    return { ...base, status: "due", inspection: null };
  }

  // The week is over. It is only "missed" if the vehicle existed to be
  // inspected — see the note at the top about why created_at is a floor only.
  if (vehicle.created_at && new Date(vehicle.created_at).getTime() >= week.endsAt.getTime()) {
    return { ...base, status: "not_required", inspection: null };
  }

  // ...and only if Weekly Inspections were actually in use that week. Without
  // this, every week before the module shipped would read as a fleet-wide
  // failure that never happened.
  if (input.earliestWeekEnding === null || (input.earliestWeekEnding && week.weekEnding < input.earliestWeekEnding)) {
    return { ...base, status: "not_required", inspection: null };
  }

  return { ...base, status: "overdue", inspection: null };
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export const WEEKLY_STATUS_LABELS: Record<WeeklyInspectionStatus, { label: string; glyph: string }> = {
  failed: { label: "Failed", glyph: "✕" },
  attention_required: { label: "Attention", glyph: "!" },
  overdue: { label: "Overdue", glyph: "✕" },
  due: { label: "Due", glyph: "○" },
  completed: { label: "Completed", glyph: "✓" },
  exempt_off_road: { label: "Exempt — off road all week", glyph: "–" },
  not_required: { label: "Not required", glyph: "–" },
};

/**
 * Operational priority: what a fleet controller must deal with first. A safety
 * failure outranks everything; a missed week outranks a week still running.
 */
const STATUS_PRIORITY: Record<WeeklyInspectionStatus, number> = {
  failed: 2,
  attention_required: 3,
  overdue: 4,
  due: 5,
  completed: 6,
  exempt_off_road: 7,
  not_required: 8,
};

export function statusPriority(result: Pick<WeeklyStatusResult, "status" | "hasSafetyFailure">): number {
  if (result.status === "failed" && result.hasSafetyFailure) return 1;
  return STATUS_PRIORITY[result.status];
}

/** Statuses that need an operator to do something. */
export function needsAttention(status: WeeklyInspectionStatus): boolean {
  return status === "failed" || status === "attention_required" || status === "overdue";
}

// ---------------------------------------------------------------------------
// Missed-week history
// ---------------------------------------------------------------------------

/**
 * Weeks in the given range that were required and not satisfied.
 *
 * `earliestWeekEnding` is the boundary before which the system cannot claim a
 * week was missed. Weekly Inspections did not exist before then, so nobody
 * failed to perform one — see historyBoundaryWeek below.
 */
export function missedWeeks(input: {
  vehicle: EligibilityVehicle & { created_at?: string | null };
  weekEndings: string[];
  inspectionsByWeek: Map<string, WeekInspection[]>;
  blocks: BlockRange[];
  now: Date;
  earliestWeekEnding?: string | null;
}): string[] {
  return input.weekEndings.filter((weekEnding) => {
    const week = mauritiusWeekInterval(weekEnding);
    const resolved = resolveWeeklyStatus({
      vehicle: input.vehicle,
      week,
      inspections: input.inspectionsByWeek.get(weekEnding) ?? [],
      blocks: input.blocks,
      now: input.now,
      earliestWeekEnding: input.earliestWeekEnding,
    });
    return resolved.status === "overdue";
  });
}

/**
 * The earliest week the system may call "missed".
 *
 * Derived from the data rather than configured or hard-coded: before the first
 * inspection was ever recorded, Weekly Inspections were not in use here, so no
 * week before that can honestly be described as missed. With no inspections at
 * all there is no missed history — only the current week being due.
 *
 * Deliberately NOT the 0034 migration timestamp: baking a deployment date into
 * application logic would be an invisible constant nobody could later explain.
 */
export function historyBoundaryWeek(earliestInspectionDate: string | null | undefined): string | null {
  if (!earliestInspectionDate) return null;
  return weekEndingFor(earliestInspectionDate);
}
