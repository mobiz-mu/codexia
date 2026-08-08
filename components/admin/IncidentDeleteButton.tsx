"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIncidentRecord } from "@/lib/actions/admin/incidents";

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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60"
      >
        Delete
      </button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
