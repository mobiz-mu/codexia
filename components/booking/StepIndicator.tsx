import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STEP_KEYS = ["search", "vehicle", "extras", "details", "summary", "payment"] as const;

export function StepIndicator({
  currentStep,
  labels,
}: {
  currentStep: number;
  labels: Record<(typeof STEP_KEYS)[number], string>;
}) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 text-xs">
      {STEP_KEYS.map((key, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                isDone && "border-primary bg-primary text-white",
                isCurrent && "border-primary text-primary-dark",
                !isDone && !isCurrent && "border-border text-muted"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stepNumber}
            </span>
            <span className={cn(isCurrent ? "font-semibold text-ink" : "text-muted")}>
              {labels[key]}
            </span>
            {stepNumber < STEP_KEYS.length && <span className="mx-1 text-border">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
