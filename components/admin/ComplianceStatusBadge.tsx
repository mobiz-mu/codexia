import { COMPLIANCE_STATUS_LABELS, type ComplianceStatus } from "@/lib/compliance/status";

const TONE_CLASSES: Record<ComplianceStatus, string> = {
  expired: "bg-red-600 text-white",
  expires_today: "bg-red-100 text-red-700",
  urgent: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-800",
  valid: "bg-primary-tint text-primary-dark",
};

export function ComplianceStatusBadge({ status, daysRemaining }: { status: ComplianceStatus; daysRemaining: number }) {
  const dayLabel =
    status === "expired"
      ? `${Math.abs(daysRemaining)}d overdue`
      : status === "expires_today"
        ? "today"
        : `${daysRemaining}d left`;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[status]}`}>
      {COMPLIANCE_STATUS_LABELS[status]} · {dayLabel}
    </span>
  );
}
