import type { Metadata } from "next";
import Link from "next/link";
import { listInvoicesAdmin } from "@/lib/actions/admin/invoices";
import { formatMoney } from "@/lib/pricing/format";
import { PageHeader, PageHeaderAction } from "@/components/admin/ui/PageHeader";

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
    <div className="flex flex-col gap-5">
      <PageHeader title="Invoices" action={<PageHeaderAction href="/admin/invoices/new">New Invoice</PageHeaderAction>} />

      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
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
              <tr key={inv.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-primary-dark hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td className="px-4 py-2">{inv.customer_name}</td>
                <td className="px-4 py-2">{inv.issue_date}</td>
                <td className="px-4 py-2">{inv.due_date}</td>
                <td className="px-4 py-2 font-medium text-ink">{formatMoney(inv.total_cents, inv.currency, "en")}</td>
                <td className="px-4 py-2 font-medium text-action-dark">
                  {formatMoney(inv.total_cents - inv.paid_cents, inv.currency, "en")}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[inv.status] ?? ""}`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
