import Link from "next/link";

import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { InspectionApprovalBadge } from "@/components/admin/inspections/InspectionBadges";
import { shiftWeekEnding, type WeeklyInspectionStatus } from "@/lib/inspections/due";
import type { FleetWeekSummary } from "@/lib/actions/admin/inspections";
import { cn } from "@/lib/utils/cn";

/**
 * Fleet-wide weekly inspection status for one Mauritius week.
 *
 * Status is never colour alone: every cell carries a glyph and a word, so it
 * reads correctly in greyscale and to a screen reader. Colour is reserved for
 * the states that genuinely need attention.
 */

const STATUS_STYLES: Record<WeeklyInspectionStatus, string> = {
  failed: "bg-ops-danger/15 text-ops-danger border border-ops-danger/40",
  attention_required: "bg-ops-warning/15 text-ops-warning border border-ops-warning/40",
  overdue: "bg-ops-danger/10 text-ops-danger border border-ops-danger/30",
  due: "bg-ops-panel-3 text-ops-ink-2 border border-ops-line",
  completed: "bg-ops-success/15 text-ops-success border border-ops-success/40",
  exempt_off_road: "bg-ops-panel-3 text-ops-ink-3 border border-ops-line",
  not_required: "bg-ops-panel-3 text-ops-ink-3 border border-ops-line",
};

const EXEMPT_TYPE_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  incident: "Incident",
  inspection: "Inspection downtime",
  stop_sell: "Stop sell",
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "due", label: "Due" },
  { key: "overdue", label: "Overdue" },
  { key: "failed", label: "Failed" },
  { key: "attention_required", label: "Attention" },
  { key: "completed", label: "Completed" },
  { key: "exempt_off_road", label: "Exempt" },
] as const;

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={cn("text-[15px] font-bold tabular-nums", value > 0 ? tone ?? "text-ops-ink" : "text-ops-ink-3")}>
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-ops-ink-3">{label}</span>
    </span>
  );
}

