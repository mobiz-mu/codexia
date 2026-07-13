"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod } from "../types";

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
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              paymentMethod === option.value ? "border-primary bg-surface" : "border-border",
              option.disabled && "opacity-60"
            )}
          >
            <input
              type="radio"
              name="payment-method"
              className="mt-1"
              checked={paymentMethod === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="block font-semibold text-ink">{p(`${option.messageKey}.title`)}</span>
              <span className="mt-1 block text-sm text-muted">{p(`${option.messageKey}.text`)}</span>
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted">
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting ? p("submitting") : p("submit")}
        </button>
      </div>
    </div>
  );
}
