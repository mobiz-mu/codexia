import { describe, it, expect } from "vitest";
import {
  createInspectionSchema,
  dateFallsInWeek,
  inspectionDowntimeSchema,
  inspectionFollowUpSchema,
  inspectionItemUpdateSchema,
  isSunday,
  normalizeInspectionListFilters,
  sanitizeSearchTerm,
  todayInMauritius,
  weekEndingFor,
  weekStartFor,
} from "./schema";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";

describe("Mauritius week arithmetic", () => {
  // 2026-09-14 is a Monday; 2026-09-20 the Sunday that closes its week.
  it("returns the Sunday that closes the week for a Monday", () => {
    expect(weekEndingFor("2026-09-14")).toBe("2026-09-20");
  });

  it("returns the same date when it is already a Sunday", () => {
    expect(weekEndingFor("2026-09-20")).toBe("2026-09-20");
  });

  it("handles a Saturday", () => {
    expect(weekEndingFor("2026-09-19")).toBe("2026-09-20");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-09-30 is a Wednesday; its week ends Sunday 2026-10-04.
    expect(weekEndingFor("2026-09-30")).toBe("2026-10-04");
  });

  it("crosses a year boundary correctly", () => {
    // 2026-12-31 is a Thursday; its week ends Sunday 2027-01-03.
    expect(weekEndingFor("2026-12-31")).toBe("2027-01-03");
  });

  it("derives the Monday that opens the week", () => {
    expect(weekStartFor("2026-09-20")).toBe("2026-09-14");
  });

  it("identifies Sundays", () => {
    expect(isSunday("2026-09-20")).toBe(true);
    expect(isSunday("2026-09-16")).toBe(false);
  });

  it("accepts every day of its own week and rejects the neighbours", () => {
    for (const d of [
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]) {
      expect(dateFallsInWeek(d, "2026-09-20")).toBe(true);
    }
    expect(dateFallsInWeek("2026-09-13", "2026-09-20")).toBe(false);
    expect(dateFallsInWeek("2026-09-21", "2026-09-20")).toBe(false);
  });

  // A 01:00 Mauritius moment is the previous UTC day; the week must follow
  // the Mauritius calendar, not the server's.
  it("uses the Mauritius calendar date, not UTC", () => {
    const lateEveningUtc = new Date("2026-09-20T21:30:00Z"); // 01:30 on the 21st in Mauritius
    expect(todayInMauritius(lateEveningUtc)).toBe("2026-09-21");
  });
});

