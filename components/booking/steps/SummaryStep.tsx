"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/pricing/format";
import type { PriceBreakdown } from "@/lib/pricing/calculate";

type PolicyAcceptance = {
  generalConditions: boolean;
  privacy: boolean;
  cancellation: boolean;
  insurance: boolean;
};

export function SummaryStep({
  breakdown,
  locale,
  policyAcceptance,
  onPolicyChange,
  onContinue,
  onBack,
}: {
  breakdown: PriceBreakdown | null;
  locale: string;
  policyAcceptance: PolicyAcceptance;
  onPolicyChange: (policy: PolicyAcceptance) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("booking");
  const s = useTranslations("booking.summaryStep");

  const allAccepted = Object.values(policyAcceptance).every(Boolean);

  const POLICIES: { key: keyof PolicyAcceptance; labelKey: string; slug: string }[] = [
    { key: "generalConditions", labelKey: "generalConditions", slug: "general-rental-conditions" },
    { key: "privacy", labelKey: "privacy", slug: "privacy" },
    { key: "cancellation", labelKey: "cancellation", slug: "cancellation" },
    { key: "insurance", labelKey: "insurance", slug: "insurance" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-ink">{s("title")}</h2>

      {breakdown && (
        <div className="rounded-xl border border-border bg-background p-4">
          <ul className="flex flex-col gap-2 text-sm">
            {breakdown.lineItems.map((item) => (
              <li key={item.key} className="flex justify-between text-ink">
                <span>{item.label}</span>
                <span>{formatMoney(item.amountCents, breakdown.currency, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex justify-between font-semibold text-ink">
              <span>{s("total")}</span>
              <span>{formatMoney(breakdown.totalCents, breakdown.currency, locale)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm text-muted">
              <span>{s("dueNow")}</span>
              <span>{formatMoney(breakdown.totalCents, breakdown.currency, locale)}</span>
            </div>
            {breakdown.depositCents > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{s("deposit")}</span>
                <span>{formatMoney(breakdown.depositCents, breakdown.currency, locale)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
        <legend className="mb-1 px-1 text-sm font-semibold text-ink">{s("policiesTitle")}</legend>
        {POLICIES.map((policy) => (
          <label
            key={policy.key}
            className={cn(
              "flex items-start gap-2 rounded-lg p-2 text-sm text-ink transition-colors",
              policyAcceptance[policy.key] ? "bg-primary-tint/40" : "hover:bg-surface"
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={policyAcceptance[policy.key]}
              onChange={(e) =>
                onPolicyChange({ ...policyAcceptance, [policy.key]: e.target.checked })
              }
            />
            <span>
              {s(policy.labelKey)} (
              <Link href={`/policies/${policy.slug}`} target="_blank" className="text-primary-dark underline">
                {s("view")}
              </Link>
              )
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted transition-colors hover:text-ink">
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!allAccepted}
          className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {t("continue")}
        </button>
      </div>
    </div>
  );
}
