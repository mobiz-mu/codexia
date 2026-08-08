import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvoiceAdmin } from "@/lib/actions/admin/invoices";
import { formatMoney } from "@/lib/pricing/format";
import { InvoiceItemsEditor } from "@/components/admin/InvoiceItemsEditor";
import { InvoicePaymentsEditor } from "@/components/admin/InvoicePaymentsEditor";
import { InvoiceActionsPanel } from "@/components/admin/InvoiceActionsPanel";

export const metadata: Metadata = { title: "Invoice Detail" };

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, items, payments } = await getInvoiceAdmin(id);
  if (!invoice) notFound();

  const currency = invoice.currency;
  const editable = invoice.status !== "void";
  const balance = invoice.total_cents - invoice.paid_cents;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{invoice.number}</h1>
          <p className="text-muted">
            {invoice.customer_name} · {invoice.customer_email}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase text-gray-700">
          {invoice.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Line Items</h2>
            <InvoiceItemsEditor invoiceId={invoice.id} items={items} currency={currency} editable={editable} />
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Payments</h2>
            <InvoicePaymentsEditor invoiceId={invoice.id} payments={payments} currency={currency} editable={editable} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Totals</h2>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-right">{formatMoney(invoice.subtotal_cents, currency, "en")}</dd>
              <dt className="text-muted">Tax</dt>
              <dd className="text-right">{formatMoney(invoice.tax_cents, currency, "en")}</dd>
              <dt className="text-muted">Discount</dt>
              <dd className="text-right">-{formatMoney(invoice.discount_cents, currency, "en")}</dd>
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-right font-medium text-ink">{formatMoney(invoice.total_cents, currency, "en")}</dd>
              <dt className="text-muted">Paid</dt>
              <dd className="text-right">{formatMoney(invoice.paid_cents, currency, "en")}</dd>
              <dt className="font-medium text-ink">Balance Due</dt>
              <dd className="text-right font-medium text-ink">{formatMoney(balance, currency, "en")}</dd>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Details</h2>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">Issue Date</dt>
              <dd>{invoice.issue_date}</dd>
              <dt className="text-muted">Due Date</dt>
              <dd>{invoice.due_date}</dd>
              {invoice.booking_id && (
                <>
                  <dt className="text-muted">Booking</dt>
                  <dd>
                    <a href={`/admin/bookings/${invoice.booking_id}`} className="text-action-dark">
                      View booking
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Actions</h2>
            <InvoiceActionsPanel invoiceId={invoice.id} status={invoice.status} storagePath={invoice.storage_path} />
          </section>
        </div>
      </div>
    </div>
  );
}
