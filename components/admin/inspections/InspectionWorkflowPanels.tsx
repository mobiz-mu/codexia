"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DateTimeSelect } from "@/components/booking/DateTimeSelect";
import { formatMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils/cn";
import type { DefectLine } from "@/lib/inspections/presentation";
import {
  approveInspection,
  completeInspection,
  createInspectionDowntime,
  createMaintenanceFromInspection,
  releaseInspectionDowntime,
} from "@/lib/actions/admin/inspections";

const btnPrimary =
  "rounded-sm border border-ops-header bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50";
const btnQuiet =
  "rounded-sm border border-ops-line px-2.5 py-1 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header disabled:opacity-50";
const fieldClass =
  "w-full rounded-sm border border-ops-line bg-white px-2 py-1 text-[13px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2";

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <p role="alert" className="text-[12px] font-medium text-ops-danger">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="text-[12px] font-semibold text-ops-success">
        {success}
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------

/**
 * Completion. The server refuses while anything is unanswered, so the button
 * explains rather than silently failing when the sheet is not finished.
 */
export function CompleteInspectionPanel({
  inspectionId,
  unanswered,
}: {
  inspectionId: string;
  unanswered: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-ops-ink-2">
        {unanswered > 0
          ? `${unanswered} item${unanswered === 1 ? "" : "s"} still unanswered. Every check must have an answer before the inspection can be finished.`
          : "Every item has an answer. Finishing records the derived result; it does not approve the inspection."}
      </p>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending || unanswered > 0}
          title={unanswered > 0 ? `${unanswered} item(s) still unanswered` : undefined}
          onClick={() => {
            setError(null);
            setSuccess(null);
            start(async () => {
              const res = await completeInspection(inspectionId);
              if (!res.ok) setError(res.error ?? "Could not complete the inspection.");
              else setSuccess(`Inspection completed — result: ${res.result}.`);
              router.refresh();
            });
          }}
          className={btnPrimary}
        >
          {pending ? "Completing…" : "Complete inspection"}
        </button>
        <Feedback error={error} success={success} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Fleet-manager sign-off. Rendered only for users holding approve_inspections
 * — the server enforces it too, this just avoids showing a control that would
 * always be refused.
 */
export function InspectionApprovalPanel({
  inspectionId,
  resultLabel,
  canApprove,
}: {
  inspectionId: string;
  resultLabel: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canApprove) {
    return (
      <p className="text-[13px] text-ops-ink-3">
        Sign-off requires the fleet-manager approval permission. This inspection is awaiting review.
      </p>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await approveInspection(inspectionId, { status: "idle" }, fd);
          if (res.status === "error") setError(res.error ?? "Could not approve the inspection.");
          router.refresh();
        });
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-[13px] text-ops-ink-2">
        Approving records that a fleet manager has reviewed this inspection. It does <strong>not</strong> change the
        result — an inspection that failed stays <strong>{resultLabel}</strong> — and it does not clear defects,
        maintenance jobs or downtime.
      </p>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Approval remarks (optional)</span>
        <input name="approvalRemarks" className={fieldClass} placeholder="e.g. Reviewed; car withdrawn until repair" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Approving…" : "Approve inspection"}
        </button>
        <Feedback error={error} success={null} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/**
 * Explicit downtime. A safety-critical failure warns loudly elsewhere on the
 * page but never fires this — an operator decides when a car comes off the
 * road, and supplies the window.
 */
export function InspectionDowntimePanel({
  inspectionId,
  block,
  editable,
}: {
  inspectionId: string;
  block: { id: string; type: string; startAt: string; endAt: string } | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (block) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm bg-ops-incident px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <span aria-hidden="true">!</span> Off road
          </span>
          <span className="text-[13px] tabular-nums text-ops-ink">
            {block.startAt} → {block.endAt}
          </span>
        </div>
        <p className="text-[12px] text-ops-ink-2">
          This inspection is holding the vehicle out of service through the shared availability engine, so public
          search and manual booking both exclude it. Releasing it returns the car from now onwards; downtime already
          served is kept.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Return this vehicle to service now?")) return;
              setError(null);
              start(async () => {
                const res = await releaseInspectionDowntime(inspectionId);
                if (!res.ok) setError(res.error ?? "Could not release the downtime.");
                router.refresh();
              });
            }}
            className={btnPrimary}
          >
            {pending ? "Releasing…" : "Return vehicle to service"}
          </button>
          <Feedback error={error} success={null} />
        </div>
      </div>
    );
  }

  if (!editable) {
    return <p className="text-[13px] text-ops-ink-3">No downtime was raised from this inspection.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-ops-ink-2">
            The vehicle is not blocked by this inspection. Nothing is taken off the road automatically.
          </p>
          <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
            Mark vehicle unavailable
          </button>
        </div>
      ) : (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              const res = await createInspectionDowntime(inspectionId, { status: "idle" }, fd);
              if (res.status === "error") setError(res.error ?? "Could not create the downtime.");
              else setOpen(false);
              router.refresh();
            });
          }}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DateTimeSelect
              name="startAt"
              labels={{ field: "Off road from", date: "Date", time: "Time", meridiem: "AM/PM" }}
              required
              fieldClassName={fieldClass}
              labelClassName={labelClass}
            />
            <DateTimeSelect
              name="endAt"
              labels={{ field: "Back in service", date: "Date", time: "Time", meridiem: "AM/PM" }}
              required
              fieldClassName={fieldClass}
              labelClassName={labelClass}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Reason (optional)</span>
            <input name="note" className={fieldClass} placeholder="e.g. Brake failure found at weekly inspection" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Taking off road…" : "Take vehicle off road"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnQuiet}>
              Cancel
            </button>
            <Feedback error={error} success={null} />
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export type FollowUpRecord = {
  id: string;
  maintenance_date: string;
  maintenance_type: string;
  cost_cents: number;
  service_provider: string | null;
};

