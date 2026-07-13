"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateVehicle, archiveVehicle } from "@/lib/actions/admin/vehicles";

export function VehicleRowActions({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateVehicle(vehicleId);
      if (result.ok) router.push(`/admin/vehicles/${result.newId}`);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveVehicle(vehicleId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleDuplicate}
        className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-60"
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={handleArchive}
        className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-60"
      >
        Archive
      </button>
    </div>
  );
}
