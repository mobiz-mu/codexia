"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils/cn";
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
  editHref,
  isEditing,
}: {
  id: string;
  active: boolean;
  canManage: boolean;
  /** Opens the inline editor for this row; null hides the control. */
  editHref?: string | null;
  isEditing?: boolean;
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
    <div className="flex flex-wrap items-center justify-end gap-0.5">
      {error ? <span className="w-full text-right text-[11px] text-ops-booked">{error}</span> : null}

      {editHref ? (
        <Link
          href={editHref}
          scroll={false}
          aria-current={isEditing ? "true" : undefined}
          title="Modify this tariff period"
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
            isEditing
              ? "border-ops-accent bg-ops-accent text-white"
              : "border-ops-line text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
          )}
        >
          Modify
        </Link>
      ) : null}

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
        // Icon rather than a word, as the reference does: three text controls
        // could not fit the actions column and wrapped onto a second line,
        // pushing every row ~30px taller in a table whose whole purpose is
        // density. The accessible name is kept in full.
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete tariff period"
          title="Delete tariff period"
          className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[12px] font-bold leading-none text-ops-booked hover:border-ops-booked hover:bg-ops-booked hover:text-white"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}
