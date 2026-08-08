import { describe, it, expect } from "vitest";
import { computeDeposit } from "./deposit";

const DEFAULT_TIERS = {
  depositThresholdEurCents: 100_00,
  depositMidTierMaxEurCents: 400_00,
  depositMidTierAmountEurCents: 100_00,
  depositHighTierAmountEurCents: 200_00,
};

describe("computeDeposit — EUR tiered rule, exact boundary values", () => {
  it("€0.01 → full payment (edge of range)", () => {
    const r = computeDeposit({ totalCents: 1, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("full");
    expect(r.amountDueNowCents).toBe(1);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("€99.99 → full payment of €99.99", () => {
    const r = computeDeposit({ totalCents: 99_99, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("full");
    expect(r.amountDueNowCents).toBe(99_99);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("€100.00 → mid tier, €100 deposit", () => {
    const r = computeDeposit({ totalCents: 100_00, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("€100.01 → mid tier, €100 deposit, €0.01 remaining", () => {
    const r = computeDeposit({ totalCents: 100_01, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00);
    expect(r.remainingBalanceCents).toBe(1);
  });

  it("€250.00 → mid tier, €100 deposit, €150 remaining", () => {
    const r = computeDeposit({ totalCents: 250_00, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00);
    expect(r.remainingBalanceCents).toBe(150_00);
  });

  it("€399.99 → mid tier, €100 deposit", () => {
    const r = computeDeposit({ totalCents: 399_99, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00);
    expect(r.remainingBalanceCents).toBe(299_99);
  });

  it("€400.00 → mid tier (inclusive upper boundary), €100 deposit", () => {
    const r = computeDeposit({ totalCents: 400_00, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00);
    expect(r.remainingBalanceCents).toBe(300_00);
  });

  it("€400.01 → high tier, €200 deposit", () => {
    const r = computeDeposit({ totalCents: 400_01, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("high");
    expect(r.amountDueNowCents).toBe(200_00);
    expect(r.remainingBalanceCents).toBe(200_01);
  });

  it("€900.00 → high tier, €200 deposit, €700 remaining", () => {
    const r = computeDeposit({ totalCents: 900_00, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.depositTier).toBe("high");
    expect(r.amountDueNowCents).toBe(200_00);
    expect(r.remainingBalanceCents).toBe(700_00);
  });

  it("bookingTotalCents / depositCents / currency are always present and correct", () => {
    const r = computeDeposit({ totalCents: 250_00, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.bookingTotalCents).toBe(250_00);
    expect(r.currency).toBe("EUR");
    expect(r.depositCents).toBe(r.amountDueNowCents);
  });
});

describe("computeDeposit — genuinely configurable, not secretly hardcoded", () => {
  const CUSTOM_TIERS = {
    depositThresholdEurCents: 120_00,
    depositMidTierMaxEurCents: 500_00,
    depositMidTierAmountEurCents: 150_00,
    depositHighTierAmountEurCents: 250_00,
  };

  it("respects a custom full-payment threshold", () => {
    const r = computeDeposit({ totalCents: 119_99, currency: "EUR", ...CUSTOM_TIERS });
    expect(r.depositTier).toBe("full");
    expect(r.amountDueNowCents).toBe(119_99);
  });

  it("respects a custom mid-tier amount", () => {
    const r = computeDeposit({ totalCents: 300_00, currency: "EUR", ...CUSTOM_TIERS });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(150_00);
  });

  it("respects a custom mid-tier maximum boundary", () => {
    const atMax = computeDeposit({ totalCents: 500_00, currency: "EUR", ...CUSTOM_TIERS });
    expect(atMax.depositTier).toBe("mid");
    const overMax = computeDeposit({ totalCents: 500_01, currency: "EUR", ...CUSTOM_TIERS });
    expect(overMax.depositTier).toBe("high");
  });

  it("respects a custom high-tier amount", () => {
    const r = computeDeposit({ totalCents: 900_00, currency: "EUR", ...CUSTOM_TIERS });
    expect(r.depositTier).toBe("high");
    expect(r.amountDueNowCents).toBe(250_00);
  });
});

describe("computeDeposit — defensive against bad settings/inputs", () => {
  it("never throws or produces a negative deposit with negative settings", () => {
    const r = computeDeposit({
      totalCents: 250_00,
      currency: "EUR",
      depositThresholdEurCents: -100,
      depositMidTierMaxEurCents: -50,
      depositMidTierAmountEurCents: -100_00,
      depositHighTierAmountEurCents: -200_00,
    });
    expect(r.amountDueNowCents).toBeGreaterThanOrEqual(0);
    expect(r.depositCents).toBeGreaterThanOrEqual(0);
    expect(r.remainingBalanceCents).toBeGreaterThanOrEqual(0);
  });

  it("caps a misconfigured deposit amount at the booking total (deposit can never exceed total)", () => {
    // mid-tier deposit set to €500 but the booking itself is only €150 —
    // charging €500 as a "deposit" against a €150 booking would be absurd.
    const r = computeDeposit({
      totalCents: 150_00,
      currency: "EUR",
      depositThresholdEurCents: 100_00,
      depositMidTierMaxEurCents: 400_00,
      depositMidTierAmountEurCents: 500_00,
      depositHighTierAmountEurCents: 200_00,
    });
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(150_00);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("clamps a negative total to zero rather than producing a negative deposit", () => {
    const r = computeDeposit({ totalCents: -500, currency: "EUR", ...DEFAULT_TIERS });
    expect(r.bookingTotalCents).toBe(0);
    expect(r.amountDueNowCents).toBeGreaterThanOrEqual(0);
  });
});

describe("computeDeposit — legacy MUR bridge (pre-migration bookings only)", () => {
  const exchangeRate = 47.5;

  it("applies the same tiers to the EUR-converted total, then converts the deposit back to the booking's own currency", () => {
    const r = computeDeposit({
      totalCents: 9500_00, // €200.00 at rate 47.5
      currency: "MUR",
      legacyExchangeRate: exchangeRate,
      ...DEFAULT_TIERS,
    });
    expect(r.currency).toBe("MUR");
    expect(r.depositTier).toBe("mid");
    expect(r.amountDueNowCents).toBe(100_00); // EUR amount charged via PayPal
    expect(r.depositCents).toBe(Math.round(100_00 * exchangeRate)); // MUR-denominated deposit recorded
    expect(r.remainingBalanceCents).toBe(9500_00 - r.depositCents);
  });

  it("never returns a negative remaining balance", () => {
    const r = computeDeposit({ totalCents: 100, currency: "MUR", legacyExchangeRate: exchangeRate, ...DEFAULT_TIERS });
    expect(r.remainingBalanceCents).toBeGreaterThanOrEqual(0);
  });
});

describe("computeDeposit — EUR-only enforcement", () => {
  it("amountDueNowCents (the PayPal charge) is always EUR-denominated regardless of the booking's own currency", () => {
    const eur = computeDeposit({ totalCents: 250_00, currency: "EUR", ...DEFAULT_TIERS });
    const mur = computeDeposit({ totalCents: 9500_00, currency: "MUR", legacyExchangeRate: 47.5, ...DEFAULT_TIERS });
    // Both represent a "mid tier" booking whose amountDueNowCents is the
    // same real-world EUR figure — the field is unit-consistent across
    // currencies by construction, never re-interpreted.
    expect(eur.amountDueNowCents).toBe(100_00);
    expect(mur.amountDueNowCents).toBe(100_00);
  });
});
