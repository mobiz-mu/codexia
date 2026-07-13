import type { Metadata } from "next";
import Link from "next/link";
import { listInvoicesAdmin } from "@/lib/actions/admin/invoices";
import { formatMoney } from "@/lib/pricing/format";

export const metadata: Metadata = { title: "Invoices" };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partially_paid: "bg-amber-100 text-amber-700",
  void: "bg-red-100 text-red-700",
};

export default async function AdminInvoicesPage() {
  const invoices = await listInvoicesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Invoices</h1>
        <Link href="/admin/invoices/new" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
          New Invoice
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Issue Date</th>
              <th className="px-4 py-2">Due Date</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Balance</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-primary-dark">
                    {inv.number}
                  </Link>
                </td>
                <td className="px-4 py-2">{inv.customer_name}</td>
                <td className="px-4 py-2">{inv.issue_date}</td>
                <td className="px-4 py-2">{inv.due_date}</td>
                <td className="px-4 py-2">{formatMoney(inv.total_cents, "EUR", "en")}</td>
                <td className="px-4 py-2">{formatMoney(inv.total_cents - inv.paid_cents, "EUR", "en")}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status] ?? ""}`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