/**
 * Raise a maintenance job from selected defects.
 *
 * No cost field: the work has not been quoted, and the canonical maintenance
 * record is where a figure is entered once it has been. One inspection may
 * raise several jobs, so this stays available after the first.
 */
export function InspectionFollowUpPanel({
  inspectionId,
  candidates,
  followUps,
  editable,
}: {
  inspectionId: string;
  candidates: DefectLine[];
  followUps: FollowUpRecord[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className="flex flex-col gap-3">
      {followUps.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className={labelClass}>Maintenance raised from this inspection</p>
          <ul className="flex flex-col gap-1">
            {followUps.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-ops-line bg-ops-panel-2 px-2 py-1"
              >
                <span className="flex flex-wrap items-baseline gap-2 text-[12px]">
                  <span className="font-semibold tabular-nums text-ops-ink">{job.maintenance_date}</span>
                  <span className="text-ops-ink-2">{job.maintenance_type.replace(/_/g, " ")}</span>
                  {job.service_provider ? <span className="text-ops-ink-3">{job.service_provider}</span> : null}
                  <span className="tabular-nums text-ops-ink-2">{formatMoney(job.cost_cents, "MUR", "en")}</span>
                </span>
                <Link href={`/admin/maintenance/${job.id}`} className={btnQuiet}>
                  Open maintenance record
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {candidates.length === 0 ? (
        <p className="text-[13px] text-ops-ink-3">
          No Attention or Fail items on this inspection, so there is nothing to raise a maintenance job from.
        </p>
      ) : !editable ? (
        <p className="text-[13px] text-ops-ink-3">
          This inspection is approved. Raise further work directly in Maintenance.
        </p>
      ) : (
        <form
          action={(fd) => {
            setError(null);
            setNotice(null);
            if (selected.length === 0) {
              setError("Select at least one defect.");
              return;
            }
            for (const key of selected) fd.append("itemKeys", key);
            start(async () => {
              const res = await createMaintenanceFromInspection(inspectionId, fd);
              if (!res.ok) setError(res.error ?? "Could not raise the maintenance job.");
              else if (res.duplicate) setNotice("That exact job has already been raised from this inspection.");
              else {
                setNotice("Maintenance job raised.");
                setSelected([]);
              }
              router.refresh();
            });
          }}
          className="flex flex-col gap-2"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className={labelClass}>Defects to include</legend>
            {candidates.map((defect) => (
              <label key={defect.itemKey} className="flex items-start gap-2 text-[13px] text-ops-ink">
                <input
                  type="checkbox"
                  checked={selected.includes(defect.itemKey)}
                  onChange={() => toggle(defect.itemKey)}
                  className="mt-0.5"
                />
                <span>
                  <span
                    className={cn(
                      "mr-1.5 rounded-[2px] px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white",
                      defect.result === "fail" ? "bg-ops-danger" : "bg-ops-warning"
                    )}
                  >
                    {defect.result === "fail" ? "Fail" : "Attention"}
                  </span>
                  {defect.label}
                  {defect.remarks ? <span className="text-ops-ink-3"> — {defect.remarks}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Garage / service provider (optional)</span>
              <input name="serviceProvider" className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Notes (optional)</span>
              <input name="notes" className={fieldClass} />
            </label>
          </div>

          <p className="text-[11px] text-ops-ink-3">
            Vehicle, date and mileage are carried over from this inspection. No cost is recorded here — enter it on the
            maintenance record once the work is quoted.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending || selected.length === 0} className={btnPrimary}>
              {pending ? "Raising…" : "Create maintenance record"}
            </button>
            <Feedback error={error} success={notice} />
          </div>
        </form>
      )}
    </div>
  );
}
