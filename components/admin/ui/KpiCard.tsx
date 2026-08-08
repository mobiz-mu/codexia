import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type KpiTone = "primary" | "action" | "danger" | "warning";

const ICON_TONE: Record<KpiTone, string> = {
  primary: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark",
  action: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action-tint text-action-dark",
  danger: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700",
  warning: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800",
};

const BORDER_TONE: Record<KpiTone, string> = {
  primary: "border-border bg-background",
  action: "border-border bg-background",
  danger: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
};

const VALUE_TONE: Record<KpiTone, string> = {
  primary: "text-ink",
  action: "text-ink",
  danger: "text-red-700",
  warning: "text-amber-800",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone: KpiTone;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-sm transition-shadow duration-150 hover:shadow-md ${BORDER_TONE[tone]}`}
    >
      <span className={ICON_TONE[tone]}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
        {typeof value === "string" ? <p className={`mt-0.5 text-xl font-bold ${VALUE_TONE[tone]}`}>{value}</p> : value}
      </div>
    </div>
  );
}

export function KpiSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-dark">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}
