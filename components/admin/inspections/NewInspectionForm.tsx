"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { createInspection } from "@/lib/actions/admin/inspections";
import { weekEndingFor } from "@/lib/inspections/schema";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import type { InspectionFormState } from "@/lib/inspections/schema";

const fieldClass =
  "w-full rounded-sm border border-ops-line bg-white px-2 py-1 text-[13px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2";

export type InspectionVehicleOption = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  transmission: "manual" | "automatic" | null;
  internal_registration_ref: string | null;
};

/**
 * The inspection header.
 *
 * Week ending is shown, not entered: it is derived from the inspection date
 * by the Mauritius Monday-Sunday rule, and the server derives it again rather
 * than trusting anything sent here. Registration and make/model are likewise
 * display-only — the server snapshots them from the vehicle record, so a
 * tampered field cannot rewrite what the printed sheet will say.
 */
export function NewInspectionForm({
  vehicles,
  today,
  defaultVehicleId,
  defaultCompanyName,
  inspectorName,
}: {
  vehicles: InspectionVehicleOption[];
  today: string;
  defaultVehicleId?: string;
  defaultCompanyName: string;
  inspectorName: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<InspectionFormState, FormData>(createInspection, { status: "idle" });
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? "");
  const [inspectionDate, setInspectionDate] = useState(today);

  // Straight into the sheet once the header exists — the operator's next
  // action is always to start answering the checklist.
  useEffect(() => {
    if (state.status === "success" && state.inspectionId) {
      router.push(`/admin/inspections/${state.inspectionId}`);
    }
  }, [state, router]);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);
  const weekEnding = useMemo(() => {
    try {
      return weekEndingFor(inspectionDate);
    } catch {
      return "—";
    }
  }, [inspectionDate]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Vehicle identity, so the operator can see the car they are inspecting. */}
        <div className="rounded-sm border border-ops-line bg-ops-panel-2 p-2.5">
          {vehicle ? (
            <VehicleIdentity
              size="lg"
              orientation="stacked"
              vehicle={{
                id: vehicle.id,
                name: vehicle.name,
                subtitle: [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || null,
                transmission: vehicle.transmission,
                registration: vehicle.internal_registration_ref,
              }}
            />
          ) : (
            <p className="text-[12px] text-ops-ink-3">Select a vehicle to see its identity and registration.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Vehicle</span>
            <select
              name="vehicleId"
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.internal_registration_ref ? ` — ${v.internal_registration_ref}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Date of inspection</span>
            <input
              type="date"
              name="inspectionDate"
              required
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              className={fieldClass}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Week ending</span>
            <p className="rounded-sm border border-dashed border-ops-line bg-ops-panel-2 px-2 py-1 text-[13px] tabular-nums text-ops-ink">
              {weekEnding}
            </p>
            <span className="text-[10px] text-ops-ink-3">Derived — Mauritius week, Monday to Sunday</span>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Odometer reading (km)</span>
            <input
              type="number"
              name="odometerKm"
              min={0}
              step={1}
              required
              inputMode="numeric"
              className={fieldClass}
              placeholder="e.g. 50000"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Driver name</span>
            <input name="driverName" className={fieldClass} placeholder="Optional" />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Inspected by</span>
            <input name="inspectorName" defaultValue={inspectorName} className={fieldClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Company</span>
            <input name="companyName" defaultValue={defaultCompanyName} className={fieldClass} />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Defects / repairs required (optional)</span>
            <input name="defectsNotes" className={fieldClass} placeholder="Overall notes; item-level remarks come later" />
          </label>
        </div>
      </div>

      <p className="text-[11px] text-ops-ink-3">
        All 40 checklist items are created unanswered. Nothing is marked Pass until you record it.
      </p>

      {state.status === "error" ? (
        <p role="alert" className="text-[12px] font-medium text-ops-danger">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Start inspection"}
    </button>
  );
}
