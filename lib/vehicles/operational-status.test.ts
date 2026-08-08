import { describe, it, expect } from "vitest";
import { computeOperationalStatus } from "./operational-status";

const now = new Date("2026-06-15T12:00:00Z");

describe("computeOperationalStatus", () => {
  it("returns available when nothing overlaps now", () => {
    expect(computeOperationalStatus({ now, bookings: [], blocks: [] })).toBe("available");
  });

  it("prioritises a maintenance block over any booking", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "active", pickupAt: "2026-06-14T00:00:00Z", returnAt: "2026-06-20T00:00:00Z" }],
      blocks: [{ type: "maintenance", startAt: "2026-06-15T00:00:00Z", endAt: "2026-06-16T00:00:00Z" }],
    });
    expect(status).toBe("maintenance");
  });

  it("returns active_rental for a currently active booking", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "active", pickupAt: "2026-06-14T00:00:00Z", returnAt: "2026-06-20T00:00:00Z" }],
      blocks: [],
    });
    expect(status).toBe("active_rental");
  });

  it("returns returned within 24h of a completed booking's return", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "completed", pickupAt: "2026-06-10T00:00:00Z", returnAt: "2026-06-15T06:00:00Z" }],
      blocks: [],
    });
    expect(status).toBe("returned");
  });

  it("does not return returned once more than 24h have passed", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "completed", pickupAt: "2026-06-05T00:00:00Z", returnAt: "2026-06-10T00:00:00Z" }],
      blocks: [],
    });
    expect(status).toBe("available");
  });

  it("returns reserved for an upcoming confirmed booking within the lookahead window", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "confirmed", pickupAt: "2026-06-20T00:00:00Z", returnAt: "2026-06-25T00:00:00Z" }],
      blocks: [],
    });
    expect(status).toBe("reserved");
  });

  it("ignores a pending booking far in the future", () => {
    const status = computeOperationalStatus({
      now,
      bookings: [{ status: "pending", pickupAt: "2027-01-01T00:00:00Z", returnAt: "2027-01-05T00:00:00Z" }],
      blocks: [],
    });
    expect(status).toBe("available");
  });
});
