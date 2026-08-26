import { SEVERITY_LABELS, REPAIR_STATUS_LABELS, type Severity, type RepairStatus } from "@/lib/incidents/schema";

/**
 * Incident chips in the operations vocabulary: square, compact, uppercase —
 * the same shape as OpsStatusBadge rather than the rounded pastel pills the
 * rest of the admin used to carry. They sit in dense table cells, so the
 * label is allowed to wrap onto a second line instead of forcing the column
 * as wide as "Awaiting insurance".
 */

const CHIP =
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase leading-[1.15] tracking-[0.04em]";

const SEVERITY_TONE: Record<Severity, string> = {
  write_off: "bg-ops-booked text-white",
  major: "bg-ops-booked/15 text-ops-booked",
  moderate: "bg-ops-maint/20 text-ops-incident",
  minor: "bg-ops-panel-3 text-ops-ink-2",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`${CHIP} ${SEVERITY_TONE[severity]}`}>{SEVERITY_LABELS[severity]}</span>;
}

const REPAIR_STATUS_TONE: Record<RepairStatus, string> = {
  reported: "bg-ops-stopsell/15 text-ops-stopsell",
  under_assessment: "bg-ops-stopsell/15 text-ops-stopsell",
  awaiting_insurance: "bg-ops-conflict/25 text-ops-incident",
  approved_for_repair: "bg-ops-conflict/25 text-ops-incident",
  under_repair: "bg-ops-maint/20 text-ops-incident",
  repaired: "bg-ops-agency/15 text-ops-agency",
  closed: "bg-ops-agency/15 text-ops-agency",
};

export function RepairStatusBadge({ status }: { status: RepairStatus }) {
  return <span className={`${CHIP} ${REPAIR_STATUS_TONE[status]}`}>{REPAIR_STATUS_LABELS[status]}</span>;
}
