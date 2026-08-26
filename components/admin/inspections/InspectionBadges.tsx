import { RESULT_BADGES, approvalBadge, type DerivedResult } from "@/lib/inspections/presentation";
import { cn } from "@/lib/utils/cn";

/**
 * Result and approval are rendered as two separate badges, never merged.
 *
 * A reviewed failure must read "Failed · Approved" — turning it green because
 * a manager acknowledged it would hide the defect, which is the entire reason
 * approval is a separate column rather than a result value.
 */

function Badge({
  label,
  glyph,
  className,
  title,
}: {
  label: string;
  glyph: string;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        className
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}

export function InspectionResultBadge({ result }: { result: DerivedResult }) {
  const badge = RESULT_BADGES[result] ?? RESULT_BADGES.draft;
  return <Badge label={badge.label} glyph={badge.glyph} className={badge.className} title={badge.description} />;
}

export function InspectionApprovalBadge({ approvedAt }: { approvedAt: string | null | undefined }) {
  const badge = approvalBadge(approvedAt);
  return <Badge label={badge.label} glyph={badge.glyph} className={badge.className} title={badge.description} />;
}

/** The pair, in the order an operator reads them: what happened, then who signed. */
export function InspectionStatusPair({
  result,
  approvedAt,
}: {
  result: DerivedResult;
  approvedAt: string | null | undefined;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <InspectionResultBadge result={result} />
      <InspectionApprovalBadge approvedAt={approvedAt} />
    </span>
  );
}
