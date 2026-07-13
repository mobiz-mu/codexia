import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers } from "@/lib/actions/admin/customers";
import { formatMoney } from "@/lib/pricing/format";

export const metadata: Metadata = { title: "Customers" };

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
              <tr key={c.email} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{c.fullName}</td>
                <td className="px-4 py-2">{c.email}</td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.country}</td>
                <td className="px-4 py-2">{c.bookingCount}</td>
                <td className="px-4 py-2">{formatMoney(c.totalCents, "EUR", "en")}</td>
                <td className="px-4 py-2">
                  <Link href={`/admin/bookings`} className="text-primary-dark">
                    {c.lastReference}
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
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
