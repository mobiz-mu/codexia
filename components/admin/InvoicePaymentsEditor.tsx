"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordInvoicePayment } from "@/lib/actions/admin/invoices";
import { formatMoney } from "@/lib/pricing/format";

type Payment = {
  id: string;
  amount_cents: number;
  method: string;
  note: string | null;
  paid_at: string;
};

export function InvoicePaymentsEditor({
  invoiceId,
  payments,
  currency,
  editable,
}: {
  invoiceId: string;
  payments: Payment[];
  currency: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleRecord(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordInvoicePayment(invoiceId, formData);
      if (!result.ok) {
        setError(result.error ?? "Failed to record payment.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1 text-sm">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between border-b border-border pb-1 last:border-0">
            <span>
              {p.method} {p.note && `— ${p.note}`}
            </span>
            <span className="flex gap-3 text-muted">
              {new Date(p.paid_at).toLocaleDateString("en-GB")}
              <span className="font-medium text-ink">{formatMoney(p.amount_cents, currency, "en")}</span>
            </span>
          </li>
        ))}
        {payments.length === 0 && <li className="text-muted">No payments recorded yet.</li>}
      </ul>

      {editable && (
        <form ref={formRef} action={handleRecord} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
          <input
            type="number"
            name="amountCents"
            placeholder="Amount (cents)"
            required
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <select name="method" required className="rounded-lg border border-border px-2 py-1.5 text-sm">
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            name="note"
            placeholder="Note (optional)"
            className="col-span-2 rounded-lg border border-border px-2 py-1.5 text-sm sm:col-span-1"
          />
          <button
            type="submit"
            disabled={pending}
            className="col-span-2 rounded-full bg-action px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-4 sm:w-fit"
          >
            {pending ? "Recording..." : "Record Payment"}
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
