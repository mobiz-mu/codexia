import { describe, it, expect } from "vitest";
import {
  buildTimeSlots,
  formatTimeLabel,
  joinDateTimeLocal,
  joinTimeParts,
  parseTimeValue,
  snapToStep,
  splitDateTimeLocal,
  splitTimeValue,
  to12Hour,
  to24Hour,
} from "./time-options";

describe("buildTimeSlots", () => {
  it("produces 48 half-hour slots covering the whole day", () => {
    const slots = buildTimeSlots();
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots[1]).toBe("00:30");
    expect(slots.at(-1)).toBe("23:30");
  });

  it("includes the operating times from the specification", () => {
    const slots = buildTimeSlots();
    for (const t of ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30"]) {
      expect(slots).toContain(t);
    }
  });

  it("never produces an off-grid minute", () => {
    for (const slot of buildTimeSlots()) {
      expect(["00", "30"]).toContain(slot.slice(3));
    }
  });
});

describe("parseTimeValue", () => {
  it("parses well-formed times", () => {
    expect(parseTimeValue("09:30")).toEqual({ hour24: 9, minute: 30 });
    expect(parseTimeValue("23:00")).toEqual({ hour24: 23, minute: 0 });
    expect(parseTimeValue("00:00")).toEqual({ hour24: 0, minute: 0 });
  });

  it("rejects out-of-range and malformed input", () => {
    for (const bad of ["24:00", "12:60", "-1:00", "abc", "", "12", "12:3"]) {
      expect(parseTimeValue(bad)).toBeNull();
    }
  });
});

describe("12/24 hour conversion", () => {
  it("maps midnight and noon correctly", () => {
    expect(to12Hour(0)).toEqual({ hour12: 12, meridiem: "AM" });
    expect(to12Hour(12)).toEqual({ hour12: 12, meridiem: "PM" });
  });

  it("maps the rest of the day", () => {
    expect(to12Hour(9)).toEqual({ hour12: 9, meridiem: "AM" });
    expect(to12Hour(13)).toEqual({ hour12: 1, meridiem: "PM" });
    expect(to12Hour(23)).toEqual({ hour12: 11, meridiem: "PM" });
  });

  it("round-trips every hour of the day", () => {
    for (let hour24 = 0; hour24 < 24; hour24++) {
      const { hour12, meridiem } = to12Hour(hour24);
      expect(to24Hour(hour12, meridiem)).toBe(hour24);
    }
  });
});

describe("splitTimeValue / joinTimeParts", () => {
  it("round-trips every half-hour slot without drift", () => {
    for (const slot of buildTimeSlots()) {
      const parts = splitTimeValue(slot);
      expect(parts).not.toBeNull();
      expect(joinTimeParts(parts!)).toBe(slot);
    }
  });

  it("splits an afternoon time into clock-face parts", () => {
    expect(splitTimeValue("14:30")).toEqual({ hour12: 2, minute: 30, meridiem: "PM" });
  });

  it("returns null for an unparseable value instead of a wrong time", () => {
    expect(splitTimeValue("nonsense")).toBeNull();
  });
});

describe("snapToStep", () => {
  it("leaves an on-grid time untouched", () => {
    expect(snapToStep("09:30")).toBe("09:30");
    expect(snapToStep("00:00")).toBe("00:00");
  });

  it("rounds an off-grid time to the nearest half hour", () => {
    expect(snapToStep("09:10")).toBe("09:00");
    expect(snapToStep("09:20")).toBe("09:30");
    expect(snapToStep("09:44")).toBe("09:30");
    expect(snapToStep("09:46")).toBe("10:00");
  });

  it("rounds exactly halfway up", () => {
    expect(snapToStep("09:15")).toBe("09:30");
  });

  it("never rolls past midnight into the next day", () => {
    expect(snapToStep("23:50")).toBe("23:30");
    expect(snapToStep("23:59")).toBe("23:30");
  });

  it("falls back to midnight for unparseable input rather than throwing", () => {
    expect(snapToStep("")).toBe("00:00");
  });

  it("always lands on a real selectable option", () => {
    const slots = new Set(buildTimeSlots());
    for (let minutes = 0; minutes < 24 * 60; minutes++) {
      const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      expect(slots.has(snapToStep(value))).toBe(true);
    }
  });
});

describe("formatTimeLabel", () => {
  it("renders a clock-face label", () => {
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("09:30")).toBe("9:30 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("14:30")).toBe("2:30 PM");
    expect(formatTimeLabel("23:30")).toBe("11:30 PM");
  });

  it("returns the raw value unchanged when it cannot be parsed", () => {
    expect(formatTimeLabel("oops")).toBe("oops");
  });
});

describe("datetime-local helpers", () => {
  it("splits and rejoins without altering the stored shape", () => {
    const value = "2026-09-01T14:30";
    const { date, time } = splitDateTimeLocal(value);
    expect(date).toBe("2026-09-01");
    expect(time).toBe("14:30");
    expect(joinDateTimeLocal(date, time)).toBe(value);
  });

  it("tolerates a value carrying seconds", () => {
    expect(splitDateTimeLocal("2026-09-01T14:30:00")).toEqual({ date: "2026-09-01", time: "14:30" });
  });

  it("handles an empty value", () => {
    expect(splitDateTimeLocal("")).toEqual({ date: "", time: "" });
    expect(joinDateTimeLocal("", "10:00")).toBe("");
  });

  it("defaults a missing time to midnight so the value stays well-formed", () => {
    expect(joinDateTimeLocal("2026-09-01", "")).toBe("2026-09-01T00:00");
  });
});
