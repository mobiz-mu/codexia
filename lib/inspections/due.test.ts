import { describe, it, expect } from "vitest";
import {
  EXEMPTING_BLOCK_TYPES,
  exemptingTypesForWeek,
  programStartWeek,
  isExemptForWeek,
  isExemptingBlockType,
  isInspectionEligible,
  mauritiusWeekInterval,
  mergeRanges,
  missedWeeks,
  needsAttention,
  parseBlockPeriod,
  resolveWeeklyStatus,
  selectWeekInspection,
  shiftWeekEnding,
  statusPriority,
  weekIntervalContaining,
  type BlockRange,
  type WeekInspection,
} from "./due";

// 2026-09-14 Mon … 2026-09-20 Sun
const WEEK = mauritiusWeekInterval("2026-09-20");
const ACTIVE = { status: "active", deleted_at: null, is_staff_car: false, created_at: "2026-01-01T00:00:00Z" };
const AFTER_WEEK = new Date("2026-09-21T06:00:00Z"); // Monday 10:00 Mauritius
const MID_WEEK = new Date("2026-09-16T06:00:00Z"); // Wednesday 10:00 Mauritius

const block = (type: string, startsAt: string, endsAt: string): BlockRange => ({
  type,
  startsAt: new Date(startsAt),
  endsAt: new Date(endsAt),
});

const inspection = (over: Partial<WeekInspection> = {}): WeekInspection => ({
  id: "i1",
  inspection_date: "2026-09-18",
  result: "completed",
  ...over,
});

describe("Mauritius week boundaries", () => {
  it("runs Monday 00:00 to the next Monday 00:00 local", () => {
    expect(WEEK.weekStart).toBe("2026-09-14");
    // Monday 00:00 Mauritius is Sunday 20:00 UTC.
    expect(WEEK.startsAt.toISOString()).toBe("2026-09-13T20:00:00.000Z");
    expect(WEEK.endsAt.toISOString()).toBe("2026-09-20T20:00:00.000Z");
  });

  it("puts a Monday and its Sunday in the same week", () => {
    expect(weekIntervalContaining("2026-09-14").weekEnding).toBe("2026-09-20");
    expect(weekIntervalContaining("2026-09-20").weekEnding).toBe("2026-09-20");
  });

  // The UTC edge: 22:00 UTC Sunday is already Monday in Mauritius.
  it("uses the Mauritius date, not the UTC date, at the boundary", () => {
    const sundayLateUtc = new Date("2026-09-20T21:00:00Z"); // 01:00 Mon in Mauritius
    expect(sundayLateUtc.getTime()).toBeGreaterThan(WEEK.endsAt.getTime());
  });

  it("crosses a year boundary", () => {
    expect(weekIntervalContaining("2026-12-31").weekEnding).toBe("2027-01-03");
  });

  it("shifts by whole weeks in both directions", () => {
    expect(shiftWeekEnding("2026-09-20", -1)).toBe("2026-09-13");
    expect(shiftWeekEnding("2026-09-20", 1)).toBe("2026-09-27");
    expect(shiftWeekEnding("2026-12-27", 1)).toBe("2027-01-03");
  });
});

describe("eligibility", () => {
  it("includes an active rental vehicle", () => {
    expect(isInspectionEligible({ status: "active", deleted_at: null, is_staff_car: false })).toBe(true);
  });

  // Staff cars are driven by the company, so they are inspected.
  it("includes an active staff car", () => {
    expect(isInspectionEligible({ status: "active", deleted_at: null, is_staff_car: true })).toBe(true);
  });

  it("excludes draft and archived vehicles", () => {
    expect(isInspectionEligible({ status: "draft", deleted_at: null })).toBe(false);
    expect(isInspectionEligible({ status: "archived", deleted_at: null })).toBe(false);
  });

  it("excludes a soft-deleted vehicle even if still marked active", () => {
    expect(isInspectionEligible({ status: "active", deleted_at: "2026-09-01T00:00:00Z" })).toBe(false);
  });
});

describe("qualifying block types", () => {
  it("qualifies maintenance, incident, inspection and stop_sell", () => {
    expect([...EXEMPTING_BLOCK_TYPES].sort()).toEqual(
      ["incident", "inspection", "maintenance", "stop_sell"].sort()
    );
  });

  // Turnaround work is not off the road in the sense that matters.
  it("does not qualify cleaning, preparing or internal", () => {
    for (const type of ["cleaning", "preparing", "internal"]) {
      expect(isExemptingBlockType(type)).toBe(false);
    }
  });
});

