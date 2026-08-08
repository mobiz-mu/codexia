"use client";

import { useActionState, useState } from "react";
import type { MaintenanceFormState } from "@/lib/actions/admin/maintenance";
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_TYPES } from "@/lib/maintenance/schema";

const fieldClass = "rounded-lg border border-border px-3 py-2 text-sm";
const labelClass = "text-sm font-medium text-ink";

type Initial = {
  vehicle_id?: string;
  maintenance_date?: string;
  maintenance_type?: string;
  custom_type?: string | null;
  repairs_performed?: string | null;
  parts_changed?: string | null;
  tyre_changes?: string | null;
  battery_changes?: string | null;
  servicing_details?: string | null;
  oil_filter_changes?: string | null;
  brake_work?: string | null;
  suspension_work?: string | null;
  electrical_work?: string | null;
  mileage_km?: number | null;
  service_provider?: string | null;
  cost_cents?: number;
  remarks?: string | null;
};

const DETAIL_FIELDS: { name: keyof Initial; label: string }[] = [
  { name: "repairs_performed", label: "Repairs performed" },
  { name: "parts_changed", label: "Parts changed" },
  { name: "tyre_changes", label: "Tyre changes" },
  { name: "battery_changes", label: "Battery changes" },
  { name: "servicing_details", label: "Servicing details" },
  { name: "oil_filter_changes", label: "Oil / filter changes" },
  { name: "brake_work", label: "Brake work" },
  { name: "suspension_work", label: "Suspension work" },
  { name: "electrical_work", label: "Electrical work" },
];

const FIELD_NAME_MAP: Record<string, string> = {
  repairs_performed: "repairsPerformed",
  parts_changed: "partsChanged",
  tyre_changes: "tyreChanges",
  battery_changes: "batteryChanges",
  servicing_details: "servicingDetails",
  oil_filter_changes: "oilFilterChanges",
  brake_work: "brakeWork",
  suspension_work: "suspensionWork",
  electrical_work: "electricalWork",
};

export function MaintenanceRecordForm({
  action,
  vehicles,
  initial,
  submitLabel,
}: {
  action: (prev: MaintenanceFormState, formData: FormData) => Promise<MaintenanceFormState>;
  vehicles: { id: string; name: string }[];
  initial?: Initial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as MaintenanceFormState);
  const [maintenanceType, setMaintenanceType] = useState(initial?.maintenance_type ?? MAINTENANCE_TYPES[0]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Vehicle</label>
          <select name="vehicleId" defaultValue={initial?.vehicle_id ?? ""} required className={fieldClass}>
            <option value="" disabled>
              Select a vehicle
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Maintenance date</label>
          <input
            type="date"
            name="maintenanceDate"
            defaultValue={initial?.maintenance_date ?? ""}
            required
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Maintenance type</label>
          <select
            name="maintenanceType"
            defaultValue={initial?.maintenance_type ?? MAINTENANCE_TYPES[0]}
            onChange={(e) => setMaintenanceType(e.target.value)}
            className={fieldClass}
          >
            {MAINTENANCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {MAINTENANCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {maintenanceType === "other" && (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Custom type</label>
            <input
              type="text"
              name="customType"
              defaultValue={initial?.custom_type ?? ""}
              required
              className={fieldClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Mileage at maintenance (km)</label>
          <input
            type="number"
            name="mileageKm"
            min={0}
            defaultValue={initial?.mileage_km ?? undefined}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Garage / service provider</label>
          <input
            type="text"
            name="serviceProvider"
            defaultValue={initial?.service_provider ?? ""}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Total cost</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              €
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="costEur"
              defaultValue={((initial?.cost_cents ?? 0) / 100).toFixed(2)}
              required
              className={`${fieldClass} w-full pl-7`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DETAIL_FIELDS.map(({ name, label }) => (
          <div key={name} className="flex flex-col gap-1">
            <label className={labelClass}>{label}</label>
            <textarea
              name={FIELD_NAME_MAP[name]}
              defaultValue={(initial?.[name] as string | null | undefined) ?? ""}
              rows={2}
              className={fieldClass}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Remarks</label>
        <textarea name="remarks" defaultValue={initial?.remarks ?? ""} rows={3} className={fieldClass} />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="updateVehicleInfo" value="true" className="mt-0.5" />
        <span>
          Update vehicle current service information from this record
          <span className="block text-xs text-muted">
            Sets the vehicle&apos;s last service date to the date above, and its current mileage to the mileage
            above (if provided). Leave unchecked when backfilling an old record.
          </span>
        </span>
      </label>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
