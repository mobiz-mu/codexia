import { describe, it, expect } from "vitest";
import { findNonEurBookingInput } from "./currency-guard";

const EUR_LOCATION = { deliveryFeeCents: 1500, deliveryFeeCurrency: "EUR" };
const MUR_LOCATION = { deliveryFeeCents: 1500, deliveryFeeCurrency: "MUR" };
const FREE_MUR_LOCATION = { deliveryFeeCents: 0, deliveryFeeCurrency: "MUR" };

describe("findNonEurBookingInput", () => {
  it("passes when every input is EUR", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "EUR",
        pickupLocation: EUR_LOCATION,
        dropoffLocation: EUR_LOCATION,
        selectedExtras: [{ currency: "EUR" }],
      })
    ).toBeNull();
  });

  it("rejects a non-EUR vehicle", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "MUR",
        pickupLocation: EUR_LOCATION,
        dropoffLocation: EUR_LOCATION,
        selectedExtras: [],
      })
    ).toBe("vehicle");
  });

  it("rejects a non-EUR pickup location with a non-zero fee", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "EUR",
        pickupLocation: MUR_LOCATION,
        dropoffLocation: EUR_LOCATION,
        selectedExtras: [],
      })
    ).toBe("pickup_location");
  });

  it("rejects a non-EUR dropoff location with a non-zero fee", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "EUR",
        pickupLocation: EUR_LOCATION,
        dropoffLocation: MUR_LOCATION,
        selectedExtras: [],
      })
    ).toBe("dropoff_location");
  });

  it("does NOT reject a non-EUR location whose fee is a genuine zero (free is currency-agnostic)", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "EUR",
        pickupLocation: FREE_MUR_LOCATION,
        dropoffLocation: EUR_LOCATION,
        selectedExtras: [],
      })
    ).toBeNull();
  });

  it("rejects a non-EUR selected extra", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "EUR",
        pickupLocation: EUR_LOCATION,
        dropoffLocation: EUR_LOCATION,
        selectedExtras: [{ currency: "EUR" }, { currency: "MUR" }],
      })
    ).toBe("extra");
  });

  it("checks the vehicle first, before locations or extras", () => {
    expect(
      findNonEurBookingInput({
        vehicleCurrency: "MUR",
        pickupLocation: MUR_LOCATION,
        dropoffLocation: MUR_LOCATION,
        selectedExtras: [{ currency: "MUR" }],
      })
    ).toBe("vehicle");
  });
});
