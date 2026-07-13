import { describe, it, expect } from "vitest";
import { calculateBookingPrice, daysBetween } from "./calculate";

describe("daysBetween", () => {
  it("rounds up partial days", () => {
    const pickup = new Date("2026-01-01T10:00:00Z");
    const dropoff = new Date("2026-01-02T09:00:00Z");
    expect(daysBetween(pickup, dropoff)).toBe(1);
  });

  it("never returns less than 1 day", () => {
    const same = new Date("2026-01-01T10:00:00Z");
    expect(daysBetween(same, same)).toBe(1);
  });

  it("counts exactly 3 full days", () => {
    const pickup = new Date("2026-01-01T10:00:00Z");
    const dropoff = new Date("2026-01-04T10:00:00Z");
    expect(daysBetween(pickup, dropoff)).toBe(3);
  });
});

describe("calculateBookingPrice", () => {
  const baseInput = {
    dailyPriceCents: 3000,
    currency: "EUR",
    pickupAt: new Date("2026-01-01T10:00:00Z"),
    returnAt: new Date("2026-01-04T10:00:00Z"),
    pickupDeliveryFeeCents: 0,
    dropoffDeliveryFeeCents: 0,
    depositCents: 50000,
    taxRatePercent: 0,
    extras: [],
  };

  it("multiplies daily rate by number of days", () => {
    const result = calculateBookingPrice(baseInput);
    expect(result.days).toBe(3);
    expect(result.totalCents).toBe(9000);
    expect(result.lineItems).toHaveLength(1);
  });

  it("adds per-day extras multiplied by days and quantity", () => {
    const result = calculateBookingPrice({
      ...baseInput,
      extras: [{ nameEn: "GPS", priceCents: 500, pricingMode: "per_day", quantity: 2 }],
    });
    // 3 days * 500 cents * 2 units = 3000
    expect(result.totalCents).toBe(9000 + 3000);
  });

  it("adds flat extras without multiplying by days", () => {
    const result = calculateBookingPrice({
      ...baseInput,
      extras: [{ nameEn: "SIM Card", priceCents: 1000, pricingMode: "flat", quantity: 1 }],
    });
    expect(result.totalCents).toBe(9000 + 1000);
  });

  it("skips extras with zero or negative quantity", () => {
    const result = calculateBookingPrice({
      ...baseInput,
      extras: [{ nameEn: "GPS", priceCents: 500, pricingMode: "per_day", quantity: 0 }],
    });
    expect(result.totalCents).toBe(9000);
    expect(result.lineItems).toHaveLength(1);
  });

  it("includes delivery fees as a single combined line item", () => {
    const result = calculateBookingPrice({
      ...baseInput,
      pickupDeliveryFeeCents: 1000,
      dropoffDeliveryFeeCents: 1500,
    });
    const deliveryLine = result.lineItems.find((l) => l.key === "delivery");
    expect(deliveryLine?.amountCents).toBe(2500);
    expect(result.totalCents).toBe(9000 + 2500);
  });

  it("applies tax as a percentage of the subtotal", () => {
    const result = calculateBookingPrice({ ...baseInput, taxRatePercent: 15 });
    const taxLine = result.lineItems.find((l) => l.key === "tax");
    expect(taxLine?.amountCents).toBe(Math.round(9000 * 0.15));
    expect(result.totalCents).toBe(9000 + taxLine!.amountCents);
  });

  it("carries the deposit and currency through unchanged", () => {
    const result = calculateBookingPrice(baseInput);
    expect(result.depositCents).toBe(50000);
    expect(result.currency).toBe("EUR");
  });
});
