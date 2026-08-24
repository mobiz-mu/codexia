import { cn } from "@/lib/utils/cn";
import { OPS_LEGEND_ORDER, OPS_STATUS, type OpsStatusKey } from "@/lib/fleet/status-config";

/**
 * Status chips and the planning legend, both rendered straight from
 * lib/fleet/status-config.ts. Colours are never written at the call site, so
 * a status cannot drift between the board, the calendar and a list page.
 *
 * Each chip shows its glyph alongside its label — colour is reinforcement,
 * never the only carrier of meaning.
 */

export function OpsStatusBadge({
  status,
  className,
  showLabel = true,
}: {
  status: OpsStatusKey;
  className?: string;
  showLabel?: boolean;
}) {
  const def = OPS_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
        def.badge,
        className
      )}
      title={def.description}
    >
      <span aria-hidden="true" className="font-mono leading-none">
        {def.glyph}
      </span>
      {showLabel ? def.label : <span className="sr-only">{def.label}</span>}
    </span>
  );
}

export function PlanningLegend({
  statuses = OPS_LEGEND_ORDER,
  className,
}: {
  statuses?: OpsStatusKey[];
  className?: string;
}) {
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}
      aria-label="Planning board legend"
    >
      {statuses.map((key) => {
        const def = OPS_STATUS[key];
        return (
          <li key={key} className="flex items-center gap-1.5 text-[11px] text-ops-ink-inv-2">
            <span
              aria-hidden="true"
              className="grid h-3.5 w-3.5 place-items-center rounded-[2px] border border-black/20 font-mono text-[9px] font-bold text-white"
              style={{ background: def.swatch }}
            >
              {def.glyph}
            </span>
            <span>{def.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
