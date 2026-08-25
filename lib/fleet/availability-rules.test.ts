import { describe, it, expect } from "vitest";

import {
  blockHoldsVehicle,
  bookingHoldsVehicle,
  classifyMovement,
  isPubliclyBookable,
  overlaps,
} from "./availability-rules";
import { attentionReasons } from "./movements";

const WINDOW = { start: "2027-06-10T08:00:00Z", end: "2027-06-17T08:00:00Z" };

function bookable(over: Partial<Parameters<typeof isPubliclyBookable>[0]> = {}) {
  return isPubliclyBookable({
    vehicle: { status: "active", isStaffCar: false },
    window: WINDOW,
    bookings: [],
    blocks: [],
    ...over,
  });
}

describe("overlaps", () => {
  it("detects a genuine overlap", () => {
    expect(overlaps(WINDOW, { start: "2027-06-12T08:00:00Z", end: "2027-06-14T08:00:00Z" })).toBe(true);
  });

  it("treats a same-instant handover as free, not a clash", () => {
    // Returns 10:00, next rental collects 10:00 — a normal turnaround.
    expect(overlaps(WINDOW, { start: "2027-06-17T08:00:00Z", end: "2027-06-20T08:00:00Z" })).toBe(false);
    expect(overlaps(WINDOW, { start: "2027-06-01T08:00:00Z", end: "2027-06-10T08:00:00Z" })).toBe(false);
  });

  it("detects an overlap of a single instant", () => {
    expect(overlaps(WINDOW, { start: "2027-06-17T07:59:00Z", end: "2027-06-20T08:00:00Z" })).toBe(true);
  });

  it("detects an enclosing interval", () => {
    expect(overlaps(WINDOW, { start: "2027-01-01T00:00:00Z", end: "2028-01-01T00:00:00Z" })).toBe(true);
  });
});

describe("bookingHoldsVehicle", () => {
  it("holds for every live status", () => {
    for (const s of ["pending", "confirmed", "partially_paid", "paid", "vehicle_assigned", "ready_for_pickup", "active"]) {
      expect(bookingHoldsVehicle(s), s).toBe(true);
    }
  });

  it("releases on every terminal status", () => {
    for (const s of ["cancelled", "no_show", "refunded", "rejected", "completed", "draft"]) {
      expect(bookingHoldsVehicle(s), s).toBe(false);
    }
  });
});

describe("isPubliclyBookable", () => {
  it("is bookable when nothing conflicts", () => {
    expect(bookable()).toBe(true);
  });

  it("is blocked by a confirmed booking", () => {
    expect(
      bookable({ bookings: [{ status: "confirmed", start: "2027-06-12T08:00:00Z", end: "2027-06-14T08:00:00Z" }] })
    ).toBe(false);
  });

  it("is blocked by a manual/admin booking exactly as by a website one", () => {
    // Channel is presentation; the hold on the vehicle is identical.
    expect(
      bookable({ bookings: [{ status: "paid", start: "2027-06-11T08:00:00Z", end: "2027-06-13T08:00:00Z" }] })
    ).toBe(false);
  });

  it("is blocked by an unpaid hold", () => {
    expect(
      bookable({ bookings: [{ status: "pending", start: "2027-06-12T08:00:00Z", end: "2027-06-14T08:00:00Z" }] })
    ).toBe(false);
  });

  it("is NOT blocked by a cancelled booking", () => {
    expect(
      bookable({ bookings: [{ status: "cancelled", start: "2027-06-12T08:00:00Z", end: "2027-06-14T08:00:00Z" }] })
    ).toBe(true);
  });

  it("is blocked by incident downtime", () => {
    expect(bookable({ blocks: [{ type: "incident", start: "2027-06-11T00:00:00Z", end: "2027-06-13T00:00:00Z" }] })).toBe(false);
  });

  it("is blocked by maintenance downtime", () => {
    expect(bookable({ blocks: [{ type: "maintenance", start: "2027-06-11T00:00:00Z", end: "2027-06-13T00:00:00Z" }] })).toBe(false);
  });

  it("is blocked by stop-sell", () => {
    expect(bookable({ blocks: [{ type: "stop_sell", start: "2027-06-11T00:00:00Z", end: "2027-06-13T00:00:00Z" }] })).toBe(false);
  });

  it("is blocked by every other internal block type", () => {
    for (const type of ["internal", "preparing", "cleaning"]) {
      expect(
        bookable({ blocks: [{ type, start: "2027-06-11T00:00:00Z", end: "2027-06-13T00:00:00Z" }] }),
        type
      ).toBe(false);
    }
  });

  it("excludes a staff car even with a completely clear diary", () => {
    expect(bookable({ vehicle: { status: "active", isStaffCar: true } })).toBe(false);
  });

  it("excludes a draft or archived vehicle", () => {
    expect(bookable({ vehicle: { status: "draft", isStaffCar: false } })).toBe(false);
    expect(bookable({ vehicle: { status: "archived", isStaffCar: false } })).toBe(false);
  });

  it("stays bookable for an adjacent, non-overlapping booking", () => {
    expect(
      bookable({ bookings: [{ status: "confirmed", start: "2027-06-17T08:00:00Z", end: "2027-06-20T08:00:00Z" }] })
    ).toBe(true);
  });
});

