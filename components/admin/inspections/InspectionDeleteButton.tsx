"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteInspection } from "@/lib/actions/admin/inspections";

/**
 * Only a draft, unapproved inspection can be deleted, so this is rendered
 * only for those. The server refuses anything else regardless.
 */
export function InspectionDeleteButton({ inspectionId, redirectTo }: { inspectionId: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-label="Delete draft inspection"
        title="Delete draft inspection"
        onClick={() => {
          if (!confirm("Delete this draft inspection? This cannot be undone.")) return;
          setError(null);
          start(async () => {
            const res = await deleteInspection(inspectionId);
            if (!res.ok) setError(res.error ?? "Failed to delete.");
            else if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}
        className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[12px] font-bold leading-none text-ops-danger hover:border-ops-danger hover:bg-ops-danger hover:text-white disabled:pointer-events-none disabled:opacity-50"
      >
        <span aria-hidden="true">✕</span>
      </button>
      {error ? (
        <span className="text-[10px] text-ops-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
