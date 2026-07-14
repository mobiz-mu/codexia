"use client";

import { useTranslations } from "next-intl";
import { Landmark, MessageCircle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod } from "../types";

const ICONS: Record<PaymentMethod, typeof Landmark> = {
  bank_transfer: Landmark,
  pay_on_arrival: MessageCircle,
  online: CreditCard,
};

export function PaymentStep({
  paymentMethod,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  paymentMethod: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const t = useTranslations("booking");
  const p = useTranslations("booking.paymentStep");

  const OPTIONS: { value: PaymentMethod; messageKey: "bankTransfer" | "payOnArrival" | "online"; disabled?: boolean }[] = [
    { value: "bank_transfer", messageKey: "bankTransfer" },
    { value: "pay_on_arrival", messageKey: "payOnArrival" },
    { value: "online", messageKey: "online", disabled: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-ink">{p("title")}</h2>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const Icon = ICONS[option.value];
          const selected = paymentMethod === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                selected ? "border-primary bg-primary-tint/40" : "border-border hover:bg-surface",
                option.disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
              )}
            >
              <input
                type="radio"
                name="payment-method"
                className="mt-1 h-4 w-4 accent-primary"
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
              />
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-ink">{p(`${option.messageKey}.title`)}</span>
                <span className="mt-1 block text-sm text-muted">{p(`${option.messageKey}.text`)}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-60">
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
        >
          {submitting ? p("submitting") : p("submit")}
        </button>
      </div>
    </div>
  );
}
