import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { CalendarEvent } from "@/lib/actions/admin/calendar";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  awaiting_payment: "bg-amber-100 text-amber-800",
  payment_proof_submitted: "bg-amber-100 text-amber-800",
  payment_under_review: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  partially_paid: "bg-blue-100 text-blue-800",
  paid: "bg-blue-100 text-blue-800",
  vehicle_assigned: "bg-indigo-100 text-indigo-800",
  ready_for_pickup: "bg-indigo-100 text-indigo-800",
  active: "bg-action/20 text-action-dark",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

export function BookingCalendarGrid({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay();

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const day = new Date(event.date).getUTCDate();
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="p-2 text-center text-xs font-semibold text-muted">
          {d}
        </div>
      ))}
      {cells.map((day, i) => (
        <div
          key={i}
          className={cn(
            "min-h-24 rounded-lg border border-border p-1 text-xs",
            day === null && "border-transparent bg-transparent"
          )}
        >
          {day !== null && (
            <>
              <p className="mb-1 font-medium text-muted">{day}</p>
              <div className="flex flex-col gap-1">
                {(eventsByDay.get(day) ?? []).map((event, j) => (
                  <Link
                    key={j}
                    href={`/admin/bookings/${event.id}`}
                    className={cn(
                      "block truncate rounded px-1.5 py-0.5",
                      STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-700"
                    )}
                    title={`${event.reference} — ${event.vehicleName} (${event.type})`}
                  >
                    {event.type === "pickup" ? "↑" : "↓"} {event.reference}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
