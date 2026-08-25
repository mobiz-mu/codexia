import { describe, it, expect } from "vitest";

import {
  MANUAL_BOOKING_STATUSES,
  MANUAL_PAYMENT_METHODS,
  manualBookingSchema,
  readManualBookingForm,
} from "./manual-schema";

const VEHICLE = "11111111-1111-4111-8111-111111111111";
const LOC_A = "22222222-2222-4222-8222-222222222222";
const LOC_B = "33333333-3333-4333-8333-333333333333";
const EXTRA = "44444444-4444-4444-8444-444444444444";

function valid(over: Record<string, unknown> = {}) {
  return {
    vehicleId: VEHICLE,
    pickupAt: "2027-06-10T09:00",
    returnAt: "2027-06-17T09:00",
    pickupLocationId: LOC_A,
    dropoffLocationId: LOC_B,
    customerName: "Jean Baptiste",
    customerEmail: "",
    customerPhone: "",
    customerCountry: "",
    passengers: "2",
    status: "confirmed",
    paymentMethod: "unpaid",
    ...over,
  };
}

describe("manualBookingSchema", () => {
  it("accepts a minimal counter booking with no email", () => {
    // A walk-in may not have an email; the counter must still be able to book.
    const parsed = manualBookingSchema.safeParse(valid());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.passengers).toBe(2);
  });

  it("rejects a return that is not after the pickup", () => {
    expect(manualBookingSchema.safeParse(valid({ returnAt: "2027-06-10T09:00" })).success).toBe(false);
    expect(manualBookingSchema.safeParse(valid({ returnAt: "2027-06-09T09:00" })).success).toBe(false);
  });

  it("accepts a same-day rental of a few hours", () => {
    const parsed = manualBookingSchema.safeParse(
      valid({ pickupAt: "2027-06-10T09:00", returnAt: "2027-06-10T17:30" })
    );
    expect(parsed.success).toBe(true);
  });

  it("requires a plausible name", () => {
    expect(manualBookingSchema.safeParse(valid({ customerName: "" })).success).toBe(false);
    expect(manualBookingSchema.safeParse(valid({ customerName: "J" })).success).toBe(false);
  });

  it("rejects a malformed email but allows a blank one", () => {
    expect(manualBookingSchema.safeParse(valid({ customerEmail: "nope" })).success).toBe(false);
    expect(manualBookingSchema.safeParse(valid({ customerEmail: "a@b.co" })).success).toBe(true);
    expect(manualBookingSchema.safeParse(valid({ customerEmail: "" })).success).toBe(true);
  });

  it("rejects a datetime without a time component", () => {
    // The 30-minute selector always submits HH:mm; a bare date would silently
    // become midnight and misprice the rental.
    expect(manualBookingSchema.safeParse(valid({ pickupAt: "2027-06-10" })).success).toBe(false);
  });

  it("only accepts statuses staff may open a booking in", () => {
    for (const s of MANUAL_BOOKING_STATUSES) {
      expect(manualBookingSchema.safeParse(valid({ status: s })).success, s).toBe(true);
    }
    for (const s of ["completed", "cancelled", "refunded", "active"]) {
      expect(manualBookingSchema.safeParse(valid({ status: s })).success, s).toBe(false);
    }
  });

  it("only accepts payment methods the bookings table allows", () => {
    for (const m of MANUAL_PAYMENT_METHODS) {
      expect(manualBookingSchema.safeParse(valid({ paymentMethod: m })).success, m).toBe(true);
    }
    // 'cash' and 'card' are deliberately not booking-level methods.
    expect(manualBookingSchema.safeParse(valid({ paymentMethod: "cash" })).success).toBe(false);
  });

  it("bounds driver age and passenger count", () => {
    expect(manualBookingSchema.safeParse(valid({ driverAge: "15" })).success).toBe(false);
    expect(manualBookingSchema.safeParse(valid({ driverAge: "35" })).success).toBe(true);
    expect(manualBookingSchema.safeParse(valid({ passengers: "0" })).success).toBe(false);
    expect(manualBookingSchema.safeParse(valid({ passengers: "12" })).success).toBe(false);
  });

  it("treats an omitted driver age as absent rather than zero", () => {
    const parsed = manualBookingSchema.safeParse(valid({ driverAge: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.driverAge).toBeUndefined();
  });
});

describe("readManualBookingForm", () => {
  it("separates extras from ordinary fields", () => {
    const fd = new FormData();
    fd.set("vehicleId", VEHICLE);
    fd.set("customerName", "Jean");
    fd.set(`extra:${EXTRA}`, "2");
    const { fields, extras } = readManualBookingForm(fd);
    expect(fields.vehicleId).toBe(VEHICLE);
    expect(fields.customerName).toBe("Jean");
    expect(extras).toEqual({ [EXTRA]: 2 });
    expect(fields[`extra:${EXTRA}`]).toBeUndefined();
  });

  it("drops zero and negative extra quantities", () => {
    const fd = new FormData();
    fd.set(`extra:${EXTRA}`, "0");
    fd.set(`extra:${LOC_A}`, "-1");
    expect(readManualBookingForm(fd).extras).toEqual({});
  });

  it("ignores the server-action bookkeeping fields", () => {
    const fd = new FormData();
    fd.set("$ACTION_ID_abc", "x");
    fd.set("vehicleId", VEHICLE);
    const { fields } = readManualBookingForm(fd);
    expect(Object.keys(fields)).toEqual(["vehicleId"]);
  });

  it("ignores a non-numeric extra quantity rather than storing NaN", () => {
    const fd = new FormData();
    fd.set(`extra:${EXTRA}`, "two");
    expect(readManualBookingForm(fd).extras).toEqual({});
  });
});
