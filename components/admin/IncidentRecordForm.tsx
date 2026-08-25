"use client";

import { useActionState, useState } from "react";
import type { IncidentFormState } from "@/lib/actions/admin/incidents";
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
  SEVERITIES,
  SEVERITY_LABELS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  VEHICLE_OPERATIONAL_STATUSES,
  VEHICLE_OPERATIONAL_STATUS_LABELS,
} from "@/lib/incidents/schema";

const fieldClass = "rounded-lg border border-border px-3 py-2 text-sm";
const labelClass = "text-sm font-medium text-ink";
const sectionClass = "flex flex-col gap-4 rounded-xl border border-border p-4";
const sectionTitleClass = "text-sm font-semibold text-ink";

type Initial = {
  vehicle_id?: string;
  incident_date?: string;
  incident_time?: string | null;
  location?: string | null;
  driver_customer_name?: string | null;
  bookings?: { reference: string } | null;
  incident_type?: string;
  custom_type?: string | null;
  accident_description?: string | null;
  damage_description?: string | null;
  affected_areas?: string | null;
  police_report_reference?: string | null;
  insurance_claim_reference?: string | null;
  third_party_details?: string | null;
  estimated_repair_cost_cents?: number | null;
  actual_repair_cost_cents?: number | null;
  vehicle_operational_status?: string;
  repair_status?: string;
  severity?: string;
  date_reported?: string | null;
  date_repair_started?: string | null;
  date_repaired?: string | null;
  downtime_start?: string | null;
  downtime_end?: string | null;
  remarks?: string | null;
};

export function IncidentRecordForm({
  action,
  vehicles,
  initial,
  submitLabel,
}: {
  action: (prev: IncidentFormState, formData: FormData) => Promise<IncidentFormState>;
  vehicles: { id: string; name: string }[];
  initial?: Initial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as IncidentFormState);
  const [incidentType, setIncidentType] = useState(initial?.incident_type ?? INCIDENT_TYPES[0]);
  const [wantsBlock, setWantsBlock] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Basic information</h3>
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
            <label className={labelClass}>Incident date</label>
            <input type="date" name="incidentDate" defaultValue={initial?.incident_date ?? ""} required className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Incident time</label>
            <input type="time" name="incidentTime" defaultValue={initial?.incident_time ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Location</label>
            <input type="text" name="location" defaultValue={initial?.location ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Driver / customer name</label>
            <input type="text" name="driverCustomerName" defaultValue={initial?.driver_customer_name ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Booking reference (optional)</label>
            <input
              type="text"
              name="bookingReference"
              placeholder="e.g. CDX-2026-00042"
              defaultValue={initial?.bookings?.reference ?? ""}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Type &amp; severity</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Incident type</label>
            <select
              name="incidentType"
              defaultValue={initial?.incident_type ?? INCIDENT_TYPES[0]}
              onChange={(e) => setIncidentType(e.target.value)}
              className={fieldClass}
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INCIDENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {incidentType === "other" && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Custom type</label>
              <input type="text" name="customType" defaultValue={initial?.custom_type ?? ""} required className={fieldClass} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Severity</label>
            <select name="severity" defaultValue={initial?.severity ?? "minor"} className={fieldClass}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Vehicle operational status</label>
            <select
              name="vehicleOperationalStatus"
              defaultValue={initial?.vehicle_operational_status ?? "operational"}
              className={fieldClass}
            >
              {VEHICLE_OPERATIONAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {VEHICLE_OPERATIONAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Descriptions</h3>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Accident description</label>
          <textarea name="accidentDescription" defaultValue={initial?.accident_description ?? ""} rows={2} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Damage description</label>
          <textarea name="damageDescription" defaultValue={initial?.damage_description ?? ""} rows={2} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Affected areas</label>
          <textarea
            name="affectedAreas"
            placeholder="e.g. Front bumper, left headlight"
            defaultValue={initial?.affected_areas ?? ""}
            rows={1}
            className={fieldClass}
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>References</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Police report reference</label>
            <input type="text" name="policeReportReference" defaultValue={initial?.police_report_reference ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Insurance claim reference</label>
            <input type="text" name="insuranceClaimReference" defaultValue={initial?.insurance_claim_reference ?? ""} className={fieldClass} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Third-party details</label>
          <textarea name="thirdPartyDetails" defaultValue={initial?.third_party_details ?? ""} rows={2} className={fieldClass} />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Repair costs (Mauritian Rupees)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Estimated repair cost</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rs</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="estimatedRepairCostEur"
                defaultValue={initial?.estimated_repair_cost_cents != null ? (initial.estimated_repair_cost_cents / 100).toFixed(2) : ""}
                className={`${fieldClass} w-full pl-9`}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Actual repair cost</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rs</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="actualRepairCostEur"
                defaultValue={initial?.actual_repair_cost_cents != null ? (initial.actual_repair_cost_cents / 100).toFixed(2) : ""}
                className={`${fieldClass} w-full pl-9`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Repair status &amp; dates</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Repair status</label>
            <select name="repairStatus" defaultValue={initial?.repair_status ?? "reported"} className={fieldClass}>
              {REPAIR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REPAIR_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Date reported</label>
            <input type="date" name="dateReported" defaultValue={initial?.date_reported ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Date repair started</label>
            <input type="date" name="dateRepairStarted" defaultValue={initial?.date_repair_started ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Date repaired</label>
            <input type="date" name="dateRepaired" defaultValue={initial?.date_repaired ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Downtime start</label>
            <input type="date" name="downtimeStart" defaultValue={initial?.downtime_start ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Downtime end</label>
            <input type="date" name="downtimeEnd" defaultValue={initial?.downtime_end ?? ""} className={fieldClass} />
          </div>
        </div>
      </div>

      {!initial && (
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Availability</h3>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="createAvailabilityBlock"
              value="true"
              checked={wantsBlock}
              onChange={(e) => setWantsBlock(e.target.checked)}
            />
            Mark vehicle unavailable / create availability block
          </label>
          {wantsBlock && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Unavailable from</label>
                <input type="datetime-local" name="blockStartAt" required={wantsBlock} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Unavailable until</label>
                <input type="datetime-local" name="blockEndAt" required={wantsBlock} className={fieldClass} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Remarks</label>
        <textarea name="remarks" defaultValue={initial?.remarks ?? ""} rows={3} className={fieldClass} />
      </div>

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
