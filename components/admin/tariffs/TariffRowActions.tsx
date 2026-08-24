"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTariffPeriod, toggleTariffPeriodActive } from "@/lib/actions/admin/tariffs";

/**
 * Row controls for a saved period. Deleting asks for confirmation inline
 * rather than via a browser dialog, matching the confirm-in-place pattern
 * already used elsewhere in the admin.
 */
export function TariffRowActions({
  id,
  active,
  canManage,
}: {
  id: string;
  active: boolean;
  canManage: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // revalidatePath on the server marks the route stale but does not re-render
  // the tree already on screen, so without this the deleted row stayed visible
  // and invited a second delete click on a period that was already gone.
  const refresh = () => router.refresh();

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {error ? <span className="w-full text-right text-[11px] text-ops-booked">{error}</span> : null}

      <button
        type="button"
        disabled={pending}
        title={active ? "Deactivate this period" : "Activate this period"}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleTariffPeriodActive(id, !active);
            if (result.status === "error") setError(result.error ?? "Could not update");
            else refresh();
          })
        }
        className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header disabled:opacity-50"
      >
        {active ? "Off" : "On"}
      </button>

      {confirming ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteTariffPeriod(id);
                if (result.status === "error") {
                  setError(result.error ?? "Could not delete");
                  setConfirming(false);
                } else {
                  refresh();
                }
              })
            }
            className="rounded-sm bg-ops-booked px-1.5 py-0.5 text-[11px] font-bold uppercase text-white disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete tariff period"
          className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-booked hover:border-ops-booked"
        >
          Delete
        </button>
      )}
    </div>
  );
}
