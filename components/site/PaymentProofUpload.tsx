"use client";

import { useActionState } from "react";
import { uploadPaymentProof, type UploadProofState } from "@/lib/actions/my-booking";

const initialState: UploadProofState = { status: "idle" };

export function PaymentProofUpload({
  token,
  labels,
}: {
  token: string;
  labels: {
    title: string;
    bankName: string;
    transactionRef: string;
    date: string;
    file: string;
    submit: string;
    submitted: string;
  };
}) {
  const action = uploadPaymentProof.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "success") {
    return (
      <p className="rounded-lg bg-surface p-4 text-sm text-ink" role="status">
        {labels.submitted}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold text-ink">{labels.title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="proof-bank-name" className="text-sm font-medium text-ink">
            {labels.bankName}
          </label>
          <input
            id="proof-bank-name"
            name="bankName"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="proof-transaction-ref" className="text-sm font-medium text-ink">
            {labels.transactionRef}
          </label>
          <input
            id="proof-transaction-ref"
            name="transactionRef"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="proof-date" className="text-sm font-medium text-ink">
            {labels.date}
          </label>
          <input
            id="proof-date"
            name="paymentDate"
            type="date"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="proof-file" className="text-sm font-medium text-ink">
            {labels.file}
          </label>
          <input
            id="proof-file"
            name="proof"
            type="file"
            accept="application/pdf,image/*"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