export function FleetWeekPanel({
  summary,
  statusFilter,
}: {
  summary: FleetWeekSummary;
  statusFilter?: string;
}) {
  const { counts, weekEnding, weekStart, isCurrentWeek } = summary;
  const rows = statusFilter ? summary.rows.filter((r) => r.status === statusFilter) : summary.rows;

  const weekHref = (target: string, status?: string) => {
    const qs = new URLSearchParams();
    qs.set("week", target);
    if (status) qs.set("fleetStatus", status);
    return `/admin/inspections?${qs.toString()}`;
  };

  return (
    <OpsPanel
      title={isCurrentWeek ? "This week — fleet inspection status" : "Fleet inspection status"}
      subtitle={`Mauritius week ${weekStart} → ${weekEnding}${isCurrentWeek ? " · current week" : ""}`}
      flush
      actions={
        <span className="flex items-center gap-1">
          <Link
            href={weekHref(shiftWeekEnding(weekEnding, -1), statusFilter)}
            className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
            aria-label="Show the previous week"
          >
            ← Prev
          </Link>
          {!isCurrentWeek ? (
            <Link
              href="/admin/inspections"
              className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
            >
              This week
            </Link>
          ) : null}
          <Link
            href={weekHref(shiftWeekEnding(weekEnding, 1), statusFilter)}
            className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
            aria-label="Show the next week"
          >
            Next →
          </Link>
        </span>
      }
    >
      <OpsToolbar className="justify-between">
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Stat label="Required" value={counts.required} />
          <Stat label="Completed" value={counts.completed} tone="text-ops-success" />
          <Stat label="Due" value={counts.due} tone="text-ops-ink" />
          <Stat label="Overdue" value={counts.overdue} tone="text-ops-danger" />
          <Stat label="Attention" value={counts.attention} tone="text-ops-warning" />
          <Stat label="Failed" value={counts.failed} tone="text-ops-danger" />
          <Stat label="Exempt" value={counts.exempt} />
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key || "all"}
              href={weekHref(weekEnding, filter.key || undefined)}
              aria-current={(statusFilter ?? "") === filter.key ? "true" : undefined}
              className={cn(
                "rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold",
                (statusFilter ?? "") === filter.key
                  ? "border-ops-header bg-ops-header text-white"
                  : "border-ops-line text-ops-ink-2 hover:border-ops-accent"
              )}
            >
              {filter.label}
            </Link>
          ))}
        </span>
      </OpsToolbar>

      <OpsTable minWidth="66rem">
        <OpsThead>
          <OpsTr>
            <OpsTh width="14rem">Vehicle</OpsTh>
            <OpsTh width="7rem">Registration</OpsTh>
            <OpsTh width="5rem">Staff car</OpsTh>
            <OpsTh width="10rem">Inspection status</OpsTh>
            <OpsTh width="7rem" wrap>
              Latest inspection
            </OpsTh>
            <OpsTh width="8rem">Approval</OpsTh>
            <OpsTh align="right" width="8rem">
              Action
            </OpsTh>
          </OpsTr>
        </OpsThead>
        <OpsTbody>
          {rows.length === 0 ? (
            <OpsEmptyRow colSpan={7}>
              {statusFilter ? "No vehicles in that state this week." : "No active vehicles require inspection."}
            </OpsEmptyRow>
          ) : (
            rows.map((row, index) => (
              <OpsTr key={row.vehicleId} zebra={index} highlight={row.hasSafetyFailure}>
                <OpsTd>
                  <VehicleIdentity
                    size="sm"
                    vehicle={{
                      id: row.vehicleId,
                      name: row.name,
                      subtitle: [row.brand, row.model].filter(Boolean).join(" ") || null,
                      transmission: row.transmission,
                      registration: null,
                    }}
                  />
                </OpsTd>
                <OpsTd className="font-mono text-[11px]">{row.registration ?? "—"}</OpsTd>
                <OpsTd>
                  {row.isStaffCar ? (
                    <span className="inline-block rounded-[2px] bg-ops-staff px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                      Staff car
                    </span>
                  ) : (
                    <span className="text-[11px] text-ops-ink-3">—</span>
                  )}
                </OpsTd>
                <OpsTd>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      STATUS_STYLES[row.status]
                    )}
                  >
                    <span aria-hidden="true">{row.statusGlyph}</span>
                    {row.statusLabel}
                  </span>
                  {row.hasSafetyFailure ? (
                    <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-ops-danger">
                      Safety failure
                    </span>
                  ) : null}
                  {row.status === "exempt_off_road" && row.exemptTypes.length > 0 ? (
                    <span className="mt-0.5 block text-[10px] text-ops-ink-3">
                      {/* Several causes are reported as such rather than picking one. */}
                      {row.exemptTypes.length > 1
                        ? "Multiple off-road periods"
                        : EXEMPT_TYPE_LABELS[row.exemptTypes[0]] ?? row.exemptTypes[0]}
                    </span>
                  ) : null}
                </OpsTd>
                <OpsTd numeric className="whitespace-nowrap">
                  {row.inspectionDate ?? "—"}
                </OpsTd>
                <OpsTd>
                  {row.inspectionId ? <InspectionApprovalBadge approvedAt={row.approvedAt} /> : <span className="text-[11px] text-ops-ink-3">—</span>}
                </OpsTd>
                <OpsTd align="right">
                  {row.inspectionId ? (
                    <Link
                      href={`/admin/inspections/${row.inspectionId}`}
                      className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                      aria-label={`View the inspection for ${row.name}`}
                    >
                      View inspection
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/inspections/new?vehicleId=${row.vehicleId}`}
                      className="rounded-sm border border-ops-header bg-ops-header px-1.5 py-0.5 text-[11px] font-semibold text-white hover:bg-ops-header-2"
                      aria-label={`Start an inspection for ${row.name}`}
                    >
                      Start inspection
                    </Link>
                  )}
                </OpsTd>
              </OpsTr>
            ))
          )}
        </OpsTbody>
      </OpsTable>
    </OpsPanel>
  );
}
