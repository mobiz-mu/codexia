import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers } from "@/lib/actions/admin/customers";
import { formatMoney } from "@/lib/pricing/format";

export const metadata: Metadata = { title: "Customers" };

// EUR is the live business currency; any other currency present (MUR, from
// bookings created before the EUR-pricing migration) is historical and
// shown separately rather than being summed into the same total.
function TotalSpent({ byCurrency }: { byCurrency: Record<string, number> }) {
  const primary = formatMoney(byCurrency.EUR ?? 0, "EUR", "en");
  const historical = Object.entries(byCurrency).filter(([currency, cents]) => currency !== "EUR" && cents !== 0);
  return (
    <>
      {primary}
      {historical.length > 0 && (
        <span className="ml-1 text-xs text-muted">
          + {historical.map(([currency, cents]) => formatMoney(cents, currency, "en")).join(", ")}
        </span>
      )}
    </>
  );
}

export default async function AdminCustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Customers</h1>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">Bookings</th>
              <th className="px-4 py-2">Total Spent</th>
              <th className="px-4 py-2">Last Booking</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2 font-medium text-ink">{c.fullName}</td>
                <td className="px-4 py-2">{c.email}</td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.country}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary-dark">
                    {c.bookingCount}
                  </span>
                </td>
                <td className="px-4 py-2 font-medium text-action-dark">
                  <TotalSpent byCurrency={c.totalCentsByCurrency} />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/admin/bookings`} className="font-medium text-primary-dark hover:underline">
                    {c.lastReference}
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
