import { describe, it, expect } from "vitest";
import {
  complianceSchema,
  normalizeComplianceListFilters,
  sanitizeSearchTerm,
  statusFilterToExpiryRange,
} from "./schema";

const VALID_VEHICLE_ID = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Record<string, string> = {}) {
  return {
    vehicleId: VALID_VEHICLE_ID,
    documentType: "insurance",
    customType: "",
    referenceNumber: "POL-12345",
    provider: "Mauritius Union",
    issuedDate: "2026-01-01",
    expiryDate: "2027-01-01",
    costMur: "450.00",
    remarks: "",
    ...overrides,
  };
}

describe("complianceSchema", () => {
  it("accepts a valid insurance record and converts cost to MUR cents", () => {
    const result = complianceSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costMur).toBe(45000);
      expect(result.data.provider).toBe("Mauritius Union");
    }
  });

  it("allows cost to be omitted entirely (not recorded, distinct from zero)", () => {
    const result = complianceSchema.safeParse(baseInput({ costMur: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.costMur).toBeNull();
  });

  it("rejects a negative cost", () => {
    const result = complianceSchema.safeParse(baseInput({ costMur: "-10" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric cost", () => {
    const result = complianceSchema.safeParse(baseInput({ costMur: "abc" }));
    expect(result.success).toBe(false);
  });

  it("allows issuedDate to be omitted", () => {
    const result = complianceSchema.safeParse(baseInput({ issuedDate: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.issuedDate).toBeNull();
  });

  it("rejects an invalid expiryDate", () => {
    const result = complianceSchema.safeParse(baseInput({ expiryDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid issuedDate", () => {
    const result = complianceSchema.safeParse(baseInput({ issuedDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects issuedDate after expiryDate", () => {
    const result = complianceSchema.safeParse(baseInput({ issuedDate: "2027-06-01", expiryDate: "2027-01-01" }));
    expect(result.success).toBe(false);
  });

  it("accepts issuedDate equal to expiryDate", () => {
    const result = complianceSchema.safeParse(baseInput({ issuedDate: "2027-01-01", expiryDate: "2027-01-01" }));
    expect(result.success).toBe(true);
  });

  it("rejects an invalid vehicle id", () => {
    const result = complianceSchema.safeParse(baseInput({ vehicleId: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown document type", () => {
    const result = complianceSchema.safeParse(baseInput({ documentType: "roadworthy" }));
    expect(result.success).toBe(false);
  });

  it("requires customType when documentType is 'other'", () => {
    const result = complianceSchema.safeParse(baseInput({ documentType: "other", customType: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts 'other' when customType is provided", () => {
    const result = complianceSchema.safeParse(baseInput({ documentType: "other", customType: "Emissions Certificate" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customType).toBe("Emissions Certificate");
  });

  it("does not require customType for non-'other' types", () => {
    const result = complianceSchema.safeParse(baseInput({ documentType: "road_tax", customType: "" }));
    expect(result.success).toBe(true);
  });
});

describe("normalizeComplianceListFilters", () => {
  it("returns all-null/defaults for an empty params object", () => {
    expect(normalizeComplianceListFilters({})).toEqual({
      vehicleId: null,
      documentType: null,
      status: null,
      dateFrom: null,
      dateTo: null,
      search: null,
      page: 1,
    });
  });

  it("passes through valid values", () => {
    const filters = normalizeComplianceListFilters({
      vehicleId: VALID_VEHICLE_ID,
      documentType: "psvl",
      status: "urgent",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      search: "Mauritius Union",
      page: "3",
    });
    expect(filters).toEqual({
      vehicleId: VALID_VEHICLE_ID,
      documentType: "psvl",
      status: "urgent",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      search: "Mauritius Union",
      page: 3,
    });
  });

  it("drops a malformed vehicleId", () => {
    expect(normalizeComplianceListFilters({ vehicleId: "drop table" }).vehicleId).toBeNull();
  });

  it("drops an unknown document type", () => {
    expect(normalizeComplianceListFilters({ documentType: "roadworthy" }).documentType).toBeNull();
  });

  it("drops an unknown status", () => {
    expect(normalizeComplianceListFilters({ status: "overdue" }).status).toBeNull();
  });

  it("clamps page to 1 for zero/negative/non-numeric input", () => {
    expect(normalizeComplianceListFilters({ page: "0" }).page).toBe(1);
    expect(normalizeComplianceListFilters({ page: "-3" }).page).toBe(1);
    expect(normalizeComplianceListFilters({ page: "xyz" }).page).toBe(1);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips commas and parentheses", () => {
    expect(sanitizeSearchTerm("Mauritius,Union(Ltd)")).toBe("MauritiusUnionLtd");
  });
});

describe("statusFilterToExpiryRange", () => {
  const TODAY = "2026-03-15";

  it("expired -> strictly before today", () => {
    expect(statusFilterToExpiryRange("expired", TODAY)).toEqual({ lt: "2026-03-15" });
  });

  it("expires_today -> exactly today", () => {
    expect(statusFilterToExpiryRange("expires_today", TODAY)).toEqual({ gte: "2026-03-15", lte: "2026-03-15" });
  });

  it("urgent -> 1 to 7 days from today", () => {
    expect(statusFilterToExpiryRange("urgent", TODAY)).toEqual({ gte: "2026-03-16", lte: "2026-03-22" });
  });

  it("warning -> 8 to 30 days from today", () => {
    expect(statusFilterToExpiryRange("warning", TODAY)).toEqual({ gte: "2026-03-23", lte: "2026-04-14" });
  });

  it("valid -> 31+ days from today (open-ended)", () => {
    expect(statusFilterToExpiryRange("valid", TODAY)).toEqual({ gte: "2026-04-15" });
  });

  it("handles a month-boundary correctly (urgent range crossing into April)", () => {
    expect(statusFilterToExpiryRange("urgent", "2026-03-28")).toEqual({ gte: "2026-03-29", lte: "2026-04-04" });
  });
});
