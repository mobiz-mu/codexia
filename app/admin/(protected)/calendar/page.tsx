import type { Metadata } from "next";
import Link from "next/link";
import { getCalendarBookings, getCalendarVehicleOptions } from "@/lib/actions/admin/calendar";
import { BookingCalendarGrid } from "@/components/admin/BookingCalendarGrid";

export const metadata: Metadata = { title: "Booking Calendar" };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; vehicle?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth());

  const [events, vehicles] = await Promise.all([
    getCalendarBookings(year, month, params.vehicle),
    getCalendarVehicleOptions(),
  ]);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const vehicleQuery = params.vehicle ? `&vehicle=${params.vehicle}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">
          Booking Calendar — {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?year=${prevYear}&month=${prevMonth}${vehicleQuery}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:border-primary hover:text-primary-dark"
          >
            ← Prev
          </Link>
          <Link
            href={`/admin/calendar?year=${nextYear}&month=${nextMonth}${vehicleQuery}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:border-primary hover:text-primary-dark"
          >
            Next →
          </Link>
        </div>
      </div>

      <form className="flex gap-3">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <select
          name="vehicle"
          defaultValue={params.vehicle ?? ""}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-primary-dark"
        >
          Filter
        </button>
      </form>

      <BookingCalendarGrid year={year} month={month} events={events} />
    </div>
  );
}
