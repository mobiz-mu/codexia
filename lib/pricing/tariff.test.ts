import { describe, it, expect } from "vitest";
import {
  DURATION_TIERS,
  businessDate,
  isOnTariffs,
  rateForTier,
  resolveDailyRate,
  resolveDurationTier,
  scopedPeriodsFor,
  selectTariffPeriod,
  type TariffPeriod,
} from "./tariff";

const RATES = {
  rate1DayCents: 2500,
  rate3DayCents: 2300,
  rate4DayCents: 2200,
  rate7DayCents: 2000,
  rate14DayCents: 1800,
  rate21PlusDayCents: 1600,
};

function period(overrides: Partial<TariffPeriod> = {}): TariffPeriod {
  return {
    id: "p1",
    vehicleId: "veh-1",
    categoryId: null,
    label: "Base",
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
    active: true,
    locationIds: [],
    ...RATES,
    ...overrides,
  };
}

/** Midday Mauritius, so the UTC/local date is unambiguous unless a test wants it to be. */
function pickupOn(date: string): Date {
  return new Date(`${date}T08:00:00Z`);
}

describe("resolveDurationTier", () => {
  // Exactly the boundary table agreed with the operator.
  const cases: [number, number][] = [
    [1, 1],
    [2, 1],
    [3, 3],
    [4, 4],
    [5, 4],
    [6, 4],
    [7, 7],
    [8, 7],
    [13, 7],
    [14, 14],
    [15, 14],
    [20, 14],
    [21, 21],
    [22, 21],
    [90, 21],
  ];

  for (const [days, expected] of cases) {
    it(`${days} day${days === 1 ? "" : "s"} uses the ${expected}-day tier`, () => {
      expect(resolveDurationTier(days)).toBe(expected);
    });
  }

  it("clamps sub-1-day durations to the 1-day tier rather than returning undefined", () => {
    expect(resolveDurationTier(0)).toBe(1);
    expect(resolveDurationTier(-5)).toBe(1);
  });

  it("only ever returns a declared tier", () => {
    for (let days = 1; days <= 120; days++) {
      expect(DURATION_TIERS).toContain(resolveDurationTier(days));
    }
  });
});

describe("rateForTier", () => {
  it("maps each tier to its own column", () => {
    expect(rateForTier(RATES, 1)).toBe(2500);
    expect(rateForTier(RATES, 3)).toBe(2300);
    expect(rateForTier(RATES, 4)).toBe(2200);
    expect(rateForTier(RATES, 7)).toBe(2000);
    expect(rateForTier(RATES, 14)).toBe(1800);
    expect(rateForTier(RATES, 21)).toBe(1600);
  });
});

describe("businessDate", () => {
  it("uses the Mauritius calendar day, not UTC", () => {
    // 31 Aug 21:00 UTC is already 1 September in Mauritius (UTC+4).
    expect(businessDate(new Date("2026-08-31T21:00:00Z"))).toBe("2026-09-01");
  });

  it("keeps a late-evening local time on the same local day", () => {
    // 1 Sep 19:00 local = 15:00 UTC.
    expect(businessDate(new Date("2026-09-01T15:00:00Z"))).toBe("2026-09-01");
  });

  it("is independent of how the moment was constructed", () => {
    expect(businessDate(new Date(Date.UTC(2026, 8, 15, 6, 0, 0)))).toBe("2026-09-15");
  });
});

