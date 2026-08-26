import { describe, it, expect } from "vitest";
import { incidentSchema, normalizeIncidentListFilters, sanitizeSearchTerm } from "./schema";

const VALID_VEHICLE_ID = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Record<string, string> = {}) {
  return {
    vehicleId: VALID_VEHICLE_ID,
    incidentDate: "2026-03-10",
    incidentTime: "14:30",
    location: "Grand Baie roundabout",
    driverCustomerName: "Jean Dupont",
    bookingReference: "",
    incidentType: "collision",
    customType: "",
    accidentDescription: "Rear-ended at a roundabout",
    damageDescription: "Rear bumper cracked",
    affectedAreas: "Rear bumper, tail light",
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
}

describe("incidentSchema — happy path", () => {
  it("accepts a valid record and converts MUR costs to cents", () => {
    const result = incidentSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedRepairCostMur).toBe(45000);
      expect(result.data.actualRepairCostMur).toBeNull();
    }
  });

  it("accepts an unlinked incident (no booking reference)", () => {
    const result = incidentSchema.safeParse(baseInput({ bookingReference: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bookingReference).toBeNull();
  });

  it("accepts a linked incident (booking reference provided, resolved elsewhere)", () => {
    const result = incidentSchema.safeParse(baseInput({ bookingReference: "CDX-2026-00042" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bookingReference).toBe("CDX-2026-00042");
  });
});

describe("incidentSchema — 'other' requires a custom type", () => {
  it("rejects 'other' without a custom type", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentType: "other", customType: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts 'other' with a custom type", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentType: "other", customType: "Falling tree branch" }));
    expect(result.success).toBe(true);
  });

  it("does not require a custom type for non-'other' types", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentType: "windscreen", customType: "" }));
    expect(result.success).toBe(true);
  });
});

describe("incidentSchema — invalid dates", () => {
  it("rejects an invalid incidentDate", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid dateReported", () => {
    const result = incidentSchema.safeParse(baseInput({ dateReported: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("allows optional dates to be omitted", () => {
    const result = incidentSchema.safeParse(baseInput({ dateReported: "", dateRepairStarted: "", dateRepaired: "" }));
    expect(result.success).toBe(true);
  });
});

describe("incidentSchema — repair date must not be before incident date", () => {
  it("rejects dateReported before incidentDate", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "2026-03-10", dateReported: "2026-03-09" }));
    expect(result.success).toBe(false);
  });

  it("rejects dateRepairStarted before incidentDate", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "2026-03-10", dateRepairStarted: "2026-03-05" }));
    expect(result.success).toBe(false);
  });

  it("rejects dateRepaired before incidentDate", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "2026-03-10", dateRepaired: "2026-03-01" }));
    expect(result.success).toBe(false);
  });

  it("rejects dateRepaired before dateRepairStarted", () => {
    const result = incidentSchema.safeParse(
      baseInput({ incidentDate: "2026-03-10", dateRepairStarted: "2026-03-15", dateRepaired: "2026-03-12" })
    );
    expect(result.success).toBe(false);
  });

  it("accepts dateRepaired on the same day as dateRepairStarted", () => {
    const result = incidentSchema.safeParse(
      baseInput({ incidentDate: "2026-03-10", dateRepairStarted: "2026-03-15", dateRepaired: "2026-03-15" })
    );
    expect(result.success).toBe(true);
  });
});

describe("incidentSchema — downtime validation", () => {
  it("rejects downtimeStart before incidentDate", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "2026-03-10", downtimeStart: "2026-03-05" }));
    expect(result.success).toBe(false);
  });

  it("rejects downtimeEnd before downtimeStart", () => {
    const result = incidentSchema.safeParse(
      baseInput({ incidentDate: "2026-03-10", downtimeStart: "2026-03-12", downtimeEnd: "2026-03-11" })
    );
    expect(result.success).toBe(false);
  });

  it("accepts downtimeEnd equal to downtimeStart (down for part of one day)", () => {
    const result = incidentSchema.safeParse(
      baseInput({ incidentDate: "2026-03-10", downtimeStart: "2026-03-12", downtimeEnd: "2026-03-12" })
    );
    expect(result.success).toBe(true);
  });

  it("allows downtimeEnd without downtimeStart to fail only on the start-vs-incident check, not crash", () => {
    const result = incidentSchema.safeParse(baseInput({ incidentDate: "2026-03-10", downtimeEnd: "2026-03-12" }));
    expect(result.success).toBe(true); // no downtimeStart means the end-vs-start check is skipped
  });
});

describe("incidentSchema — MUR cost validation", () => {
  it("rejects a negative estimated cost", () => {
    const result = incidentSchema.safeParse(baseInput({ estimatedRepairCostMur: "-100" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric actual cost", () => {
    const result = incidentSchema.safeParse(baseInput({ actualRepairCostMur: "abc" }));
    expect(result.success).toBe(false);
  });

  it("accepts a zero cost", () => {
    const result = incidentSchema.safeParse(baseInput({ estimatedRepairCostMur: "0" }));
    expect(result.success).toBe(true);
  });

  it("allows both costs to be omitted (not yet estimated)", () => {
    const result = incidentSchema.safeParse(baseInput({ estimatedRepairCostMur: "", actualRepairCostMur: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedRepairCostMur).toBeNull();
      expect(result.data.actualRepairCostMur).toBeNull();
    }
  });
});

describe("incidentSchema — status/severity enums", () => {
  it("rejects an unknown repairStatus", () => {
    const result = incidentSchema.safeParse(baseInput({ repairStatus: "fixed" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown severity", () => {
    const result = incidentSchema.safeParse(baseInput({ severity: "catastrophic" }));
    expect(result.success).toBe(false);
  });

  it("accepts every documented repairStatus value", () => {
    for (const status of ["reported", "under_assessment", "awaiting_insurance", "approved_for_repair", "under_repair", "repaired", "closed"]) {
      const result = incidentSchema.safeParse(baseInput({ repairStatus: status }));
      expect(result.success).toBe(true);
    }
  });
});

describe("normalizeIncidentListFilters", () => {
  it("returns all-null/defaults for an empty params object", () => {
    expect(normalizeIncidentListFilters({})).toEqual({
      vehicleId: null,
      severity: null,
      repairStatus: null,
      dateFrom: null,
      dateTo: null,
      search: null,
      page: 1,
    });
  });

  it("passes through valid values", () => {
    const filters = normalizeIncidentListFilters({
      vehicleId: VALID_VEHICLE_ID,
      severity: "major",
      repairStatus: "under_repair",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      search: "roundabout",
      page: "2",
    });
    expect(filters).toEqual({
      vehicleId: VALID_VEHICLE_ID,
      severity: "major",
      repairStatus: "under_repair",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      search: "roundabout",
      page: 2,
    });
  });

  it("drops invalid enum values rather than passing them to the query", () => {
    expect(normalizeIncidentListFilters({ severity: "catastrophic" }).severity).toBeNull();
    expect(normalizeIncidentListFilters({ repairStatus: "fixed" }).repairStatus).toBeNull();
  });

  it("clamps page to 1 for zero/negative/non-numeric input", () => {
    expect(normalizeIncidentListFilters({ page: "0" }).page).toBe(1);
    expect(normalizeIncidentListFilters({ page: "-2" }).page).toBe(1);
    expect(normalizeIncidentListFilters({ page: "xyz" }).page).toBe(1);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips commas and parentheses", () => {
    expect(sanitizeSearchTerm("Grand Baie,(roundabout)")).toBe("Grand Baieroundabout");
  });
});