describe("classifyMovement", () => {
  const win = { windowStart: "2027-06-10T00:00:00Z", windowEnd: "2027-06-17T00:00:00Z" };

  it("counts a booking that starts in the window as a departure", () => {
    expect(
      classifyMovement({ pickupAt: "2027-06-11T09:00:00Z", returnAt: "2027-06-25T09:00:00Z", ...win })
    ).toEqual(["departure"]);
  });

  it("counts a booking that ends in the window as a return", () => {
    expect(
      classifyMovement({ pickupAt: "2027-06-01T09:00:00Z", returnAt: "2027-06-12T09:00:00Z", ...win })
    ).toEqual(["return"]);
  });

  it("counts a short booking inside the window as both", () => {
    expect(
      classifyMovement({ pickupAt: "2027-06-11T09:00:00Z", returnAt: "2027-06-14T09:00:00Z", ...win })
    ).toEqual(["departure", "return"]);
  });

  it("ignores a booking that merely spans the window", () => {
    expect(
      classifyMovement({ pickupAt: "2027-05-01T09:00:00Z", returnAt: "2027-07-01T09:00:00Z", ...win })
    ).toEqual([]);
  });

  it("excludes the exclusive window end", () => {
    expect(
      classifyMovement({ pickupAt: "2027-06-17T00:00:00Z", returnAt: "2027-06-20T00:00:00Z", ...win })
    ).toEqual([]);
  });
});

describe("attentionReasons", () => {
  const base = { kind: "departure" as const, status: "confirmed", vehicleName: "Swift", totalCents: 20000, paidCents: 10000 };

  it("stays quiet for a healthy departure", () => {
    expect(attentionReasons(base)).toEqual([]);
  });

  it("flags a departure with no vehicle assigned", () => {
    expect(attentionReasons({ ...base, vehicleName: null })).toContain("No vehicle assigned");
  });

  it("flags an unconfirmed departure", () => {
    expect(attentionReasons({ ...base, status: "pending" })).toContain("Not confirmed");
  });

  it("flags a departure with nothing paid", () => {
    expect(attentionReasons({ ...base, paidCents: 0 })).toContain("No payment recorded");
  });

  it("does not nag about payment on a return", () => {
    // Money owed at the end of a rental is normal; it is not a blocker for
    // receiving the car back.
    expect(attentionReasons({ ...base, kind: "return", paidCents: 0 })).toEqual([]);
  });

  it("still flags a missing vehicle on a return", () => {
    expect(attentionReasons({ ...base, kind: "return", vehicleName: null })).toEqual(["No vehicle assigned"]);
  });

  it("does not flag a zero-total booking as unpaid", () => {
    expect(attentionReasons({ ...base, totalCents: 0, paidCents: 0 })).toEqual([]);
  });
});

describe("blockHoldsVehicle", () => {
  it("recognises every block type the schema allows", () => {
    for (const t of ["maintenance", "internal", "preparing", "cleaning", "incident", "stop_sell"]) {
      expect(blockHoldsVehicle(t), t).toBe(true);
    }
  });

  it("ignores an unknown type rather than blocking on a typo", () => {
    expect(blockHoldsVehicle("something_else")).toBe(false);
  });
});
