"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIncidentRecord } from "@/lib/actions/admin/incidents";

/**
 * Icon rather than the word "Delete": next to the Open link, two text
 * controls wrapped onto a second line and pushed every row taller in a table
 * whose whole point is density. The accessible name is kept in full.
 */
export function IncidentDeleteButton({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("Delete this incident record? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteIncidentRecord(incidentId);
      if (!result.ok) setError(result.error ?? "Failed to delete.");
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        aria-label="Delete incident record"
        title="Delete incident record"
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
