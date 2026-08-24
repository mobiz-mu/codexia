"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";
import {
  buildTimeSlots,
  joinDateTimeLocal,
  snapToStep,
  splitDateTimeLocal,
  splitTimeValue,
  to24Hour,
  toTimeValue,
  type Meridiem,
} from "@/lib/booking/time-options";

/**
 * Pickup / drop-off picker: a date field beside a half-hour time list and a
 * separate AM/PM control.
 *
 * The browser's own `datetime-local` control was letting customers pick any
 * minute of the day (and rendered as one long, hard-to-read string on
 * mobile). Times now come from a fixed half-hour list, and the clock face is
 * split from the meridiem so there is nothing to misread.
 *
 * A hidden input carries the combined `YYYY-MM-DDTHH:mm` value under the
 * original field name, so every consumer — validation, the availability
 * query, pricing — keeps receiving exactly the shape it already expects.
 */

type Labels = {
  /** Visible label for the whole control, e.g. "Pickup date". */
  field: string;
  date: string;
  time: string;
  meridiem: string;
};

const AM_PM: Meridiem[] = ["AM", "PM"];

/** The 24 clock-face slots inside one meridiem: 12:00, 12:30, 1:00 … 11:30. */
const CLOCK_SLOTS = buildTimeSlots()
  .slice(0, 24)
  .map((value) => {
    const parts = splitTimeValue(value)!;
    return {
      key: toTimeValue(parts.hour12 === 12 ? 0 : parts.hour12, parts.minute),
      hour12: parts.hour12,
      minute: parts.minute,
      label: `${parts.hour12}:${String(parts.minute).padStart(2, "0")}`,
    };
  });

export function DateTimeSelect({
  name,
  id,
  labels,
  defaultValue = "",
  required = false,
  min,
  className,
  fieldClassName,
  labelClassName,
  onChange,
}: {
  name: string;
  id?: string;
  labels: Labels;
  defaultValue?: string;
  required?: boolean;
  /** `YYYY-MM-DD` lower bound for the date field. */
  min?: string;
  className?: string;
  fieldClassName?: string;
  labelClassName?: string;
  onChange?: (value: string) => void;
}) {
  const generatedId = useId();
  const baseId = id ?? `dts-${generatedId}`;

  const initial = useMemo(() => {
    const { date, time } = splitDateTimeLocal(defaultValue);
    // An existing booking may hold an off-grid time from the old control;
    // snapping keeps the select from rendering with nothing chosen.
    const snapped = time ? snapToStep(time) : "";
    const parts = snapped ? splitTimeValue(snapped) : null;
    return {
      date,
      hour12: parts?.hour12 ?? 9,
      minute: parts?.minute ?? 0,
      meridiem: parts?.meridiem ?? ("AM" as Meridiem),
    };
  }, [defaultValue]);

  const [date, setDate] = useState(initial.date);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [meridiem, setMeridiem] = useState<Meridiem>(initial.meridiem);

  const time = toTimeValue(to24Hour(hour12, meridiem), minute);
  const combined = joinDateTimeLocal(date, time);

  function emit(next: string) {
    onChange?.(next);
  }

  const clockKey = toTimeValue(hour12 === 12 ? 0 : hour12, minute);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className={labelClassName} id={`${baseId}-label`}>
        {labels.field}
      </span>

      {/* One value, three controls — the hidden input is what actually submits. */}
      <input type="hidden" name={name} value={combined} />

      <div className="flex min-w-0 gap-1.5" role="group" aria-labelledby={`${baseId}-label`}>
        <input
          id={`${baseId}-date`}
          type="date"
          required={required}
          value={date}
          min={min}
          aria-label={labels.date}
          onChange={(event) => {
            setDate(event.target.value);
            emit(joinDateTimeLocal(event.target.value, time));
          }}
          className={cn(fieldClassName, "min-w-0 flex-[1.4] [color-scheme:light]")}
        />

        <select
          id={`${baseId}-time`}
          aria-label={labels.time}
          value={clockKey}
          onChange={(event) => {
            const slot = CLOCK_SLOTS.find((s) => s.key === event.target.value);
            if (!slot) return;
            setHour12(slot.hour12);
            setMinute(slot.minute);
            emit(joinDateTimeLocal(date, toTimeValue(to24Hour(slot.hour12, meridiem), slot.minute)));
          }}
          className={cn(fieldClassName, "min-w-0 flex-1 cursor-pointer")}
        >
          {CLOCK_SLOTS.map((slot) => (
            <option key={slot.key} value={slot.key}>
              {slot.label}
            </option>
          ))}
        </select>

        <select
          id={`${baseId}-meridiem`}
          aria-label={labels.meridiem}
          value={meridiem}
          onChange={(event) => {
            const next = event.target.value as Meridiem;
            setMeridiem(next);
            emit(joinDateTimeLocal(date, toTimeValue(to24Hour(hour12, next), minute)));
          }}
          className={cn(fieldClassName, "w-[4.5rem] min-w-0 shrink-0 cursor-pointer")}
        >
          {AM_PM.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