describe("selectTariffPeriod", () => {
  const base = { pickupAt: pickupOn("2026-09-10"), vehicleId: "veh-1", categoryId: "cat-1" };

  it("returns the period covering the pickup date", () => {
    const p = period();
    expect(selectTariffPeriod({ ...base, periods: [p] })?.id).toBe("p1");
  });

  it("returns null when no period covers the date", () => {
    const p = period({ effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" });
    expect(selectTariffPeriod({ ...base, periods: [p] })).toBeNull();
  });

  it("includes both inclusive boundary dates", () => {
    const p = period({ effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" });
    expect(selectTariffPeriod({ ...base, periods: [p], pickupAt: pickupOn("2026-09-01") })).not.toBeNull();
    expect(selectTariffPeriod({ ...base, periods: [p], pickupAt: pickupOn("2026-09-30") })).not.toBeNull();
    expect(selectTariffPeriod({ ...base, periods: [p], pickupAt: pickupOn("2026-08-31") })).toBeNull();
    expect(selectTariffPeriod({ ...base, periods: [p], pickupAt: pickupOn("2026-10-01") })).toBeNull();
  });

  it("ignores inactive periods", () => {
    expect(selectTariffPeriod({ ...base, periods: [period({ active: false })] })).toBeNull();
  });

  it("prefers a vehicle-scoped period over a category-scoped one", () => {
    const cat = period({ id: "cat-period", vehicleId: null, categoryId: "cat-1" });
    const veh = period({ id: "veh-period", vehicleId: "veh-1" });
    expect(selectTariffPeriod({ ...base, periods: [cat, veh] })?.id).toBe("veh-period");
    // Order of the input array must not matter.
    expect(selectTariffPeriod({ ...base, periods: [veh, cat] })?.id).toBe("veh-period");
  });

  it("falls back to the category period when the vehicle has none", () => {
    const cat = period({ id: "cat-period", vehicleId: null, categoryId: "cat-1" });
    expect(selectTariffPeriod({ ...base, periods: [cat] })?.id).toBe("cat-period");
  });

  it("does not apply another vehicle's period", () => {
    const other = period({ id: "other", vehicleId: "veh-999" });
    expect(selectTariffPeriod({ ...base, periods: [other] })).toBeNull();
  });

  it("does not apply another category's period", () => {
    const other = period({ id: "other", vehicleId: null, categoryId: "cat-999" });
    expect(selectTariffPeriod({ ...base, periods: [other] })).toBeNull();
  });

  it("applies a location-scoped period only at that location", () => {
    const p = period({ locationIds: ["loc-airport"] });
    expect(selectTariffPeriod({ ...base, periods: [p], pickupLocationId: "loc-airport" })?.id).toBe("p1");
    expect(selectTariffPeriod({ ...base, periods: [p], pickupLocationId: "loc-town" })).toBeNull();
    expect(selectTariffPeriod({ ...base, periods: [p], pickupLocationId: null })).toBeNull();
  });

  it("treats an empty location list as applying everywhere", () => {
    const p = period({ locationIds: [] });
    expect(selectTariffPeriod({ ...base, periods: [p], pickupLocationId: "anywhere" })?.id).toBe("p1");
  });

  it("prefers a location-specific grid over an all-location one at the same scope", () => {
    const all = period({ id: "all", locationIds: [] });
    const specific = period({ id: "specific", locationIds: ["loc-airport"] });
    const chosen = selectTariffPeriod({
      ...base,
      periods: [all, specific],
      pickupLocationId: "loc-airport",
    });
    expect(chosen?.id).toBe("specific");
  });

  it("resolves deterministically even if the database somehow held overlapping periods", () => {
    const a = period({ id: "aaa", effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" });
    const b = period({ id: "bbb", effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" });
    const first = selectTariffPeriod({ ...base, periods: [a, b] })?.id;
    const second = selectTariffPeriod({ ...base, periods: [b, a] })?.id;
    expect(first).toBe(second);
  });

  it("prices a season-crossing rental by the pickup date's period", () => {
    const aug = period({ id: "aug", effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31" });
    const sep = period({ id: "sep", effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" });
    // Picks up 28 August, returns in September — August governs.
    const chosen = selectTariffPeriod({ ...base, periods: [aug, sep], pickupAt: pickupOn("2026-08-28") });
    expect(chosen?.id).toBe("aug");
  });
});

describe("isOnTariffs / scopedPeriodsFor", () => {
  const base = { vehicleId: "veh-1", categoryId: "cat-1" };

  it("is false with no periods at all", () => {
    expect(isOnTariffs({ ...base, periods: [] })).toBe(false);
  });

  it("is true from a vehicle period, whatever its dates", () => {
    expect(
      isOnTariffs({ ...base, periods: [period({ effectiveFrom: "2020-01-01", effectiveTo: "2020-12-31" })] })
    ).toBe(true);
  });

  it("is true from a category period", () => {
    expect(isOnTariffs({ ...base, periods: [period({ vehicleId: null, categoryId: "cat-1" })] })).toBe(true);
  });

  it("is false for another vehicle's or another category's periods", () => {
    expect(isOnTariffs({ ...base, periods: [period({ vehicleId: "veh-999" })] })).toBe(false);
    expect(
      isOnTariffs({ ...base, periods: [period({ vehicleId: null, categoryId: "cat-999" })] })
    ).toBe(false);
  });

  it("ignores inactive periods", () => {
    expect(isOnTariffs({ ...base, periods: [period({ active: false })] })).toBe(false);
  });

  it("collects both scopes for a vehicle", () => {
    const veh = period({ id: "v", vehicleId: "veh-1" });
    const cat = period({ id: "c", vehicleId: null, categoryId: "cat-1" });
    const other = period({ id: "o", vehicleId: "veh-999" });
    expect(scopedPeriodsFor({ ...base, periods: [veh, cat, other] }).map((p) => p.id).sort()).toEqual(["c", "v"]);
  });

  it("treats a vehicle with no category as on tariffs only via its own periods", () => {
    const cat = period({ vehicleId: null, categoryId: "cat-1" });
    expect(isOnTariffs({ vehicleId: "veh-1", categoryId: null, periods: [cat] })).toBe(false);
  });
});

describe("resolveDailyRate", () => {
  const base = {
    vehicleId: "veh-1",
    categoryId: "cat-1",
    fallbackDailyPriceCents: 1700,
  };

  it("uses the tariff rate for the resolved tier", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [period()],
      pickupAt: pickupOn("2026-09-10"),
      days: 9,
    });
    expect(result).toMatchObject({ available: true, rateCents: 2000, tier: 7, source: "tariff" });
  });

  it("multiplies out to the expected total for a 9-day rental", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [period()],
      pickupAt: pickupOn("2026-09-10"),
      days: 9,
    });
    if (!result.available) throw new Error("expected an available rate");
    expect(result.rateCents * 9).toBe(18000);
  });

  it("treats a zero tier as not offered, never as a free rental", () => {
    // The operator's real July/August pattern: no 1-3 day rentals in peak season.
    const peak = period({ rate1DayCents: 0, rate3DayCents: 0 });
    for (const days of [1, 2, 3]) {
      const result = resolveDailyRate({
        ...base,
        periods: [peak],
        pickupAt: pickupOn("2026-09-10"),
        days,
      });
      expect(result).toMatchObject({ available: false, reason: "duration_not_offered" });
    }
  });

  it("still offers longer durations in a period with zeroed short tiers", () => {
    const peak = period({ rate1DayCents: 0, rate3DayCents: 0 });
    const result = resolveDailyRate({
      ...base,
      periods: [peak],
      pickupAt: pickupOn("2026-09-10"),
      days: 4,
    });
    expect(result).toMatchObject({ available: true, rateCents: 2200, tier: 4 });
  });

  it("never falls back to the flat rate when a zero tier says not offered", () => {
    const peak = period({ rate1DayCents: 0 });
    const result = resolveDailyRate({
      ...base,
      periods: [peak],
      pickupAt: pickupOn("2026-09-10"),
      days: 1,
      fallbackDailyPriceCents: 1700,
    });
    expect(result).toMatchObject({ available: false, reason: "duration_not_offered" });
  });

  it("distinguishes a zero tier from a missing period", () => {
    // Both are unavailable, but only one is a configuration mistake, and the
    // admin needs to be told which.
    const zeroed = resolveDailyRate({
      ...base,
      periods: [period({ rate1DayCents: 0 })],
      pickupAt: pickupOn("2026-09-10"),
      days: 1,
    });
    const gap = resolveDailyRate({
      ...base,
      periods: [period({ effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" })],
      pickupAt: pickupOn("2026-09-10"),
      days: 1,
    });
    expect(zeroed).toMatchObject({ reason: "duration_not_offered" });
    expect(gap).toMatchObject({ reason: "tariff_gap" });
  });

  it("lets a vehicle period rescue a date the category does not cover", () => {
    const catOct = period({ id: "cat", vehicleId: null, categoryId: "cat-1", effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" });
    const vehSep = period({ id: "veh", vehicleId: "veh-1", rate7DayCents: 2600 });
    const result = resolveDailyRate({
      ...base,
      periods: [catOct, vehSep],
      pickupAt: pickupOn("2026-09-10"),
      days: 7,
    });
    expect(result).toMatchObject({ available: true, rateCents: 2600, periodId: "veh" });
  });

  it("prefers the vehicle rate over the category rate on a date both cover", () => {
    const cat = period({ id: "cat", vehicleId: null, categoryId: "cat-1", rate7DayCents: 9900 });
    const veh = period({ id: "veh", vehicleId: "veh-1", rate7DayCents: 2000 });
    const result = resolveDailyRate({
      ...base,
      periods: [cat, veh],
      pickupAt: pickupOn("2026-09-10"),
      days: 7,
    });
    expect(result).toMatchObject({ available: true, rateCents: 2000, periodId: "veh" });
  });

  it("lets a vehicle period zero out a duration the category still sells", () => {
    const cat = period({ id: "cat", vehicleId: null, categoryId: "cat-1", rate1DayCents: 3000 });
    const veh = period({ id: "veh", vehicleId: "veh-1", rate1DayCents: 0 });
    const result = resolveDailyRate({
      ...base,
      periods: [cat, veh],
      pickupAt: pickupOn("2026-09-10"),
      days: 1,
    });
    expect(result).toMatchObject({ available: false, reason: "duration_not_offered", periodId: "veh" });
  });

  it("uses the legacy flat price only while the vehicle has no tariffs at all", () => {
    const result = resolveDailyRate({ ...base, periods: [], pickupAt: pickupOn("2026-09-10"), days: 3 });
    expect(result).toMatchObject({ available: true, rateCents: 1700, source: "legacy_fallback" });
  });

  it("reports a gap instead of the flat price once the vehicle is on tariffs", () => {
    // The vehicle is configured for October but someone asks about September.
    // Quoting 1700 here would silently sell a stale pre-tariff rate.
    const result = resolveDailyRate({
      ...base,
      periods: [period({ effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" })],
      pickupAt: pickupOn("2026-09-10"),
      days: 5,
    });
    expect(result).toMatchObject({ available: false, reason: "tariff_gap" });
  });

  it("reports a gap when only the category is on tariffs and the date is uncovered", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [
        period({ id: "cat", vehicleId: null, categoryId: "cat-1", effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" }),
      ],
      pickupAt: pickupOn("2026-09-10"),
      days: 5,
    });
    expect(result).toMatchObject({ available: false, reason: "tariff_gap" });
  });

  it("reports a gap when the only covering period is scoped to a different location", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [period({ locationIds: ["loc-airport"] })],
      pickupAt: pickupOn("2026-09-10"),
      days: 5,
      pickupLocationId: "loc-town",
    });
    expect(result).toMatchObject({ available: false, reason: "tariff_gap" });
  });

  it("does not treat another vehicle's tariffs as putting this vehicle on tariffs", () => {
    // Only vehicle 999 is configured, so vehicle 1 is still genuinely legacy.
    const result = resolveDailyRate({
      ...base,
      periods: [period({ id: "other", vehicleId: "veh-999" })],
      pickupAt: pickupOn("2026-09-10"),
      days: 5,
    });
    expect(result).toMatchObject({ available: true, source: "legacy_fallback" });
  });

  it("ignores inactive periods when deciding whether a vehicle is on tariffs", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [period({ active: false, effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31" })],
      pickupAt: pickupOn("2026-09-10"),
      days: 5,
    });
    expect(result).toMatchObject({ available: true, source: "legacy_fallback" });
  });

  it("reports no rate configured when there is neither a period nor a flat price", () => {
    const result = resolveDailyRate({
      ...base,
      periods: [],
      pickupAt: pickupOn("2026-09-10"),
      days: 3,
      fallbackDailyPriceCents: 0,
    });
    expect(result).toMatchObject({ available: false, reason: "no_rate_configured" });
  });

  it("prices a season change from the pickup period, not the return period", () => {
    const aug = period({
      id: "aug",
      effectiveFrom: "2026-08-01",
      effectiveTo: "2026-08-31",
      rate7DayCents: 3000,
    });
    const sep = period({
      id: "sep",
      effectiveFrom: "2026-09-01",
      effectiveTo: "2026-09-30",
      rate7DayCents: 2000,
    });
    const result = resolveDailyRate({
      ...base,
      periods: [aug, sep],
      pickupAt: pickupOn("2026-08-28"),
      days: 8,
    });
    expect(result).toMatchObject({ available: true, rateCents: 3000, periodId: "aug" });
  });

  it("uses the Mauritius day when the pickup is late evening UTC", () => {
    const aug = period({ id: "aug", effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", rate7DayCents: 3000 });
    const sep = period({ id: "sep", effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30", rate7DayCents: 2000 });
    // 31 Aug 21:00 UTC == 1 Sep 01:00 in Mauritius, so September governs.
    const result = resolveDailyRate({
      ...base,
      periods: [aug, sep],
      pickupAt: new Date("2026-08-31T21:00:00Z"),
      days: 7,
    });
    expect(result).toMatchObject({ available: true, rateCents: 2000, periodId: "sep" });
  });

  it("gives the same answer for the public and admin paths", () => {
    // Both callers hand the resolver identical inputs; this pins the promise
    // that there is one engine rather than two implementations.
    const args = {
      ...base,
      periods: [period()],
      pickupAt: pickupOn("2026-09-10"),
      days: 14,
    };
    expect(resolveDailyRate({ ...args })).toEqual(resolveDailyRate({ ...args }));
    expect(resolveDailyRate(args)).toMatchObject({ rateCents: 1800, tier: 14 });
  });

  it("applies the 21-plus tier to long rentals without further banding", () => {
    for (const days of [21, 30, 60, 365]) {
      const result = resolveDailyRate({
        ...base,
        periods: [period()],
        pickupAt: pickupOn("2026-09-10"),
        days,
      });
      expect(result).toMatchObject({ available: true, rateCents: 1600, tier: 21 });
    }
  });
});
