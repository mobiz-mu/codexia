import { describe, it, expect } from "vitest";
import { canTransition } from "./status-machine";

describe("canTransition", () => {
  it("allows a legal forward transition", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "partially_paid")).toBe(true);
    expect(canTransition("partially_paid", "paid")).toBe(true);
  });

  it("rejects skipping backward from a terminal state", () => {
    expect(canTransition("rejected", "confirmed")).toBe(false);
    expect(canTransition("refunded", "paid")).toBe(false);
  });

  it("rejects jumping straight from draft to paid", () => {
    expect(canTransition("draft", "paid")).toBe(false);
  });

  it("allows cancellation from most active states", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("vehicle_assigned", "cancelled")).toBe(true);
  });

  it("rejects an unknown/invalid status pair gracefully", () => {
    // @ts-expect-error deliberately invalid input to prove no throw
    expect(canTransition("not_a_status", "paid")).toBe(false);
  });
});
