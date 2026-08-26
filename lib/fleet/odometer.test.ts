import { describe, it, expect } from "vitest";
import { checkOdometerAgainstHistory, type OdometerReading } from "./odometer";

const fuel = (recordedOn: string, odometerKm: number): OdometerReading => ({
  recordedOn,
  odometerKm,
  source: "fuel",
});
const maint = (recordedOn: string, odometerKm: number): OdometerReading => ({
  recordedOn,
  odometerKm,
  source: "maintenance",
});
const insp = (recordedOn: string, odometerKm: number): OdometerReading => ({
  recordedOn,
  odometerKm,
  source: "inspection",
});

describe("checkOdometerAgainstHistory", () => {
  it("accepts a forward reading with no history at all", () => {
    expect(checkOdometerAgainstHistory({ odometerKm: 50_000, recordedOn: "2026-09-14", existing: [] })).toEqual({
      ok: true,
    });
  });

  it("accepts a reading above every earlier one", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_500,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-01", 50_000), maint("2026-09-07", 50_200)],
    });
    expect(result).toEqual({ ok: true });
  });

  // The genuine backwards-history case the rule exists to catch.
  it("rejects a reading below a strictly earlier one", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_000,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-13", 50_050)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("50,050 km on 2026-09-13");
      expect(result.error).toContain("fuel record");
    }
  });

  // The false-rejection case: day granularity cannot order same-day events.
  it("accepts a lower reading recorded the SAME day as a higher one", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_000,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-14", 50_050)],
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts a higher reading recorded the same day as a lower one", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_100,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-14", 50_050)],
    });
    expect(result).toEqual({ ok: true });
  });

  it("still rejects across modules — a maintenance row constrains an inspection", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 49_000,
      recordedOn: "2026-09-14",
      existing: [maint("2026-09-10", 50_000)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("maintenance record");
  });

  it("rejects a backfilled reading above a strictly later one", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 60_000,
      recordedOn: "2026-09-14",
      existing: [insp("2026-09-20", 51_000)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cannot show more kilometres");
  });

  it("accepts a backfilled reading that sits between its neighbours", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_500,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-01", 50_000), insp("2026-09-20", 51_000)],
    });
    expect(result).toEqual({ ok: true });
  });

  // A vehicle can genuinely sit unused for a week.
  it("accepts an equal reading on a later date", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_000,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-07", 50_000)],
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts an equal reading on an earlier date", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_000,
      recordedOn: "2026-09-14",
      existing: [insp("2026-09-20", 50_000)],
    });
    expect(result).toEqual({ ok: true });
  });

  it("uses the HIGHEST earlier reading as the floor, not merely the most recent", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_100,
      recordedOn: "2026-09-14",
      existing: [fuel("2026-09-01", 50_200), fuel("2026-09-10", 50_000)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("50,200");
  });

  it("uses the LOWEST later reading as the ceiling", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 50_900,
      recordedOn: "2026-09-14",
      existing: [insp("2026-09-20", 50_800), fuel("2026-09-25", 51_500)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("50,800");
  });

  it("rejects a negative or non-integer reading", () => {
    expect(checkOdometerAgainstHistory({ odometerKm: -1, recordedOn: "2026-09-14", existing: [] }).ok).toBe(false);
    expect(checkOdometerAgainstHistory({ odometerKm: 1.5, recordedOn: "2026-09-14", existing: [] }).ok).toBe(false);
  });

  it("accepts zero as a legitimate reading for a brand-new vehicle", () => {
    expect(checkOdometerAgainstHistory({ odometerKm: 0, recordedOn: "2026-09-14", existing: [] })).toEqual({
      ok: true,
    });
  });

  /**
   * The scenario the rule was written for, end to end: an undated
   * vehicles.current_mileage_km must never be passed in, so a backfill of an
   * old inspection is not blocked by today's mileage.
   */
  it("permits backfilling an old inspection when only recent readings are higher", () => {
    const result = checkOdometerAgainstHistory({
      odometerKm: 30_000,
      recordedOn: "2025-01-15",
      existing: [fuel("2026-09-01", 50_000), maint("2026-08-01", 49_000)],
    });
    expect(result).toEqual({ ok: true });
  });
});
