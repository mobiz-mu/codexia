"use client";

import { useTranslations } from "next-intl";
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

      <div className="flex flex-col gap-3">
        {extras.map((extra) => {
          const name = locale === "fr" ? extra.name_fr : extra.name_en;
          const checked = (selection[extra.id] ?? 0) > 0;
          return (
            <div
              key={extra.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(extra.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <span>
                  <span className="font-medium text-ink">{name}</span>
                  <span className="ml-2 text-sm text-muted">
                    {formatMoney(extra.price_cents, extra.currency, locale)}{" "}
                    {extra.pricing_mode === "per_day" ? tExtras("perDay") : tExtras("flat")}
                  </span>
                </span>
              </label>
              {checked && (
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={selection[extra.id] ?? 1}
                  onChange={(e) => setQuantity(extra.id, Number(e.target.value))}
                  className="w-16 rounded-lg border border-border px-2 py-1 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted">
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t("continue")}
        </button>
      </div>
    </div>
  );
}
