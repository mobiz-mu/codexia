import { describe, it, expect } from "vitest";

import { DEFAULT_PICKUP_TIME, newBookingHref, prefillFromDate } from "./prefill";
import { manualBookingSchema } from "./manual-schema";
import { splitDateTimeLocal, buildTimeSlots } from "./time-options";

describe("prefillFromDate", () => {
  it("defaults to a one-night rental from the clicked day", () => {
    expect(prefillFromDate("2027-06-10")).toEqual({
      pickupAt: "2027-06-10T09:00",
      returnAt: "2027-06-11T09:00",
    });
  });

  it("rolls the return over a month boundary", () => {
    expect(prefillFromDate("2027-06-30").returnAt).toBe("2027-07-01T09:00");
  });

  it("rolls over a year boundary", () => {
    expect(prefillFromDate("2027-12-31").returnAt).toBe("2028-01-01T09:00");
  });

  it("handles a leap day correctly", () => {
    expect(prefillFromDate("2028-02-28").returnAt).toBe("2028-02-29T09:00");
    expect(prefillFromDate("2028-02-29").returnAt).toBe("2028-03-01T09:00");
  });

  it("returns nothing for a missing or malformed date rather than guessing", () => {
    for (const bad of [undefined, null, "", "not-a-date", "10/06/2027", "2027-13-01"]) {
      expect(prefillFromDate(bad as string | undefined)).toEqual({ pickupAt: undefined, returnAt: undefined });
    }
  });

  it("honours a supplied pickup time", () => {
    expect(prefillFromDate("2027-06-10", "14:30")).toEqual({
      pickupAt: "2027-06-10T14:30",
      returnAt: "2027-06-11T14:30",
    });
  });

  it("uses a time the 30-minute selector can actually display", () => {
    expect(buildTimeSlots()).toContain(DEFAULT_PICKUP_TIME);
  });

  it("produces values the manual booking schema accepts", () => {
    // The prefill must not hand the form something its own validation rejects.
    const { pickupAt, returnAt } = prefillFromDate("2027-06-10");
    const parsed = manualBookingSchema.safeParse({
      vehicleId: "11111111-1111-4111-8111-111111111111",
      pickupAt,
      returnAt,
      pickupLocationId: "22222222-2222-4222-8222-222222222222",
      dropoffLocationId: "22222222-2222-4222-8222-222222222222",
      customerName: "Jean Baptiste",
      customerEmail: "",
      passengers: "1",
      status: "confirmed",
      paymentMethod: "unpaid",
    });
    expect(parsed.success).toBe(true);
  });

  it("splits back into the date it came from", () => {
    const { pickupAt } = prefillFromDate("2027-06-10");
    expect(splitDateTimeLocal(pickupAt!)).toEqual({ date: "2027-06-10", time: "09:00" });
  });
});

describe("newBookingHref", () => {
  it("carries the vehicle and day into the manual booking route", () => {
    expect(newBookingHref("veh-1", "2027-06-10")).toBe("/admin/bookings/new?vehicle=veh-1&date=2027-06-10");
  });

  it("escapes ids so a stray character cannot break the query string", () => {
    expect(newBookingHref("a b&c", "2027-06-10")).toContain("vehicle=a+b%26c");
  });
});
