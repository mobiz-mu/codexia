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
        className="self-start rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary-dark transition-colors hover:bg-primary-tint disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Closing..." : "Return vehicle to service (close block)"}
      </button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
