"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceFormState } from "@/lib/actions/admin/invoices";

export function InvoiceForm({
  action,
  submitLabel,
}: {
  action: (prev: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as InvoiceFormState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.invoiceId) {
      router.push(`/admin/invoices/${state.invoiceId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Customer Name</label>
          <input type="text" name="customerName" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Customer Email</label>
          <input type="email" name="customerEmail" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Due Date</label>
          <input type="date" name="dueDate" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Customer Address</label>
        <textarea name="customerAddress" rows={2} className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Terms</label>
        <textarea name="terms" rows={2} className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Notes</label>
        <textarea name="notes" rows={2} className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
