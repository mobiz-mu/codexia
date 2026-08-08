import { describe, it, expect } from "vitest";
import { maintenanceSchema, normalizeMaintenanceListFilters, sanitizeSearchTerm } from "./schema";
import { formatMoney } from "@/lib/pricing/format";

const VALID_VEHICLE_ID = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Record<string, string> = {}) {
  return {
    vehicleId: VALID_VEHICLE_ID,
    maintenanceDate: "2026-01-15",
    maintenanceType: "scheduled_service",
    customType: "",
    repairsPerformed: "",
    partsChanged: "",
    tyreChanges: "",
    batteryChanges: "",
    servicingDetails: "Full service",
    oilFilterChanges: "",
    brakeWork: "",
    suspensionWork: "",
    electricalWork: "",
    mileageKm: "45000",
    serviceProvider: "Auto Garage Ltd",
    costEur: "120.50",
    remarks: "",
    ...overrides,
  };
}

describe("maintenanceSchema", () => {
  it("accepts a valid scheduled service record and converts cost to EUR cents", () => {
    const result = maintenanceSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costEur).toBe(12050);
      expect(result.data.mileageKm).toBe(45000);
      expect(result.data.servicingDetails).toBe("Full service");
      expect(result.data.repairsPerformed).toBeNull();
      expect(result.data.updateVehicleInfo).toBe(false);
    }
  });

  it("defaults updateVehicleInfo to false when the checkbox key is absent from FormData", () => {
    const input = baseInput() as Record<string, string>;
    const result = maintenanceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.updateVehicleInfo).toBe(false);
  });

  it("coerces updateVehicleInfo to true when present (checkbox checked)", () => {
    const result = maintenanceSchema.safeParse(baseInput({ updateVehicleInfo: "true" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.updateVehicleInfo).toBe(true);
  });

  it("rejects a negative cost", () => {
    const result = maintenanceSchema.safeParse(baseInput({ costEur: "-50" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric cost", () => {
    const result = maintenanceSchema.safeParse(baseInput({ costEur: "not-a-number" }));
    expect(result.success).toBe(false);
  });

  it("accepts a zero cost", () => {
    const result = maintenanceSchema.safeParse(baseInput({ costEur: "0" }));
    expect(result.success).toBe(true);
  });

  it("rejects a negative mileage", () => {
    const result = maintenanceSchema.safeParse(baseInput({ mileageKm: "-1" }));
    expect(result.success).toBe(false);
  });

  it("rejects a fractional mileage", () => {
    const result = maintenanceSchema.safeParse(baseInput({ mileageKm: "45000.5" }));
    expect(result.success).toBe(false);
  });

  it("allows mileage to be omitted", () => {
    const result = maintenanceSchema.safeParse(baseInput({ mileageKm: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mileageKm).toBeNull();
  });

  it("rejects an invalid vehicle id (not a UUID)", () => {
    const result = maintenanceSchema.safeParse(baseInput({ vehicleId: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid maintenance date", () => {
    const result = maintenanceSchema.safeParse(baseInput({ maintenanceDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown maintenance type", () => {
    const result = maintenanceSchema.safeParse(baseInput({ maintenanceType: "engine_swap" }));
    expect(result.success).toBe(false);
  });

  it("requires customType when maintenanceType is 'other'", () => {
    const result = maintenanceSchema.safeParse(baseInput({ maintenanceType: "other", customType: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts 'other' when customType is provided", () => {
    const result = maintenanceSchema.safeParse(
      baseInput({ maintenanceType: "other", customType: "Windscreen replacement" })
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customType).toBe("Windscreen replacement");
  });

  it("does not require customType for non-'other' types", () => {
    const result = maintenanceSchema.safeParse(baseInput({ maintenanceType: "tyre_change", customType: "" }));
    expect(result.success).toBe(true);
  });
});

describe("normalizeMaintenanceListFilters", () => {
  it("returns all-null/defaults for an empty params object", () => {
    const filters = normalizeMaintenanceListFilters({});
    expect(filters).toEqual({
      vehicleId: null,
      dateFrom: null,
      dateTo: null,
      type: null,
      search: null,
      page: 1,
    });
  });

  it("passes through a valid vehicleId, dates, type, and search", () => {
    const filters = normalizeMaintenanceListFilters({
      vehicleId: VALID_VEHICLE_ID,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      type: "brake_work",
      search: "Auto Garage",
      page: "2",
    });
    expect(filters).toEqual({
      vehicleId: VALID_VEHICLE_ID,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      type: "brake_work",
      search: "Auto Garage",
      page: 2,
    });
  });

  it("drops a malformed vehicleId rather than passing it to the query", () => {
    const filters = normalizeMaintenanceListFilters({ vehicleId: "drop-table-vehicles" });
    expect(filters.vehicleId).toBeNull();
  });

  it("drops an unknown maintenance type", () => {
    const filters = normalizeMaintenanceListFilters({ type: "engine_swap" });
    expect(filters.type).toBeNull();
  });

  it("drops an invalid date", () => {
    const filters = normalizeMaintenanceListFilters({ dateFrom: "not-a-date" });
    expect(filters.dateFrom).toBeNull();
  });

  it("clamps page to 1 for zero, negative, or non-numeric input", () => {
    expect(normalizeMaintenanceListFilters({ page: "0" }).page).toBe(1);
    expect(normalizeMaintenanceListFilters({ page: "-5" }).page).toBe(1);
    expect(normalizeMaintenanceListFilters({ page: "abc" }).page).toBe(1);
  });

  it("floors a fractional page", () => {
    expect(normalizeMaintenanceListFilters({ page: "2.9" }).page).toBe(2);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips commas and parentheses used to break out of an .or() filter", () => {
    expect(sanitizeSearchTerm("brakes,or=(id.eq.1)")).toBe("brakesor=id.eq.1");
  });

  it("leaves ordinary search text untouched", () => {
    expect(sanitizeSearchTerm("Auto Garage Ltd")).toBe("Auto Garage Ltd");
  });
});

describe("EUR formatting for maintenance cost", () => {
  it("formats maintenance cost cents as EUR", () => {
    expect(formatMoney(12050, "EUR", "en")).toBe("€120.50");
  });

  it("formats zero cost as EUR", () => {
    expect(formatMoney(0, "EUR", "en")).toBe("€0.00");
  });
});
