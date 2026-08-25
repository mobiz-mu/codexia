import { describe, it, expect } from "vitest";

import {
  checkOdometerProgression,
  deriveFuelMetrics,
  litresFromMl,
  mlFromLitres,
  monthlySpend,
  totalCostCents,
  withFuelMetrics,
  type FuelRecordInput,
} from "./fuel";

function fill(over: Partial<FuelRecordInput> = {}): FuelRecordInput {
  return {
    id: "f1",
    filledAt: "2026-09-01",
    odometerKm: 10000,
    litresMl: 40000, // 40 L
    totalCostCents: 260000, // Rs 2,600.00
    fullTank: true,
    ...over,
  };
}

describe("volume and money conversion", () => {
  it("round-trips litres through millilitres without drift", () => {
    for (const l of [1, 12.5, 40, 45.67, 0.01]) {
      expect(litresFromMl(mlFromLitres(l))).toBeCloseTo(l, 5);
    }
  });

  it("computes a total from litres and unit price in integer minor units", () => {
    // 40 L at Rs 65.00/L = Rs 2,600.00
    expect(totalCostCents(40000, 6500)).toBe(260000);
  });

  it("keeps a fractional-litre total exact", () => {
    // 45.67 L at Rs 64.90/L = Rs 2,963.98 (rounded from 2963.983)
    expect(totalCostCents(45670, 6490)).toBe(296398);
  });

  it("never produces a fractional cent", () => {
    for (const [ml, price] of [[33333, 6499], [1, 1], [99999, 12345]] as const) {
      expect(Number.isInteger(totalCostCents(ml, price))).toBe(true);
    }
  });
});

describe("deriveFuelMetrics", () => {
  it("returns nothing but a reason for the very first fill", () => {
    expect(deriveFuelMetrics(fill(), null)).toEqual({
      distanceKm: null,
      litresPer100Km: null,
      costPerKmCents: null,
      reason: "no_previous_fill",
    });
  });

  it("computes distance, consumption and cost per km between two full tanks", () => {
    const previous = fill({ id: "prev", odometerKm: 10000 });
    const current = fill({ id: "cur", odometerKm: 10500, litresMl: 40000, totalCostCents: 260000 });
    const d = deriveFuelMetrics(current, previous);
    expect(d.distanceKm).toBe(500);
    expect(d.litresPer100Km).toBe(8); // 40 L / 500 km
    expect(d.costPerKmCents).toBe(520); // Rs 2600 / 500 km
    expect(d.reason).toBeNull();
  });

  it("rounds consumption to one decimal", () => {
    const d = deriveFuelMetrics(
      fill({ odometerKm: 10437, litresMl: 41200 }),
      fill({ odometerKm: 10000 })
    );
    // 41.2 L / 437 km * 100 = 9.4279... -> 9.4
    expect(d.litresPer100Km).toBe(9.4);
  });

  it("refuses to state consumption for a part-fill, but still gives distance and cost", () => {
    const d = deriveFuelMetrics(
      fill({ odometerKm: 10500, fullTank: false }),
      fill({ odometerKm: 10000 })
    );
    expect(d.distanceKm).toBe(500);
    expect(d.litresPer100Km).toBeNull();
    expect(d.costPerKmCents).toBe(520);
    expect(d.reason).toBe("partial_fill");
  });

  it("refuses everything when the odometer has not advanced", () => {
    const d = deriveFuelMetrics(fill({ odometerKm: 10000 }), fill({ odometerKm: 10000 }));
    expect(d).toMatchObject({ distanceKm: null, litresPer100Km: null, reason: "odometer_not_advanced" });
  });

  it("refuses everything when the odometer went backwards", () => {
    const d = deriveFuelMetrics(fill({ odometerKm: 9000 }), fill({ odometerKm: 10000 }));
    expect(d).toMatchObject({ distanceKm: null, reason: "odometer_not_advanced" });
  });

  it("never invents a consumption figure", () => {
    // Whatever the shape of the data, an invalid case yields null rather than 0.
    const cases: [FuelRecordInput, FuelRecordInput | null][] = [
      [fill(), null],
      [fill({ odometerKm: 10000 }), fill({ odometerKm: 10000 })],
      [fill({ fullTank: false }), fill({ odometerKm: 9000 })],
    ];
    for (const [cur, prev] of cases) {
      const d = deriveFuelMetrics(cur, prev);
      expect(d.litresPer100Km === null || d.litresPer100Km > 0).toBe(true);
      expect(d.litresPer100Km).not.toBe(0);
    }
  });
});

describe("withFuelMetrics", () => {
  it("orders by odometer, not by entry order", () => {
    const rows = withFuelMetrics([
      fill({ id: "c", odometerKm: 11000, filledAt: "2026-09-20" }),
      fill({ id: "a", odometerKm: 10000, filledAt: "2026-09-01" }),
      fill({ id: "b", odometerKm: 10500, filledAt: "2026-09-10" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows[0].derived.reason).toBe("no_previous_fill");
    expect(rows[1].derived.distanceKm).toBe(500);
    expect(rows[2].derived.distanceKm).toBe(500);
  });

  it("handles a single record", () => {
    const rows = withFuelMetrics([fill()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].derived.reason).toBe("no_previous_fill");
  });

  it("handles an empty set", () => {
    expect(withFuelMetrics([])).toEqual([]);
  });
});

describe("checkOdometerProgression", () => {
  const existing = [
    { odometerKm: 10000, filledAt: "2026-09-01" },
    { odometerKm: 10500, filledAt: "2026-09-10" },
  ];

  it("accepts a reading that continues the sequence", () => {
    expect(checkOdometerProgression({ odometerKm: 11000, filledAt: "2026-09-20", existing })).toEqual({ ok: true });
  });

  it("accepts a reading that fits neatly between two fills", () => {
    expect(checkOdometerProgression({ odometerKm: 10200, filledAt: "2026-09-05", existing })).toEqual({ ok: true });
  });

  it("rejects a reading lower than an earlier fill", () => {
    const r = checkOdometerProgression({ odometerKm: 9000, filledAt: "2026-09-20", existing });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("10,500");
  });

  it("rejects a reading higher than a later fill", () => {
    const r = checkOdometerProgression({ odometerKm: 12000, filledAt: "2026-09-05", existing });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("10,500");
  });

  it("accepts anything as the first record for a vehicle", () => {
    expect(checkOdometerProgression({ odometerKm: 55000, filledAt: "2026-09-01", existing: [] })).toEqual({ ok: true });
  });

  it("allows an identical reading on the same day (two pumps, one stop)", () => {
    expect(
      checkOdometerProgression({ odometerKm: 10500, filledAt: "2026-09-10", existing })
    ).toEqual({ ok: true });
  });
});

describe("monthlySpend", () => {
  it("totals spend per calendar month", () => {
    const m = monthlySpend([
      { filledAt: "2026-09-01", totalCostCents: 260000 },
      { filledAt: "2026-09-20", totalCostCents: 240000 },
      { filledAt: "2026-10-02", totalCostCents: 300000 },
    ]);
    expect(m.get("2026-09")).toBe(500000);
    expect(m.get("2026-10")).toBe(300000);
  });

  it("returns an empty map for no records", () => {
    expect(monthlySpend([]).size).toBe(0);
  });
});
