import { describe, it, expect } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("converts cents to whole currency units", () => {
    expect(formatMoney(9000, "MUR", "en")).toContain("90");
  });

  it("shows rupee cents, because fleet costs reconcile against supplier invoices", () => {
    // Changed deliberately in Phase D: MUR stopped being a legacy display
    // path and became the live currency for fleet running costs, where
    // rendering Rs 1,499.77 as "Rs 1,500" loses real money.
    expect(formatMoney(9050, "MUR", "en")).toBe("Rs 90.50");
    expect(formatMoney(149977, "MUR", "en")).toBe("Rs 1,499.77");
  });

  it("always shows two decimals, even for a round amount", () => {
    expect(formatMoney(9000, "MUR", "en")).toBe("Rs 90.00");
  });

  it("uses French formatting conventions for the fr locale", () => {
    const en = formatMoney(100000, "MUR", "en");
    const fr = formatMoney(100000, "MUR", "fr");
    expect(en).not.toBe(fr);
  });
});

describe("formatMoney — EUR", () => {
  it("shows two decimal places for EN (en-GB grouping, symbol before the amount)", () => {
    const formatted = formatMoney(125000, "EUR", "en");
    expect(formatted).toContain("€");
    expect(formatted).toContain("1,250.00");
  });

  it("shows two decimal places for FR (fr-FR grouping, comma decimal separator)", () => {
    const formatted = formatMoney(125000, "EUR", "fr");
    expect(formatted).toContain("€");
    expect(formatted).toContain("1");
    expect(formatted).toContain("250,00");
  });

  it("never drops cents the way the MUR path does", () => {
    const formatted = formatMoney(100_50, "EUR", "en");
    expect(formatted).toContain("100.50");
  });

  it("never shows the MUR 'Rs' prefix for a EUR amount", () => {
    expect(formatMoney(10000, "EUR", "en")).not.toContain("Rs");
  });
});
