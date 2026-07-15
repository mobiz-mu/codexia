import { cn } from "@/lib/utils/cn";

export function StatusPill({
  active,
  labels = ["Yes", "No"],
}: {
  active: boolean;
  labels?: [string, string];
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-action-tint text-action-dark" : "bg-surface text-muted"
      )}
    >
      {active ? labels[0] : labels[1]}
    </span>
  );
}
