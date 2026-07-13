"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInvoiceItem, deleteInvoiceItem } from "@/lib/actions/admin/invoices";
import { formatMoney } from "@/lib/pricing/format";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_rate: number;
  discount_cents: number;
  line_total_cents: number;
};

export function InvoiceItemsEditor({
  invoiceId,
  items,
  currency,
  editable,
}: {
  invoiceId: string;
  items: InvoiceItem[];
  currency: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addInvoiceItem(invoiceId, formData);
      if (!result.ok) {
        setError(result.error ?? "Failed to add item.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      await deleteInvoiceItem(invoiceId, itemId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2">Qty</th>
            <th className="px-2 py-2">Unit Price</th>
            <th className="px-2 py-2">Tax %</th>
            <th className="px-2 py-2">Discount</th>
            <th className="px-2 py-2">Total</th>
            {editable && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="px-2 py-2">{item.description}</td>
              <td className="px-2 py-2">{item.quantity}</td>
              <td className="px-2 py-2">{formatMoney(item.unit_price_cents, currency, "en")}</td>
              <td className="px-2 py-2">{item.tax_rate}%</td>
              <td className="px-2 py-2">{formatMoney(item.discount_cents, currency, "en")}</td>
              <td className="px-2 py-2">{formatMoney(item.line_total_cents, currency, "en")}</td>
              {editable && (
                <td className="px-2 py-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-red-600 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-muted">
                No line items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editable && (
        <form ref={formRef} action={handleAdd} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
          <input
            type="text"
            name="description"
            placeholder="Description"
            required
            className="col-span-2 rounded-lg border border-border px-2 py-1.5 text-sm sm:col-span-2"
          />
          <input
            type="number"
            name="quantity"
            placeholder="Qty"
            step="0.01"
            defaultValue={1}
            required
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            name="unitPriceCents"
            placeholder="Unit price (cents)"
            required
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            name="taxRate"
            placeholder="Tax %"
            defaultValue={0}
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            name="discountCents"
            placeholder="Discount (cents)"
            defaultValue={0}
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="col-span-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-6 sm:w-fit"
          >
            {pending ? "Adding..." : "Add Line Item"}
          </button>
        </form>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
