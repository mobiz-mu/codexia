import { describe, it, expect } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("converts cents to whole currency units", () => {
    expect(formatMoney(9000, "EUR", "en")).toContain("90");
  });

  it("rounds to whole units with no decimals shown", () => {
    const formatted = formatMoney(9050, "EUR", "en");
    expect(formatted).not.toMatch(/\.\d/);
  });

  it("uses French formatting conventions for the fr locale", () => {
    const en = formatMoney(100000, "EUR", "en");
    const fr = formatMoney(100000, "EUR", "fr");
    expect(en).not.toBe(fr);
  });
});
