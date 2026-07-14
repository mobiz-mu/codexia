import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

const STEP_KEYS = ["search", "vehicle", "extras", "details", "summary", "payment"] as const;

export function StepIndicator({
  currentStep,
  labels,
}: {
  currentStep: number;
  labels: Record<(typeof STEP_KEYS)[number], string>;
}) {
  const t = useTranslations("booking");
  const progressPercent = ((currentStep - 1) / (STEP_KEYS.length - 1)) * 100;

  return (
    <div className="mb-8">
      {/* Mobile: compact "Step X of N" with progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">
            {t("stepOf", { current: currentStep, total: STEP_KEYS.length })}
          </span>
          <span className="text-muted">{labels[STEP_KEYS[currentStep - 1]]}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Desktop/tablet: full step row with a progress track behind it */}
      <ol className="relative hidden items-start gap-2 px-3 text-xs sm:flex">
        <div className="absolute left-3 right-3 top-3 h-0.5 bg-surface" aria-hidden="true" />
        <div
          className="absolute left-3 top-3 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%`, maxWidth: "calc(100% - 1.5rem)" }}
          aria-hidden="true"
        />
        {STEP_KEYS.map((key, i) => {
          const stepNumber = i + 1;
          const isDone = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          return (
            <li key={key} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold",
                  isDone && "border-primary bg-primary text-white",
                  isCurrent && "border-primary text-primary-dark",
                  !isDone && !isCurrent && "border-border text-muted"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stepNumber}
              </span>
              <span className={cn("max-w-20 leading-tight", isCurrent ? "font-semibold text-ink" : "text-muted")}>
                {labels[key]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
