import { cn } from "@/lib/utils/cn";

/**
 * The working surface of the operations console: a light panel on the dark
 * application frame, headed by a solid blue bar.
 *
 * Deliberately square-cornered and tight. This is a back office where a
 * fleet controller scans dozens of rows at a time, so vertical space spent
 * on padding is vertical space taken from data.
 */
export function OpsPanel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Let a table meet the panel edges instead of sitting inside padding. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-sm border border-ops-line bg-ops-panel shadow-sm",
        className
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ops-header px-3 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-white">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] text-white/70">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A lighter subdivision inside a panel — used for filter strips and grouped
 * form sections, where a second blue bar would be too heavy.
 */
export function OpsSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-ops-line last:border-b-0", className)}>
      {title ? (
        <h3 className="bg-ops-panel-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ops-header">
          {title}
        </h3>
      ) : null}
      <div className="p-3">{children}</div>
    </div>
  );
}

/** Toolbar strip for date ranges, filters and view switches above a table. */
export function OpsToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-ops-line bg-ops-panel-2 px-3 py-2",
        className
      )}
    >
      {children}
    </div>
  );
}
