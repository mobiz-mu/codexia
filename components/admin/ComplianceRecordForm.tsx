"use client";

import { useActionState, useState } from "react";
import type { ComplianceFormState } from "@/lib/actions/admin/compliance";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/compliance/schema";

const fieldClass = "rounded-lg border border-border px-3 py-2 text-sm";
const labelClass = "text-sm font-medium text-ink";

type Initial = {
  vehicle_id?: string;
  document_type?: string;
  custom_type?: string | null;
  reference_number?: string | null;
  provider?: string | null;
  issued_date?: string | null;
  expiry_date?: string;
  cost_cents?: number | null;
  remarks?: string | null;
};

export function ComplianceRecordForm({
  action,
  vehicles,
  initial,
  submitLabel,
}: {
  action: (prev: ComplianceFormState, formData: FormData) => Promise<ComplianceFormState>;
  vehicles: { id: string; name: string }[];
  initial?: Initial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ComplianceFormState);
  const [documentType, setDocumentType] = useState(initial?.document_type ?? DOCUMENT_TYPES[0]);

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
          <label className={labelClass}>Document type</label>
          <select
            name="documentType"
            defaultValue={initial?.document_type ?? DOCUMENT_TYPES[0]}
            onChange={(e) => setDocumentType(e.target.value)}
            className={fieldClass}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {documentType === "other" && (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Custom document type</label>
            <input type="text" name="customType" defaultValue={initial?.custom_type ?? ""} required className={fieldClass} />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Policy / certificate / reference number</label>
          <input type="text" name="referenceNumber" defaultValue={initial?.reference_number ?? ""} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Provider / insurer / authority</label>
          <input type="text" name="provider" defaultValue={initial?.provider ?? ""} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Date issued</label>
          <input type="date" name="issuedDate" defaultValue={initial?.issued_date ?? ""} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Expiry date</label>
          <input type="date" name="expiryDate" defaultValue={initial?.expiry_date ?? ""} required className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Cost (optional)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rs</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="costMur"
              defaultValue={initial?.cost_cents != null ? (initial.cost_cents / 100).toFixed(2) : ""}
              className={`${fieldClass} w-full pl-9`}
            />
          </div>
        </div>
      </div>

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
