import { describe, it, expect } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("converts cents to whole currency units", () => {
    expect(formatMoney(9000, "MUR", "en")).toContain("90");
  });

  it("rounds to whole units with no decimals shown", () => {
    const formatted = formatMoney(9050, "MUR", "en");
    expect(formatted).not.toMatch(/\.\d/);
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
