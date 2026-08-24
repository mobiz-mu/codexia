import { describe, it, expect } from "vitest";
import { formatCentsToEuro, parseEuroToCents, readTariffFormData, tariffPeriodSchema } from "./tariff-schema";

const VEHICLE = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: "vehicle",
    vehicleId: VEHICLE,
    label: "High season",
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
    rate1DayCents: "25.00",
    rate3DayCents: "23.00",
    rate4DayCents: "22.00",
    rate7DayCents: "20.00",
    rate14DayCents: "18.00",
    rate21PlusDayCents: "16.00",
    active: "on",
    locationIds: [],
    ...overrides,
  };
}

describe("parseEuroToCents", () => {
  it("converts euro strings to integer cents without floating point drift", () => {
    expect(parseEuroToCents("22.00")).toBe(2200);
    expect(parseEuroToCents("22")).toBe(2200);
    expect(parseEuroToCents("16.90")).toBe(1690);
    expect(parseEuroToCents("0.05")).toBe(5);
    expect(parseEuroToCents("1499.77")).toBe(149977);
  });

  it("accepts a comma decimal separator, as a French keyboard produces", () => {
    expect(parseEuroToCents("16,75")).toBe(1675);
  });

  it("treats blank as zero, which means the duration is not sold", () => {
    expect(parseEuroToCents("")).toBe(0);
    expect(parseEuroToCents("   ")).toBe(0);
    expect(parseEuroToCents(null)).toBe(0);
    expect(parseEuroToCents(undefined)).toBe(0);
  });

  it("rejects malformed and negative amounts rather than coercing them", () => {
    for (const bad of ["abc", "-5", "1.234", "1.2.3", "€22"]) {
      expect(parseEuroToCents(bad)).toBeNull();
    }
  });

  it("round-trips through the display formatter", () => {
    for (const cents of [0, 5, 1690, 2200, 149977]) {
      expect(parseEuroToCents(formatCentsToEuro(cents))).toBe(cents);
    }
  });
});

describe("tariffPeriodSchema", () => {
  it("accepts a well-formed vehicle-scoped period", () => {
    const parsed = tariffPeriodSchema.safeParse(validInput());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rate7DayCents).toBe(2000);
      expect(parsed.data.active).toBe(true);
    }
  });

  it("accepts a category-scoped period", () => {
    const parsed = tariffPeriodSchema.safeParse(
      validInput({ scope: "category", vehicleId: "", categoryId: CATEGORY })
    );
    expect(parsed.success).toBe(true);
  });

  it("requires the id matching the chosen scope", () => {
    expect(tariffPeriodSchema.safeParse(validInput({ vehicleId: "" })).success).toBe(false);
    expect(
      tariffPeriodSchema.safeParse(validInput({ scope: "category", vehicleId: "", categoryId: "" })).success
    ).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const parsed = tariffPeriodSchema.safeParse(
      validInput({ effectiveFrom: "2026-09-30", effectiveTo: "2026-09-01" })
    );
    expect(parsed.success).toBe(false);
  });

  it("accepts a single-day period", () => {
    const parsed = tariffPeriodSchema.safeParse(
      validInput({ effectiveFrom: "2026-12-25", effectiveTo: "2026-12-25" })
    );
    expect(parsed.success).toBe(true);
  });

  it("allows individual zero tiers, which mean that duration is not sold", () => {
    const parsed = tariffPeriodSchema.safeParse(validInput({ rate1DayCents: "0", rate3DayCents: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rate1DayCents).toBe(0);
      expect(parsed.data.rate3DayCents).toBe(0);
    }
  });

  it("rejects a period where every tier is zero, which would sell nothing", () => {
    const allZero = validInput({
      rate1DayCents: "0",
      rate3DayCents: "0",
      rate4DayCents: "0",
      rate7DayCents: "0",
      rate14DayCents: "0",
      rate21PlusDayCents: "0",
    });
    expect(tariffPeriodSchema.safeParse(allZero).success).toBe(false);
  });

  it("rejects a malformed rate instead of silently storing zero", () => {
    expect(tariffPeriodSchema.safeParse(validInput({ rate7DayCents: "twenty" })).success).toBe(false);
  });

  it("treats a missing active checkbox as inactive", () => {
    const parsed = tariffPeriodSchema.safeParse(validInput({ active: undefined }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.active).toBe(false);
  });
});

describe("readTariffFormData", () => {
  it("collects repeated location checkboxes into an array", () => {
    const fd = new FormData();
    fd.set("scope", "vehicle");
    fd.append("locationIds", LOCATION);
    fd.append("locationIds", CATEGORY);
    expect(readTariffFormData(fd).locationIds).toEqual([LOCATION, CATEGORY]);
  });

  it("yields an empty array when no location is ticked, meaning all locations", () => {
    const fd = new FormData();
    fd.set("scope", "vehicle");
    expect(readTariffFormData(fd).locationIds).toEqual([]);
  });
});
