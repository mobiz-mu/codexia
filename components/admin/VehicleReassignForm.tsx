"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignVehicle } from "@/lib/actions/admin/bookings";

export function VehicleReassignForm({
  bookingId,
  currentVehicleId,
  options,
}: {
  bookingId: string;
  currentVehicleId: string | null;
  options: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(currentVehicleId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || vehicleId === currentVehicleId) return;
    setError(null);
    startTransition(async () => {
      const result = await reassignVehicle(bookingId, vehicleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select
        value={vehicleId}
        onChange={(e) => setVehicleId(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Choose a vehicle...
        </option>
        {options.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !vehicleId || vehicleId === currentVehicleId}
        className="self-start rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Reassigning..." : "Reassign Vehicle"}
      </button>
    </form>
  );
}
