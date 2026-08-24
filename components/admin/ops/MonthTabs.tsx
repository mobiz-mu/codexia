import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The twelve-month strip from the reference's tariff screen, reused wherever
 * a year's worth of records is filtered a month at a time.
 *
 * Server-rendered links rather than client state, matching how the existing
 * admin pagination works — the selected month lives in the URL, so a filtered
 * view can be bookmarked, shared and reloaded.
 */

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthTabs({
  selected,
  hrefForMonth,
  year,
  hrefForYear,
  className,
}: {
  /** 1-12, or null for "all months". */
  selected: number | null;
  hrefForMonth: (month: number | null) => string;
  year?: number;
  hrefForYear?: (year: number) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {year !== undefined && hrefForYear ? (
        <span className="mr-1 flex items-center gap-1">
          <Link
            href={hrefForYear(year - 1)}
            aria-label={`Go to ${year - 1}`}
            className="rounded-sm border border-ops-line bg-ops-panel px-1.5 py-1 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
          >
            ‹
          </Link>
          <span className="min-w-[3rem] text-center text-[12px] font-bold tabular-nums text-ops-ink">
            {year}
          </span>
          <Link
            href={hrefForYear(year + 1)}
            aria-label={`Go to ${year + 1}`}
            className="rounded-sm border border-ops-line bg-ops-panel px-1.5 py-1 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
          >
            ›
          </Link>
        </span>
      ) : null}

      <Link
        href={hrefForMonth(null)}
        aria-current={selected === null ? "true" : undefined}
        className={cn(
          "rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors",
          selected === null
            ? "border-ops-header bg-ops-header text-white"
            : "border-ops-line bg-ops-panel text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
        )}
      >
        All
      </Link>

      {MONTHS_EN.map((label, index) => {
        const month = index + 1;
        const isSelected = selected === month;
        return (
          <Link
            key={label}
            href={hrefForMonth(month)}
            aria-current={isSelected ? "true" : undefined}
            // The visible text swaps between the full and abbreviated month by
            // CSS, so the accessible name is pinned here rather than left to
            // depend on which span happens to be displayed.
            aria-label={label}
            className={cn(
              "rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors",
              isSelected
                ? "border-ops-header bg-ops-header text-white"
                : "border-ops-line bg-ops-panel text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
            )}
          >
            <span aria-hidden="true" className="hidden sm:inline">
              {label}
            </span>
            <span aria-hidden="true" className="sm:hidden">
              {label.slice(0, 3)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
