"use client";

import { useActionState } from "react";
import type { LocationFormState } from "@/lib/actions/admin/locations";

export function LocationForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: LocationFormState, formData: FormData) => Promise<LocationFormState>;
  initial: {
    name_en: string;
    name_fr: string;
    delivery_fee_cents: number;
    delivery_fee_currency: string;
    display_order: number;
    active: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as LocationFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (EN)</label>
          <input
            type="text"
            name="nameEn"
            defaultValue={initial.name_en}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (FR)</label>
          <input
            type="text"
            name="nameFr"
            defaultValue={initial.name_fr}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Delivery Fee — EUR (€) cents</label>
          <input
            type="number"
            name="deliveryFeeCents"
            defaultValue={initial.delivery_fee_cents}
            min={0}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted">0 = free delivery/collection at this location.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Currency</label>
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            {initial.delivery_fee_currency}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Display Order</label>
          <input
            type="number"
            name="displayOrder"
            defaultValue={initial.display_order}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {initial.delivery_fee_currency !== "EUR" && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            This location&apos;s delivery fee is still priced in <strong>{initial.delivery_fee_currency}</strong>{" "}
            (legacy). Until repriced in EUR, the public site will not show a numeric fee for this location (it
            will show &ldquo;Free&rdquo; only if the fee is 0, or a &ldquo;contact us&rdquo; message otherwise),
            and the booking flow will reject any attempt to use it as a paid delivery point. The fee field above
            has NOT been converted — re-enter it in real EUR cents before checking the box below.
          </p>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="confirmEurRepricing" value="true" />
            I have re-entered the delivery fee above in EUR — mark this location as EUR-priced
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={initial.active} value="true" />
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
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
