export const COMPLIANCE_STATUSES = ["expired", "expires_today", "urgent", "warning", "valid"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  expired: "Expired",
  expires_today: "Expires today",
  urgent: "Urgent",
  warning: "Warning",
  valid: "Valid",
};

// Lower sorts first — expired documents must always appear above merely
// upcoming ones, regardless of how the list is otherwise ordered.
export const COMPLIANCE_STATUS_SORT_ORDER: Record<ComplianceStatus, number> = {
  expired: 0,
  expires_today: 1,
  urgent: 2,
  warning: 3,
  valid: 4,
};

function utcDateOnly(input: string | Date): number {
  const d = typeof input === "string" ? new Date(input) : input;
  // Date-only (calendar-day) arithmetic via UTC epoch days — deliberately
  // discards time-of-day so a document expiring "today" always reads as
  // expires_today regardless of what hour the check runs, and so DST
  // transitions in any local timezone can never shift the day count by one.
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000;
}

export type ComplianceStatusResult = {
  status: ComplianceStatus;
  // Positive = days until expiry, 0 = expires today, negative = days overdue.
  daysRemaining: number;
};

export function computeComplianceStatus(expiryDate: string | Date, today: string | Date = new Date()): ComplianceStatusResult {
  const daysRemaining = utcDateOnly(expiryDate) - utcDateOnly(today);

  if (daysRemaining < 0) return { status: "expired", daysRemaining };
  if (daysRemaining === 0) return { status: "expires_today", daysRemaining };
  if (daysRemaining <= 7) return { status: "urgent", daysRemaining };
  if (daysRemaining <= 30) return { status: "warning", daysRemaining };
  return { status: "valid", daysRemaining };
}

// Whether a document in this status should be part of the 30-day alarm
// system (dashboard cards, sidebar badge, daily cron) — everything except
// the genuinely untroubled "valid" state.
export function isAlarmStatus(status: ComplianceStatus): status is Exclude<ComplianceStatus, "valid"> {
  return status !== "valid";
}

/**
 * Calendar-date arithmetic on an ISO `YYYY-MM-DD` string.
 *
 * Built through `Date.UTC` deliberately: compliance expiry is a calendar date,
 * not an instant, so adding days must never be nudged across a boundary by a
 * local timezone offset.
 */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
