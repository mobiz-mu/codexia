import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TIME_STEP_MINUTES,
  buildTimeSlots,
  formatTimeLabel,
  joinDateTimeLocal,
  snapToStep,
  splitDateTimeLocal,
  splitTimeValue,
  to12Hour,
  to24Hour,
} from "./time-options";

/**
 * The half-hour AM/PM boundaries, and the query-string round trip between the
 * homepage search and the booking wizard.
 *
 * Midnight and noon are where 12-hour clocks go wrong: 12 AM is hour 0 and
 * 12 PM is hour 12, and getting either backwards moves a booking by twelve
 * hours without looking wrong on screen.
 */

const roundTrip = (hour12: number, meridiem: "AM" | "PM", minute: number) => {
  const value = `${String(to24Hour(hour12, meridiem)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const back = splitTimeValue(value)!;
  return { value, back };
};

describe("meridiem boundaries", () => {
  it("12:00 AM is midnight, not noon", () => {
    const { value, back } = roundTrip(12, "AM", 0);
    expect(value).toBe("00:00");
    expect(back).toEqual({ hour12: 12, minute: 0, meridiem: "AM" });
    expect(formatTimeLabel(value)).toBe("12:00 AM");
  });

  it("12:30 AM stays in the first half hour of the day", () => {
    const { value, back } = roundTrip(12, "AM", 30);
    expect(value).toBe("00:30");
    expect(back).toEqual({ hour12: 12, minute: 30, meridiem: "AM" });
    expect(formatTimeLabel(value)).toBe("12:30 AM");
  });

  it("12:00 PM is noon, not midnight", () => {
    const { value, back } = roundTrip(12, "PM", 0);
    expect(value).toBe("12:00");
    expect(back).toEqual({ hour12: 12, minute: 0, meridiem: "PM" });
    expect(formatTimeLabel(value)).toBe("12:00 PM");
  });

  it("12:30 PM is half past noon", () => {
    const { value, back } = roundTrip(12, "PM", 30);
    expect(value).toBe("12:30");
    expect(back).toEqual({ hour12: 12, minute: 30, meridiem: "PM" });
    expect(formatTimeLabel(value)).toBe("12:30 PM");
  });

  it("07:30 AM is the morning slot", () => {
    const { value, back } = roundTrip(7, "AM", 30);
    expect(value).toBe("07:30");
    expect(back).toEqual({ hour12: 7, minute: 30, meridiem: "AM" });
    expect(formatTimeLabel(value)).toBe("7:30 AM");
  });

  it("07:30 PM is the evening slot, twelve hours apart", () => {
    const { value, back } = roundTrip(7, "PM", 30);
    expect(value).toBe("19:30");
    expect(back).toEqual({ hour12: 7, minute: 30, meridiem: "PM" });
    expect(formatTimeLabel(value)).toBe("7:30 PM");
  });

  it("never maps two different clock readings onto the same 24-hour value", () => {
    const seen = new Map<string, string>();
    for (const meridiem of ["AM", "PM"] as const) {
      for (let hour12 = 1; hour12 <= 12; hour12++) {
        for (const minute of [0, 30]) {
          const { value } = roundTrip(hour12, meridiem, minute);
          const label = `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
          expect(seen.has(value)).toBe(false);
          seen.set(value, label);
        }
      }
    }
    expect(seen.size).toBe(48);
  });

  it("round-trips every hour of the day through 12-hour form", () => {
    for (let hour24 = 0; hour24 < 24; hour24++) {
      const { hour12, meridiem } = to12Hour(hour24);
      expect(to24Hour(hour12, meridiem)).toBe(hour24);
    }
  });
});

describe("the half-hour grid", () => {
  it("offers exactly 48 slots, every 30 minutes", () => {
    const slots = buildTimeSlots();
    expect(TIME_STEP_MINUTES).toBe(30);
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots.at(-1)).toBe("23:30");
  });

  it("contains the working-day times an operator would expect", () => {
    const slots = buildTimeSlots();
    for (const t of ["07:30", "08:00", "08:30", "09:00", "12:00", "19:30"]) {
      expect(slots).toContain(t);
    }
  });

  it("offers no off-grid minute", () => {
    for (const slot of buildTimeSlots()) {
      expect(Number(slot.slice(3))).toBeOneOf([0, 30]);
    }
  });

  it("snaps a legacy off-grid time onto the nearest slot", () => {
    expect(snapToStep("09:07")).toBe("09:00");
    expect(snapToStep("09:16")).toBe("09:30");
    expect(snapToStep("09:44")).toBe("09:30");
  });

  it("clamps rather than rolling a late time into the next day", () => {
    // 23:50 rounds to 24:00, which would silently move the booking a day on.
    expect(snapToStep("23:50")).toBe("23:30");
  });
});

describe("query-string round trip: homepage search to the booking wizard", () => {
  /**
   * The homepage submits `pickup`/`return` as `YYYY-MM-DDTHH:mm`; /book reads
   * them server-side into initialCriteria, which seeds the wizard's state on
   * its first render. The chosen time must survive that handoff exactly.
   */
  const handoff = (value: string) => {
    const query = new URLSearchParams({ pickup: value }).toString();
    const received = new URLSearchParams(query).get("pickup") ?? "";
    const { date, time } = splitDateTimeLocal(received);
    return joinDateTimeLocal(date, snapToStep(time));
  };

  it.each([
    ["2026-09-14T00:00", "12:00 AM"],
    ["2026-09-14T00:30", "12:30 AM"],
    ["2026-09-14T07:30", "7:30 AM"],
    ["2026-09-14T12:00", "12:00 PM"],
    ["2026-09-14T12:30", "12:30 PM"],
    ["2026-09-14T19:30", "7:30 PM"],
  ])("carries %s through unchanged", (value, label) => {
    expect(handoff(value)).toBe(value);
    expect(formatTimeLabel(splitDateTimeLocal(value).time)).toBe(label);
  });

  it("does not shift the date when the time is midnight", () => {
    // The classic off-by-one: a 00:00 pickup must stay on its own day.
    expect(splitDateTimeLocal(handoff("2026-09-14T00:00")).date).toBe("2026-09-14");
  });

  it("normalises a legacy off-grid link instead of dropping the value", () => {
    expect(handoff("2026-09-14T09:07")).toBe("2026-09-14T09:00");
  });
});

describe("one implementation, used everywhere", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the booking wizard uses the shared control, not a raw datetime input", () => {
    const step = read("components/booking/steps/SearchStep.tsx");
    expect(step).toContain("DateTimeSelect");
    // The comment mentions the old control by name; the JSX must not.
    expect(step).not.toContain('type="datetime-local"');
  });

  it("the homepage search uses the same control", () => {
    expect(read("components/site/SearchBar.tsx")).toContain("DateTimeSelect");
  });

  it("no second time-conversion implementation exists in the funnel", () => {
    for (const p of ["components/booking/steps/SearchStep.tsx", "components/site/SearchBar.tsx"]) {
      const src = read(p);
      // Conversion belongs to lib/booking/time-options via DateTimeSelect.
      expect(src).not.toContain("to24Hour(");
      expect(src).not.toContain("% 12");
    }
  });
});
