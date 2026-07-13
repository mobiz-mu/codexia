"use client";

import { useActionState } from "react";
import type { ExtraFormState } from "@/lib/actions/admin/extras";

export function ExtraForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ExtraFormState, formData: FormData) => Promise<ExtraFormState>;
  initial?: {
    name_en?: string | null;
    name_fr?: string | null;
    price_cents?: number;
    currency?: string;
    pricing_mode?: string;
    display_order?: number;
    active?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ExtraFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (EN)</label>
          <input
            type="text"
            name="nameEn"
            defaultValue={initial?.name_en ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (FR)</label>
          <input
            type="text"
            name="nameFr"
            defaultValue={initial?.name_fr ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Price (cents)</label>
          <input
            type="number"
            name="priceCents"
            defaultValue={initial?.price_cents ?? 0}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Currency</label>
          <input
            type="text"
            name="currency"
            defaultValue={initial?.currency ?? "EUR"}
            maxLength={3}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Pricing Mode</label>
          <select
            name="pricingMode"
            defaultValue={initial?.pricing_mode ?? "per_day"}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="per_day">Per day</option>
            <option value="flat">Flat</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Display Order</label>
          <input
            type="number"
            name="displayOrder"
            defaultValue={initial?.display_order ?? 0}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} value="true" />
        Active
      </label>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
