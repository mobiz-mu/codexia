"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { createFuelRecord, type FuelFormState } from "@/lib/actions/admin/fuel";

const inputClass =
  "w-full rounded-sm border border-ops-line bg-white px-2 py-1 text-[13px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2";

export function FuelRecordForm({
  vehicles,
  canManage,
  defaultVehicleId,
}: {
  vehicles: { id: string; name: string; internal_registration_ref: string | null; is_staff_car: boolean }[];
  canManage: boolean;
  defaultVehicleId?: string;
}) {
  const [state, formAction, pending] = useActionState(createFuelRecord, { status: "idle" } as FuelFormState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Vehicle</span>
          <select name="vehicleId" required defaultValue={defaultVehicleId} className={cn(inputClass, "mt-1")}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.internal_registration_ref ? ` (${v.internal_registration_ref})` : ""}
                {v.is_staff_car ? " · staff" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" name="filledAt" required className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Odometer (km)</span>
          <input name="odometerKm" inputMode="numeric" required placeholder="45000" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Litres</span>
          <input name="litres" inputMode="decimal" required placeholder="40.00" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Rs / litre</span>
          <input name="pricePerLitre" inputMode="decimal" placeholder="65.00" className={cn(inputClass, "mt-1")} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block">
          <span className={labelClass}>Total (Rs)</span>
          <input name="totalCost" inputMode="decimal" placeholder="2600.00" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Station</span>
          <input name="station" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Driver</span>
          <input name="driverName" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className={labelClass}>Receipt ref</span>
          <input name="receiptReference" className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Notes</span>
          <input name="notes" className={cn(inputClass, "mt-1")} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ops-line pt-3">
        <label className="flex items-center gap-1.5 text-[12px] font-medium text-ops-ink-2">
          <input type="checkbox" name="fullTank" defaultChecked />
          Tank filled
        </label>
        <span className="text-[11px] text-ops-ink-3">
          Consumption is only calculated between full tanks — a part-fill measures the pump, not the tank.
        </span>

        <button
          type="submit"
          disabled={pending || !canManage}
          className="ml-auto rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add fuel record"}
        </button>

        {state.status === "error" ? (
          <p role="alert" className="w-full text-[12px] font-medium text-ops-danger">
            {state.error}
          </p>
        ) : null}
        {state.status === "success" ? (
          <p role="status" className="w-full text-[12px] font-medium text-ops-success">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
