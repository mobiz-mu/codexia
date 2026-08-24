import { describe, it, expect } from "vitest";
import {
  OPS_LEGEND_ORDER,
  OPS_STATUS,
  opsStatusForBlock,
  opsStatusForBooking,
} from "./status-config";

describe("OPS_STATUS", () => {
  it("gives every status a label and a glyph so colour is never the only cue", () => {
    for (const def of Object.values(OPS_STATUS)) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.glyph.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it("keys each entry consistently with its record key", () => {
    for (const [key, def] of Object.entries(OPS_STATUS)) {
      expect(def.key).toBe(key);
    }
  });

  it("lists every status in the legend exactly once", () => {
    expect([...OPS_LEGEND_ORDER].sort()).toEqual(Object.keys(OPS_STATUS).sort());
    expect(new Set(OPS_LEGEND_ORDER).size).toBe(OPS_LEGEND_ORDER.length);
  });
});

describe("opsStatusForBooking", () => {
  it("treats confirmed-family statuses as firm bookings", () => {
    for (const status of ["confirmed", "partially_paid", "paid", "vehicle_assigned", "ready_for_pickup", "active"]) {
      expect(opsStatusForBooking(status)).toBe("booked");
    }
  });

  it("treats unpaid-family statuses as quotes", () => {
    for (const status of ["draft", "pending", "awaiting_payment", "payment_proof_submitted", "payment_under_review"]) {
      expect(opsStatusForBooking(status)).toBe("quote");
    }
  });

  it("returns null for terminal statuses so a released vehicle is never painted as busy", () => {
    for (const status of ["cancelled", "no_show", "refunded", "rejected", "completed"]) {
      expect(opsStatusForBooking(status)).toBeNull();
    }
  });

  it("returns null for an unrecognised status rather than guessing", () => {
    expect(opsStatusForBooking("something_new")).toBeNull();
  });

  it("splits firm bookings by channel", () => {
    expect(opsStatusForBooking("confirmed", "web")).toBe("web");
    expect(opsStatusForBooking("confirmed", "agency")).toBe("agency");
    expect(opsStatusForBooking("confirmed", null)).toBe("booked");
  });

  it("keeps an unpaid hold as a quote whatever channel it came from", () => {
    expect(opsStatusForBooking("pending", "web")).toBe("quote");
    expect(opsStatusForBooking("pending", "agency")).toBe("quote");
  });
});

describe("opsStatusForBlock", () => {
  it("maps every block type the database allows", () => {
    expect(opsStatusForBlock("maintenance")).toBe("maintenance");
    expect(opsStatusForBlock("internal")).toBe("maintenance");
    expect(opsStatusForBlock("preparing")).toBe("maintenance");
    expect(opsStatusForBlock("cleaning")).toBe("maintenance");
    expect(opsStatusForBlock("incident")).toBe("incident");
    expect(opsStatusForBlock("stop_sell")).toBe("stop_sell");
  });

  it("falls back to maintenance for an unknown type instead of rendering nothing", () => {
    expect(opsStatusForBlock("future_type")).toBe("maintenance");
  });
});
