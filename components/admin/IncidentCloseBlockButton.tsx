"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeIncidentAvailabilityBlock } from "@/lib/actions/admin/incidents";

export function IncidentCloseBlockButton({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!confirm("End this availability block now? The vehicle will become bookable again.")) return;
    setError(null);
    startTransition(async () => {
      const result = await closeIncidentAvailabilityBlock(incidentId);
      if (!result.ok) setError(result.error ?? "Failed to close the block.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClose}
        className="shrink-0 rounded-sm border border-ops-header bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Closing..." : "Return vehicle to service (close block)"}
      </button>
      {error && (
        <p className="text-[12px] font-medium text-ops-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
