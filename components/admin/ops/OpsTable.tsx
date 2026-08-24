import { cn } from "@/lib/utils/cn";

/**
 * The one dense table used across the operations console.
 *
 * Before this, roughly twenty admin list pages each styled their own table,
 * so row height, header treatment and hover behaviour drifted apart. Pages
 * compose these primitives instead of restyling a bare `<table>`.
 *
 * Horizontal overflow is owned by the wrapper, so a wide fleet table scrolls
 * inside its own panel and never makes the whole page scroll sideways.
 */

export function OpsTable({
  children,
  className,
  minWidth,
}: {
  children: React.ReactNode;
  className?: string;
  /** e.g. "56rem" for a table that must not compress below a readable width. */
  minWidth?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-[13px]", className)}
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

export function OpsThead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-ops-header">{children}</thead>;
}

export function OpsTh({
  children,
  align = "left",
  className,
  scope = "col",
  width,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  scope?: "col" | "row";
  width?: string;
}) {
  return (
    <th
      scope={scope}
      style={width ? { width } : undefined}
      className={cn(
        "whitespace-nowrap border-r border-white/15 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white last:border-r-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

export function OpsTbody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function OpsTr({
  children,
  className,
  zebra,
  highlight = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Row index — striping helps the eye track across a wide fleet table. */
  zebra?: number;
  /** Needs operational attention; paired with an in-row badge, never colour alone. */
  highlight?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-ops-line transition-colors last:border-b-0",
        zebra !== undefined && zebra % 2 === 1 && "bg-ops-panel-2/60",
        highlight && "bg-ops-conflict/20",
        "hover:bg-ops-accent/10",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function OpsTd({
  children,
  align = "left",
  className,
  numeric = false,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Line the digits up — money and mileage columns are read by comparison. */
  numeric?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-r border-ops-line/60 px-2.5 py-1.5 align-middle text-ops-ink-2 last:border-r-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "tabular-nums",
        className
      )}
    >
      {children}
    </td>
  );
}

/** Full-width row shown when a filtered list comes back empty. */
export function OpsEmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-[13px] text-ops-ink-3">
        {children}
      </td>
    </tr>
  );
}

/** Date separator inside an operations day-sheet, as in the reference's departures list. */
export function OpsGroupRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="bg-ops-frame-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-inv"
      >
        {children}
      </td>
    </tr>
  );
}
