import type { Metadata } from "next";
import { createManualInvoice } from "@/lib/actions/admin/invoices";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export const metadata: Metadata = { title: "New Invoice" };

export default function NewInvoicePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">New Invoice</h1>
      <p className="text-sm text-muted">
        To invoice an existing booking, use the &ldquo;Create Invoice&rdquo; button on the booking&apos;s detail page instead.
        This form creates a standalone manual invoice.
      </p>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <InvoiceForm action={createManualInvoice} submitLabel="Create Invoice" />
      </div>
    </div>
  );
}
