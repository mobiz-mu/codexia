"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePaymentProof, rejectPaymentProof } from "@/lib/actions/admin/payment-proofs";

export function PaymentProofActions({ proofId }: { proofId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approvePaymentProof(proofId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectPaymentProof(proofId, reason);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleApprove}
          className="rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowReject((v) => !v)}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {showReject && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Rejection reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleReject}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60"
          >
            Confirm
          </button>
        </div>
      )}
      {error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}
