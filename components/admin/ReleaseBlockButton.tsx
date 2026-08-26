"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeBlockEarly } from "@/lib/actions/admin/availability";

/**
 * Give a vehicle back to the fleet.
 *
 * The control used to say "Remove" and hard-delete the row, which quietly
 * destroyed downtime a vehicle had genuinely undergone. It now goes through
 * the same release primitive as Maintenance, Incidents and Inspections, so a
 * block that has already started is shortened rather than deleted — and the
 * label says "Release" because that is what happens.
 */
export function ReleaseBlockButton({ blockId }: { blockId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await closeBlockEarly(blockId);
            if (!result.ok) {
              setError(result.error ?? "Could not release this block.");
              return;
            }
            router.refresh();
          })
        }
        className="text-xs font-semibold text-red-600 disabled:opacity-60"
      >
        {pending ? "Releasing…" : "Release"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
