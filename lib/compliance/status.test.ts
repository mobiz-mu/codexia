import { describe, it, expect } from "vitest";
import { computeComplianceStatus, isAlarmStatus, COMPLIANCE_STATUS_SORT_ORDER } from "./status";

const TODAY = "2026-03-15";

function expiryDaysFromToday(days: number): string {
  const d = new Date(Date.UTC(2026, 2, 15));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("computeComplianceStatus — exact boundary values", () => {
  it("31 days remaining → valid (just past the 30-day line)", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(31), TODAY);
    expect(r).toEqual({ status: "valid", daysRemaining: 31 });
  });

  it("30 days remaining → warning (\"30 through 8 days\" includes 30)", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(30), TODAY);
    expect(r).toEqual({ status: "warning", daysRemaining: 30 });
  });

  it("8 days remaining → warning (low end of the warning band)", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(8), TODAY);
    expect(r).toEqual({ status: "warning", daysRemaining: 8 });
  });

  it("7 days remaining → urgent (high end of the urgent band)", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(7), TODAY);
    expect(r).toEqual({ status: "urgent", daysRemaining: 7 });
  });

  it("1 day remaining → urgent (low end of the urgent band)", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(1), TODAY);
    expect(r).toEqual({ status: "urgent", daysRemaining: 1 });
  });

  it("0 days remaining (today) → expires_today", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(0), TODAY);
    expect(r).toEqual({ status: "expires_today", daysRemaining: 0 });
  });

  it("yesterday (-1 day) → expired, 1 day overdue", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(-1), TODAY);
    expect(r).toEqual({ status: "expired", daysRemaining: -1 });
  });

  it("far in the past → expired with a large overdue count", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(-400), TODAY);
    expect(r.status).toBe("expired");
    expect(r.daysRemaining).toBe(-400);
  });
});

describe("computeComplianceStatus — date-boundary / timezone / leap-year correctness", () => {
  it("handles a leap-year February 29 → March 1 transition as exactly 1 day", () => {
    // 2028 is a leap year — Feb 29 exists.
    const r = computeComplianceStatus("2028-03-01", "2028-02-29");
    expect(r).toEqual({ status: "urgent", daysRemaining: 1 });
  });

  it("handles a non-leap-year Feb 28 → Mar 1 transition as 1 day (no Feb 29 that year)", () => {
    // 2027 is not a leap year.
    const r = computeComplianceStatus("2027-03-01", "2027-02-28");
    expect(r).toEqual({ status: "urgent", daysRemaining: 1 });
  });

  it("handles a year boundary (Dec 31 → Jan 1) as exactly 1 day", () => {
    const r = computeComplianceStatus("2027-01-01", "2026-12-31");
    expect(r).toEqual({ status: "urgent", daysRemaining: 1 });
  });

  it("is unaffected by a time-of-day component on the expiry timestamp", () => {
    const r = computeComplianceStatus("2026-04-14T23:59:59.999Z", TODAY);
    // 2026-03-15 -> 2026-04-14 is 30 days, regardless of the trailing time.
    expect(r).toEqual({ status: "warning", daysRemaining: 30 });
  });

  it("is unaffected by a time-of-day component on the 'today' reference", () => {
    const r = computeComplianceStatus(expiryDaysFromToday(7), "2026-03-15T08:00:00.000Z");
    expect(r).toEqual({ status: "urgent", daysRemaining: 7 });
  });
});

describe("isAlarmStatus", () => {
  it("valid is not an alarm status", () => {
    expect(isAlarmStatus("valid")).toBe(false);
  });

  it("warning, urgent, expires_today, expired are all alarm statuses", () => {
    expect(isAlarmStatus("warning")).toBe(true);
    expect(isAlarmStatus("urgent")).toBe(true);
    expect(isAlarmStatus("expires_today")).toBe(true);
    expect(isAlarmStatus("expired")).toBe(true);
  });
});

describe("COMPLIANCE_STATUS_SORT_ORDER — expired must sort above upcoming", () => {
  it("orders expired before expires_today before urgent before warning before valid", () => {
    const order: (keyof typeof COMPLIANCE_STATUS_SORT_ORDER)[] = ["expired", "expires_today", "urgent", "warning", "valid"];
    const sorted = [...order].sort((a, b) => COMPLIANCE_STATUS_SORT_ORDER[a] - COMPLIANCE_STATUS_SORT_ORDER[b]);
    expect(sorted).toEqual(order);
  });
});