describe("createInspectionSchema", () => {
  const base = {
    vehicleId: VEHICLE_ID,
    inspectionDate: "2026-09-18",
    odometerKm: "50000",
  };

  it("accepts a valid inspection and derives nothing the client should not send", () => {
    const parsed = createInspectionSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.odometerKm).toBe(50000);
      // No result and no checklist items are accepted from the client at all.
      expect("result" in parsed.data).toBe(false);
      expect("items" in parsed.data).toBe(false);
    }
  });

  it("rejects a missing vehicle", () => {
    expect(createInspectionSchema.safeParse({ ...base, vehicleId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a negative odometer", () => {
    expect(createInspectionSchema.safeParse({ ...base, odometerKm: "-5" }).success).toBe(false);
  });

  it("rejects a non-integer odometer", () => {
    expect(createInspectionSchema.safeParse({ ...base, odometerKm: "50000.5" }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(createInspectionSchema.safeParse({ ...base, inspectionDate: "18/09/2026" }).success).toBe(false);
  });

  it("rejects a week ending that is not a Sunday", () => {
    const parsed = createInspectionSchema.safeParse({ ...base, weekEnding: "2026-09-16" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toMatch(/Sunday/);
  });

  it("rejects an inspection date outside the week it claims", () => {
    const parsed = createInspectionSchema.safeParse({ ...base, weekEnding: "2026-09-27" });
    expect(parsed.success).toBe(false);
  });

  it("accepts a matching week ending", () => {
    expect(createInspectionSchema.safeParse({ ...base, weekEnding: "2026-09-20" }).success).toBe(true);
  });
});

describe("inspectionItemUpdateSchema", () => {
  it("accepts each of the four results", () => {
    for (const result of ["pass", "attention", "fail", "na"]) {
      const parsed = inspectionItemUpdateSchema.safeParse({ itemKey: "road_brakes", result });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.result).toBe(result);
    }
  });

  it("treats an empty result as clearing the answer back to unanswered", () => {
    const parsed = inspectionItemUpdateSchema.safeParse({ itemKey: "road_brakes", result: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.result).toBeNull();
  });

  it("rejects a result outside the enum", () => {
    expect(inspectionItemUpdateSchema.safeParse({ itemKey: "road_brakes", result: "maybe" }).success).toBe(false);
  });

  // The client cannot invent checklist items.
  it("rejects an unknown checklist key", () => {
    const parsed = inspectionItemUpdateSchema.safeParse({ itemKey: "ext_sunroof", result: "pass" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toMatch(/Unknown checklist item/);
  });
});

describe("inspectionDowntimeSchema", () => {
  it("accepts a valid window", () => {
    const parsed = inspectionDowntimeSchema.safeParse({
      startAt: "2026-09-21T10:00",
      endAt: "2026-09-22T10:00",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an end before the start", () => {
    const parsed = inspectionDowntimeSchema.safeParse({
      startAt: "2026-09-22T10:00",
      endAt: "2026-09-21T10:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an end equal to the start", () => {
    const parsed = inspectionDowntimeSchema.safeParse({
      startAt: "2026-09-21T10:00",
      endAt: "2026-09-21T10:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unparseable dates", () => {
    expect(inspectionDowntimeSchema.safeParse({ startAt: "soon", endAt: "later" }).success).toBe(false);
  });
});

describe("inspectionFollowUpSchema", () => {
  it("accepts known checklist keys", () => {
    expect(inspectionFollowUpSchema.safeParse({ itemKeys: ["road_brakes", "tyre_front_tread"] }).success).toBe(true);
  });

  it("rejects an empty selection", () => {
    expect(inspectionFollowUpSchema.safeParse({ itemKeys: [] }).success).toBe(false);
  });

  it("rejects an unknown key in the selection", () => {
    expect(inspectionFollowUpSchema.safeParse({ itemKeys: ["road_brakes", "ext_sunroof"] }).success).toBe(false);
  });
});

describe("list filters", () => {
  it("defaults to page 1 and no filters", () => {
    expect(normalizeInspectionListFilters({})).toEqual({
      vehicleId: null,
      weekEnding: null,
      result: null,
      approval: null,
      defectsOnly: false,
      search: null,
      page: 1,
    });
  });

  it("drops an unknown result value rather than querying with it", () => {
    expect(normalizeInspectionListFilters({ result: "approved" }).result).toBeNull();
    expect(normalizeInspectionListFilters({ result: "failed" }).result).toBe("failed");
  });

  it("drops a malformed week ending", () => {
    expect(normalizeInspectionListFilters({ weekEnding: "next week" }).weekEnding).toBeNull();
    expect(normalizeInspectionListFilters({ weekEnding: "2026-09-20" }).weekEnding).toBe("2026-09-20");
  });

  it("accepts only the two approval states", () => {
    expect(normalizeInspectionListFilters({ approval: "approved" }).approval).toBe("approved");
    expect(normalizeInspectionListFilters({ approval: "maybe" }).approval).toBeNull();
  });

  it("clamps a nonsense page to 1", () => {
    expect(normalizeInspectionListFilters({ page: "-3" }).page).toBe(1);
    expect(normalizeInspectionListFilters({ page: "abc" }).page).toBe(1);
  });

  it("strips wildcard characters from search input", () => {
    expect(sanitizeSearchTerm("%_,()brakes")).toBe("brakes");
  });
});
