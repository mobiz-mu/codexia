"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/pricing/format";

type Extra = {
  id: string;
  name_en: string;
  name_fr: string;
  price_cents: number;
  currency: string;
  pricing_mode: "per_day" | "flat";
};

export function ExtrasStep({
  extras,
  selection,
  onChange,
  locale,
  onContinue,
  onBack,
}: {
  extras: Extra[];
  selection: Record<string, number>;
  onChange: (selection: Record<string, number>) => void;
  locale: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("booking");
  const tExtras = useTranslations("booking.extrasStep");

  function toggle(extraId: string, checked: boolean) {
    onChange({ ...selection, [extraId]: checked ? 1 : 0 });
  }

  function setQuantity(extraId: string, quantity: number) {
    onChange({ ...selection, [extraId]: quantity });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{tExtras("title")}</h2>
        <p className="text-sm text-muted">{tExtras("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {extras.map((extra) => {
          const name = locale === "fr" ? extra.name_fr : extra.name_en;
          const quantity = selection[extra.id] ?? 0;
          const checked = quantity > 0;
          return (
            <div
              key={extra.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
                checked ? "border-primary bg-primary-tint/40" : "border-border bg-background"
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(extra.id, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block font-medium text-ink">{name}</span>
                    <span className="text-sm text-muted">
                      {formatMoney(extra.price_cents, extra.currency, locale)}{" "}
                      {extra.pricing_mode === "per_day" ? tExtras("perDay") : tExtras("flat")}
                    </span>
                  </span>
                </span>
              </label>
              {checked && (
                <div className="ml-7 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={tExtras("decreaseQuantity")}
                    onClick={() => setQuantity(extra.id, Math.max(1, quantity - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-primary hover:text-primary-dark"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-ink">{quantity}</span>
                  <button
                    type="button"
                    aria-label={tExtras("increaseQuantity")}
                    onClick={() => setQuantity(extra.id, Math.min(5, quantity + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-primary hover:text-primary-dark"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted transition-colors hover:text-ink">
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
        >
          {t("continue")}
        </button>
      </div>
    </div>
  );
}
