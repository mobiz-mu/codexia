/**
 * Half-hour pickup/drop-off time handling.
 *
 * The stored value stays a plain 24-hour `HH:mm` string so everything
 * downstream — the `datetime-local` round trip, Zod validation, the
 * `timestamptz` columns and every price/availability calculation — is
 * unchanged. The AM/PM split exists purely at the presentation layer, so
 * choosing a time can never introduce ambiguity into the data.
 */

export const TIME_STEP_MINUTES = 30;

export type Meridiem = "AM" | "PM";

export type TimeParts = {
  /** 1-12 as displayed on the clock face, never 0. */
  hour12: number;
  minute: number;
  meridiem: Meridiem;
};

/** `["00:00", "00:30", … "23:30"]` — every half hour of the day. */
export function buildTimeSlots(stepMinutes: number = TIME_STEP_MINUTES): string[] {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    slots.push(toTimeValue(Math.floor(minutes / 60), minutes % 60));
  }
  return slots;
}

export function toTimeValue(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeValue(value: string): { hour24: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  return { hour24, minute };
}

export function to12Hour(hour24: number): { hour12: number; meridiem: Meridiem } {
  const meridiem: Meridiem = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, meridiem };
}

export function to24Hour(hour12: number, meridiem: Meridiem): number {
  const normalized = hour12 % 12; // 12 AM -> 0, 12 PM -> 12
  return meridiem === "AM" ? normalized : normalized + 12;
}

export function splitTimeValue(value: string): TimeParts | null {
  const parsed = parseTimeValue(value);
  if (!parsed) return null;
  const { hour12, meridiem } = to12Hour(parsed.hour24);
  return { hour12, minute: parsed.minute, meridiem };
}

export function joinTimeParts(parts: TimeParts): string {
  return toTimeValue(to24Hour(parts.hour12, parts.meridiem), parts.minute);
}

/**
 * Snap an arbitrary time onto the half-hour grid, rounding to the nearest
 * slot. Existing bookings hold minute-level times (the old control allowed
 * them), so opening one in the new selector must land on a real option
 * rather than showing a blank select.
 */
export function snapToStep(value: string, stepMinutes: number = TIME_STEP_MINUTES): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return toTimeValue(0, 0);
  const total = parsed.hour24 * 60 + parsed.minute;
  const snapped = Math.round(total / stepMinutes) * stepMinutes;
  // A 23:50 time rounds up to 24:00, which is the next day — clamp to the
  // last slot of the same day rather than silently shifting the date.
  const clamped = Math.min(snapped, 24 * 60 - stepMinutes);
  return toTimeValue(Math.floor(clamped / 60), clamped % 60);
}

/** `"14:30"` -> `"2:30 PM"`. Locale-independent by design: the AM/PM control shows the same tokens in EN and FR. */
export function formatTimeLabel(value: string): string {
  const parts = splitTimeValue(value);
  if (!parts) return value;
  return `${parts.hour12}:${String(parts.minute).padStart(2, "0")} ${parts.meridiem}`;
}

/** Split a `datetime-local` value into its date and time halves. */
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function joinDateTimeLocal(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}
