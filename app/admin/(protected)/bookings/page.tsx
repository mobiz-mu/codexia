import type { Metadata } from "next";
import Link from "next/link";
import { listBookings } from "@/lib/actions/admin/bookings";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/status-machine";
import { formatMoney } from "@/lib/pricing/format";

export const metadata: Metadata = { title: "Bookings" };

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const bookings = await listBookings({ status, search: q });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Bookings</h1>
      </div>

      <form className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search reference, name, email..."
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary-dark">
                    {b.reference}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {b.booking_customers?.full_name}
                  <div className="text-xs text-muted">{b.booking_customers?.email}</div>
                </td>
                <td className="px-4 py-2">{b.vehicles?.name ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {new Date(b.pickup_at).toLocaleDateString("en-GB")} →{" "}
                  {new Date(b.return_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-2">{BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}</td>
                <td className="px-4 py-2">{formatMoney(b.total_cents, "EUR", "en")}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
