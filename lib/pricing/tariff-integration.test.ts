import { describe, it, expect } from "vitest";

import { calculateBookingPrice, daysBetween } from "./calculate";
import { resolveDailyRate, type TariffPeriod } from "./tariff";

/**
 * End-to-end pricing: tariff resolution feeding the booking total.
 *
 * The unit tests in tariff.test.ts prove the resolver picks the right rate.
 * These prove that rate actually reaches the total, that the provenance is
 * carried into the snapshot a booking stores, and — most importantly — that
 * a rental crossing a season boundary is billed at the pickup period's rate
 * for every one of its days.
 */

const AUG: TariffPeriod = {
  id: "aug",
  vehicleId: "veh-1",
  categoryId: null,
  label: "Peak",
  effectiveFrom: "2026-08-01",
  effectiveTo: "2026-08-31",
  active: true,
  locationIds: [],
  rate1DayCents: 0, // four-night minimum in peak season
  rate3DayCents: 0,
  rate4DayCents: 3000,
  rate7DayCents: 2800,
  rate14DayCents: 2600,
  rate21PlusDayCents: 2400,
};

const SEP: TariffPeriod = {
  ...AUG,
  id: "sep",
  label: "Shoulder",
  effectiveFrom: "2026-09-01",
  effectiveTo: "2026-09-30",
  rate1DayCents: 2500,
  rate3DayCents: 2300,
  rate4DayCents: 2200,
  rate7DayCents: 2000,
  rate14DayCents: 1800,
  rate21PlusDayCents: 1600,
};

function quote(opts: {
  periods: TariffPeriod[];
  pickup: string;
  ret: string;
  fallbackDailyPriceCents?: number;
  taxRatePercent?: number;
}) {
  const pickupAt = new Date(opts.pickup);
  const returnAt = new Date(opts.ret);
  const days = daysBetween(pickupAt, returnAt);

  const rate = resolveDailyRate({
    periods: opts.periods,
    pickupAt,
    days,
    vehicleId: "veh-1",
    categoryId: "cat-1",
    fallbackDailyPriceCents: opts.fallbackDailyPriceCents ?? 1700,
  });

  if (!rate.available) return { rate, breakdown: null as never };

  const breakdown = calculateBookingPrice({
    dailyPriceCents: rate.rateCents,
    currency: "EUR",
    pickupAt,
    returnAt,
    pickupDeliveryFeeCents: 0,
    dropoffDeliveryFeeCents: 0,
    depositCents: 0,
    taxRatePercent: opts.taxRatePercent ?? 0,
    extras: [],
    rate: {
      dailyRateCents: rate.rateCents,
      source: rate.source,
      tariffPeriodId: rate.periodId,
      tariffPeriodLabel: rate.periodLabel,
      durationTier: rate.tier,
    },
  });

  return { rate, breakdown };
}

describe("tariff resolution feeding the booking total", () => {
  it("bills rate x days at the matched tier", () => {
    // 7 nights in September: the 7-day tier at EUR 20.00/day.
    const { breakdown } = quote({ periods: [SEP], pickup: "2026-09-10T08:00:00Z", ret: "2026-09-17T08:00:00Z" });
    expect(breakdown.days).toBe(7);
    expect(breakdown.totalCents).toBe(14000);
    expect(breakdown.lineItems[0]).toMatchObject({ key: "vehicle", amountCents: 14000 });
  });

  it("applies the lower tier rate across every day of a longer rental", () => {
    // 9 nights still sits in the 7-day band, so all 9 days bill at 20.00.
    const { breakdown } = quote({ periods: [SEP], pickup: "2026-09-01T08:00:00Z", ret: "2026-09-10T08:00:00Z" });
    expect(breakdown.days).toBe(9);
    expect(breakdown.totalCents).toBe(18000);
  });

  it("bills a season-crossing rental entirely at the pickup period's rate", () => {
    // Picks up 28 August, returns 4 September: 7 nights, all at the August
    // rate of 28.00 — never a blend, and never September's 20.00.
    const { rate, breakdown } = quote({
      periods: [AUG, SEP],
      pickup: "2026-08-28T08:00:00Z",
      ret: "2026-09-04T08:00:00Z",
    });
    expect(rate).toMatchObject({ available: true, periodId: "aug", rateCents: 2800 });
    expect(breakdown.days).toBe(7);
    expect(breakdown.totalCents).toBe(19600);
    expect(breakdown.totalCents).not.toBe(14000);
  });

  it("carries tariff provenance into the stored pricing snapshot", () => {
    const { breakdown } = quote({ periods: [SEP], pickup: "2026-09-10T08:00:00Z", ret: "2026-09-24T08:00:00Z" });
    expect(breakdown.rate).toEqual({
      dailyRateCents: 1800,
      source: "tariff",
      tariffPeriodId: "sep",
      tariffPeriodLabel: "Shoulder",
      durationTier: 14,
    });
  });

  it("refuses a peak-season rental shorter than the minimum, rather than pricing it", () => {
    for (const [pickup, ret] of [
      ["2026-08-10T08:00:00Z", "2026-08-11T08:00:00Z"],
      ["2026-08-10T08:00:00Z", "2026-08-13T08:00:00Z"],
    ]) {
      const { rate } = quote({ periods: [AUG, SEP], pickup, ret });
      expect(rate).toMatchObject({ available: false, reason: "duration_not_offered" });
    }
  });

  it("sells the same dates once the rental reaches the minimum length", () => {
    const { rate, breakdown } = quote({
      periods: [AUG, SEP],
      pickup: "2026-08-10T08:00:00Z",
      ret: "2026-08-14T08:00:00Z",
    });
    expect(rate).toMatchObject({ available: true, rateCents: 3000, tier: 4 });
    expect(breakdown.totalCents).toBe(12000);
  });

  it("never quotes the legacy flat rate once the vehicle is on tariffs", () => {
    // October is uncovered. The old 17.00/day must not surface.
    const { rate } = quote({
      periods: [AUG, SEP],
      pickup: "2026-10-05T08:00:00Z",
      ret: "2026-10-12T08:00:00Z",
      fallbackDailyPriceCents: 1700,
    });
    expect(rate).toMatchObject({ available: false, reason: "tariff_gap" });
  });

  it("still quotes the legacy flat rate for a vehicle with no tariffs at all", () => {
    const { rate, breakdown } = quote({
      periods: [],
      pickup: "2026-10-05T08:00:00Z",
      ret: "2026-10-12T08:00:00Z",
      fallbackDailyPriceCents: 1700,
    });
    expect(rate).toMatchObject({ available: true, source: "legacy_fallback" });
    expect(breakdown.totalCents).toBe(11900);
    expect(breakdown.rate?.source).toBe("legacy_fallback");
  });

  it("applies tax on top of the tariff subtotal", () => {
    const { breakdown } = quote({
      periods: [SEP],
      pickup: "2026-09-10T08:00:00Z",
      ret: "2026-09-17T08:00:00Z",
      taxRatePercent: 15,
    });
    expect(breakdown.totalCents).toBe(14000 + 2100);
  });

  it("prices from the Mauritius calendar day at a season boundary", () => {
    // 31 Aug 21:00 UTC is 1 Sep 01:00 in Mauritius, so September governs and
    // the customer gets the shoulder rate they would expect from the date on
    // their booking, not the peak rate the UTC date would imply.
    const { rate } = quote({
      periods: [AUG, SEP],
      pickup: "2026-08-31T21:00:00Z",
      ret: "2026-09-07T21:00:00Z",
    });
    expect(rate).toMatchObject({ available: true, periodId: "sep", rateCents: 2000 });
  });
});