describe("range merging", () => {
  it("merges overlapping ranges", () => {
    const merged = mergeRanges([
      { startsAt: new Date("2026-09-14T00:00:00Z"), endsAt: new Date("2026-09-16T00:00:00Z") },
      { startsAt: new Date("2026-09-15T00:00:00Z"), endsAt: new Date("2026-09-18T00:00:00Z") },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].endsAt.toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });

  // Two blocks meeting exactly leave no moment on the road.
  it("merges ranges that touch exactly", () => {
    const merged = mergeRanges([
      { startsAt: new Date("2026-09-14T00:00:00Z"), endsAt: new Date("2026-09-16T00:00:00Z") },
      { startsAt: new Date("2026-09-16T00:00:00Z"), endsAt: new Date("2026-09-18T00:00:00Z") },
    ]);
    expect(merged).toHaveLength(1);
  });

  it("keeps ranges separated by a gap apart", () => {
    const merged = mergeRanges([
      { startsAt: new Date("2026-09-14T00:00:00Z"), endsAt: new Date("2026-09-16T00:00:00Z") },
      { startsAt: new Date("2026-09-16T01:00:00Z"), endsAt: new Date("2026-09-18T00:00:00Z") },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("discards zero-length ranges", () => {
    const same = new Date("2026-09-14T00:00:00Z");
    expect(mergeRanges([{ startsAt: same, endsAt: same }])).toHaveLength(0);
  });

  it("parses a Postgres tstzrange literal", () => {
    const parsed = parseBlockPeriod('["2026-08-31 22:28:00+00","2026-09-03 22:28:00+00")');
    expect(parsed?.startsAt.toISOString()).toBe("2026-08-31T22:28:00.000Z");
    expect(parseBlockPeriod("not a range")).toBeNull();
  });
});

describe("full-week exemption", () => {
  const full = (type: string) => [block(type, "2026-09-13T20:00:00Z", "2026-09-20T20:00:00Z")];

  for (const type of EXEMPTING_BLOCK_TYPES) {
    it(`exempts when ${type} covers the whole week`, () => {
      expect(isExemptForWeek(full(type), WEEK)).toBe(true);
    });
  }

  for (const type of ["cleaning", "preparing", "internal"]) {
    it(`does NOT exempt when ${type} covers the whole week`, () => {
      expect(isExemptForWeek(full(type), WEEK)).toBe(false);
    });
  }

  it("does not exempt for partial-week maintenance", () => {
    expect(isExemptForWeek([block("maintenance", "2026-09-14T00:00:00Z", "2026-09-17T00:00:00Z")], WEEK)).toBe(false);
  });

  // The case the spec calls out explicitly.
  it("exempts when two adjacent qualifying blocks together cover the week", () => {
    const blocks = [
      block("maintenance", "2026-09-13T20:00:00Z", "2026-09-17T00:00:00Z"),
      block("incident", "2026-09-17T00:00:00Z", "2026-09-20T20:00:00Z"),
    ];
    expect(isExemptForWeek(blocks, WEEK)).toBe(true);
  });

  it("does NOT exempt when a one-hour gap sits between two blocks", () => {
    const blocks = [
      block("maintenance", "2026-09-13T20:00:00Z", "2026-09-17T00:00:00Z"),
      block("incident", "2026-09-17T01:00:00Z", "2026-09-20T20:00:00Z"),
    ];
    expect(isExemptForWeek(blocks, WEEK)).toBe(false);
  });

  it("does not let a qualifying and a non-qualifying block combine", () => {
    const blocks = [
      block("maintenance", "2026-09-13T20:00:00Z", "2026-09-17T00:00:00Z"),
      block("cleaning", "2026-09-17T00:00:00Z", "2026-09-20T20:00:00Z"),
    ];
    expect(isExemptForWeek(blocks, WEEK)).toBe(false);
  });

  it("exempts when a longer block spans beyond the week on both sides", () => {
    expect(isExemptForWeek([block("stop_sell", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z")], WEEK)).toBe(true);
  });

  it("reports the distinct causes rather than inventing one", () => {
    const blocks = [
      block("maintenance", "2026-09-13T20:00:00Z", "2026-09-17T00:00:00Z"),
      block("incident", "2026-09-17T00:00:00Z", "2026-09-20T20:00:00Z"),
    ];
    expect(exemptingTypesForWeek(blocks, WEEK).sort()).toEqual(["incident", "maintenance"]);
  });
});

describe("selecting the week's inspection", () => {
  it("ignores drafts entirely", () => {
    expect(selectWeekInspection([inspection({ result: "draft" })])).toBeNull();
  });

  it("picks the latest completed inspection by date", () => {
    const chosen = selectWeekInspection([
      inspection({ id: "old", inspection_date: "2026-09-15", result: "failed" }),
      inspection({ id: "new", inspection_date: "2026-09-18", result: "completed" }),
    ]);
    expect(chosen?.id).toBe("new");
  });

  it("breaks a same-date tie deterministically on created_at", () => {
    const chosen = selectWeekInspection([
      inspection({ id: "a", created_at: "2026-09-18T08:00:00Z", result: "failed" }),
      inspection({ id: "b", created_at: "2026-09-18T15:00:00Z", result: "completed" }),
    ]);
    expect(chosen?.id).toBe("b");
  });

  it("prefers a completed inspection over a draft on a later date", () => {
    const chosen = selectWeekInspection([
      inspection({ id: "done", inspection_date: "2026-09-15", result: "completed" }),
      inspection({ id: "draft", inspection_date: "2026-09-19", result: "draft" }),
    ]);
    expect(chosen?.id).toBe("done");
  });
});

describe("weekly status", () => {
  const resolve = (over: Partial<Parameters<typeof resolveWeeklyStatus>[0]> = {}) =>
    resolveWeeklyStatus({ vehicle: ACTIVE, week: WEEK, inspections: [], blocks: [], now: AFTER_WEEK, ...over });

  it("is not_required for an ineligible vehicle", () => {
    expect(resolve({ vehicle: { ...ACTIVE, status: "draft" } }).status).toBe("not_required");
  });

  // The distinction the spec insists on.
  it("is DUE while the week is still running", () => {
    expect(resolve({ now: MID_WEEK }).status).toBe("due");
  });

  it("is OVERDUE once the week has ended with nothing recorded", () => {
    expect(resolve({ now: AFTER_WEEK }).status).toBe("overdue");
  });

  it("is completed for a clean inspection", () => {
    const r = resolve({ inspections: [inspection({ result: "completed" })] });
    expect(r.status).toBe("completed");
    expect(r.performed).toBe(true);
  });

  it("is attention_required, kept distinct from failed", () => {
    expect(resolve({ inspections: [inspection({ result: "attention_required" })] }).status).toBe(
      "attention_required"
    );
  });

  it("is failed for a failed inspection", () => {
    const r = resolve({ inspections: [inspection({ result: "failed" })] });
    expect(r.status).toBe("failed");
    expect(r.performed).toBe(true);
  });

  // Approval is governance, not performance.
  it("treats FAILED · APPROVED as performed and still failed, never overdue", () => {
    const r = resolve({
      inspections: [inspection({ result: "failed", approved_at: "2026-09-21T08:00:00Z" })],
    });
    expect(r.status).toBe("failed");
    expect(r.performed).toBe(true);
    expect(r.status).not.toBe("overdue");
  });

  it("does not let a draft satisfy the requirement", () => {
    expect(resolve({ inspections: [inspection({ result: "draft" })], now: AFTER_WEEK }).status).toBe("overdue");
    expect(resolve({ inspections: [inspection({ result: "draft" })], now: MID_WEEK }).status).toBe("due");
  });

  it("is exempt when off road for the whole week", () => {
    const r = resolve({ blocks: [block("maintenance", "2026-09-13T20:00:00Z", "2026-09-20T20:00:00Z")] });
    expect(r.status).toBe("exempt_off_road");
    expect(r.exemptTypes).toEqual(["maintenance"]);
  });

  // An inspection that happened outranks the exemption: it was performed.
  it("prefers a real inspection over an exemption", () => {
    const r = resolve({
      inspections: [inspection({ result: "failed" })],
      blocks: [block("maintenance", "2026-09-13T20:00:00Z", "2026-09-20T20:00:00Z")],
    });
    expect(r.status).toBe("failed");
  });

  it("carries the safety-failure flag through", () => {
    const r = resolve({ inspections: [inspection({ result: "failed", hasSafetyFailure: true })] });
    expect(r.hasSafetyFailure).toBe(true);
  });

  // created_at is a floor, not an in-service date.
  it("does not call a week missed if the vehicle record did not exist yet", () => {
    const r = resolve({ vehicle: { ...ACTIVE, created_at: "2026-10-01T00:00:00Z" }, now: AFTER_WEEK });
    expect(r.status).toBe("not_required");
  });

  it("does call it missed when the record predates the week", () => {
    const r = resolve({ vehicle: { ...ACTIVE, created_at: "2026-01-01T00:00:00Z" }, now: AFTER_WEEK });
    expect(r.status).toBe("overdue");
  });
});

describe("priority and attention", () => {
  it("ranks a safety failure above every other state", () => {
    const safety = statusPriority({ status: "failed", hasSafetyFailure: true });
    const plainFail = statusPriority({ status: "failed", hasSafetyFailure: false });
    expect(safety).toBeLessThan(plainFail);
  });

  it("orders failed, attention, overdue, due, completed, exempt", () => {
    const order = (["failed", "attention_required", "overdue", "due", "completed", "exempt_off_road"] as const).map(
      (status) => statusPriority({ status, hasSafetyFailure: false })
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("flags only the states an operator must act on", () => {
    expect(needsAttention("failed")).toBe(true);
    expect(needsAttention("attention_required")).toBe(true);
    expect(needsAttention("overdue")).toBe(true);
    expect(needsAttention("due")).toBe(false);
    expect(needsAttention("completed")).toBe(false);
    expect(needsAttention("exempt_off_road")).toBe(false);
  });
});

describe("missed-week history", () => {
  const weeks = ["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20"];

  it("reports weeks that ended with nothing recorded", () => {
    const missed = missedWeeks({
      vehicle: ACTIVE,
      weekEndings: weeks,
      inspectionsByWeek: new Map(),
      blocks: [],
      now: new Date("2026-09-28T06:00:00Z"),
    });
    expect(missed).toEqual(weeks);
  });

  it("does not report a week that was inspected", () => {
    const missed = missedWeeks({
      vehicle: ACTIVE,
      weekEndings: weeks,
      inspectionsByWeek: new Map([["2026-09-13", [inspection({ inspection_date: "2026-09-11", result: "failed" })]]]),
      blocks: [],
      now: new Date("2026-09-28T06:00:00Z"),
    });
    expect(missed).not.toContain("2026-09-13");
  });

  it("does not report a week that was fully exempt", () => {
    const missed = missedWeeks({
      vehicle: ACTIVE,
      weekEndings: ["2026-09-20"],
      inspectionsByWeek: new Map(),
      blocks: [block("incident", "2026-09-13T20:00:00Z", "2026-09-20T20:00:00Z")],
      now: new Date("2026-09-28T06:00:00Z"),
    });
    expect(missed).toEqual([]);
  });

  // No fabricated pre-launch history.
  it("reports nothing before the history boundary", () => {
    const missed = missedWeeks({
      vehicle: ACTIVE,
      weekEndings: weeks,
      inspectionsByWeek: new Map(),
      blocks: [],
      now: new Date("2026-09-28T06:00:00Z"),
      programStartWeekEnding: "2026-09-13",
    });
    expect(missed).toEqual(["2026-09-13", "2026-09-20"]);
  });
});

/**
 * The programme start boundary.
 *
 * Compliance ACTIVITY cannot define when a compliance REQUIREMENT began. These
 * tests exist because an earlier version derived the boundary from the oldest
 * recorded inspection, which silently erased exactly the weeks somebody has to
 * answer for — the ones where nobody inspected anything.
 */
describe("programme start boundary", () => {
  const PROGRAM_START = "2026-08-24"; // Monday
  const START_WEEK = programStartWeek(PROGRAM_START)!; // 2026-08-30

  const resolveWeek = (weekEnding: string, over: Record<string, unknown> = {}) =>
    resolveWeeklyStatus({
      vehicle: ACTIVE,
      week: mauritiusWeekInterval(weekEnding),
      inspections: [],
      blocks: [],
      now: new Date("2026-10-05T06:00:00Z"),
      programStartWeekEnding: START_WEEK,
      ...over,
    });

  it("turns the start Monday into the Sunday closing its week", () => {
    expect(START_WEEK).toBe("2026-08-30");
  });

  it("treats a week before the programme start as not required", () => {
    expect(resolveWeek("2026-08-23").status).toBe("not_required");
  });

  it("applies the normal rules from the programme start week onward", () => {
    expect(resolveWeek("2026-08-30").status).toBe("overdue");
  });

  // The scenario that motivated this phase.
  it("keeps weeks 1-2 missed even though the first inspection lands in week 4", () => {
    const week4Inspection = inspection({ inspection_date: "2026-09-16", result: "completed" });

    expect(resolveWeek("2026-08-30").status).toBe("overdue"); // week 1
    expect(resolveWeek("2026-09-06").status).toBe("overdue"); // week 2
    expect(resolveWeek("2026-09-13").status).toBe("overdue"); // week 3
    expect(resolveWeek("2026-09-20", { inspections: [week4Inspection] }).status).toBe("completed");
  });

  // The boundary is a setting, so the data cannot move it.
  it("does not move when the earliest inspection is deleted", () => {
    const withInspection = resolveWeek("2026-08-30", {
      inspections: [inspection({ inspection_date: "2026-08-26", result: "completed" })],
    });
    expect(withInspection.status).toBe("completed");

    // Same week, inspection now gone: still required, so still overdue.
    expect(resolveWeek("2026-08-30").status).toBe("overdue");
    // And a pre-programme week is unaffected either way.
    expect(resolveWeek("2026-08-23").status).toBe("not_required");
  });

  it("is unaffected by how many inspections exist or when they happened", () => {
    expect(programStartWeek(PROGRAM_START)).toBe("2026-08-30");
    expect(programStartWeek("2026-08-24")).toBe("2026-08-30");
  });

  it("requires nothing anywhere when no programme start is configured", () => {
    expect(programStartWeek(null)).toBeNull();
    expect(resolveWeek("2026-08-30", { programStartWeekEnding: null }).status).toBe("not_required");
  });

  it("is DUE, not overdue, for the current week after the programme start", () => {
    const current = "2026-10-11";
    const status = resolveWeeklyStatus({
      vehicle: ACTIVE,
      week: mauritiusWeekInterval(current),
      inspections: [],
      blocks: [],
      now: new Date("2026-10-07T06:00:00Z"), // Wednesday of that week
      programStartWeekEnding: START_WEEK,
    });
    expect(status.status).toBe("due");
  });

  it("is exempt, not overdue, for a fully off-road week after the start", () => {
    const week = mauritiusWeekInterval("2026-09-06");
    const status = resolveWeeklyStatus({
      vehicle: ACTIVE,
      week,
      inspections: [],
      blocks: [{ type: "maintenance", startsAt: week.startsAt, endsAt: week.endsAt }],
      now: new Date("2026-10-05T06:00:00Z"),
      programStartWeekEnding: START_WEEK,
    });
    expect(status.status).toBe("exempt_off_road");
  });

  it("does not let a draft satisfy a post-start week", () => {
    expect(resolveWeek("2026-08-30", { inspections: [inspection({ result: "draft" })] }).status).toBe("overdue");
  });

  it("counts a failed inspection as performed and keeps it failed", () => {
    const r = resolveWeek("2026-08-30", { inspections: [inspection({ result: "failed" })] });
    expect(r.status).toBe("failed");
    expect(r.performed).toBe(true);
  });

  it("applies the same programme start to a staff car", () => {
    const staff = { ...ACTIVE, is_staff_car: true };
    expect(resolveWeek("2026-08-23", { vehicle: staff }).status).toBe("not_required");
    expect(resolveWeek("2026-08-30", { vehicle: staff }).status).toBe("overdue");
  });

  // created_at proves non-existence, never an in-service date.
  it("does not accuse a vehicle of missing weeks before its record existed", () => {
    const late = { ...ACTIVE, created_at: "2026-09-10T00:00:00Z" };
    expect(resolveWeek("2026-08-30", { vehicle: late }).status).toBe("not_required");
    expect(resolveWeek("2026-09-13", { vehicle: late }).status).toBe("overdue");
  });

  it("honours the programme start in missed-week history", () => {
    const missed = missedWeeks({
      vehicle: ACTIVE,
      weekEndings: ["2026-08-16", "2026-08-23", "2026-08-30", "2026-09-06"],
      inspectionsByWeek: new Map(),
      blocks: [],
      now: new Date("2026-10-05T06:00:00Z"),
      programStartWeekEnding: START_WEEK,
    });
    expect(missed).toEqual(["2026-08-30", "2026-09-06"]);
  });
});
