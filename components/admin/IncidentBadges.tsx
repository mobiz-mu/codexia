import { SEVERITY_LABELS, REPAIR_STATUS_LABELS, type Severity, type RepairStatus } from "@/lib/incidents/schema";

const SEVERITY_TONE: Record<Severity, string> = {
  write_off: "bg-red-600 text-white",
  major: "bg-red-100 text-red-700",
  moderate: "bg-amber-100 text-amber-800",
  minor: "bg-primary-tint text-primary-dark",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${SEVERITY_TONE[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

const REPAIR_STATUS_TONE: Record<RepairStatus, string> = {
  reported: "bg-sky-100 text-sky-800",
  under_assessment: "bg-sky-100 text-sky-800",
  awaiting_insurance: "bg-amber-100 text-amber-800",
  approved_for_repair: "bg-amber-100 text-amber-800",
  under_repair: "bg-amber-100 text-amber-800",
  repaired: "bg-green-100 text-green-800",
  closed: "bg-green-100 text-green-800",
};

export function RepairStatusBadge({ status }: { status: RepairStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${REPAIR_STATUS_TONE[status]}`}>
      {REPAIR_STATUS_LABELS[status]}
    </span>
  );
}
