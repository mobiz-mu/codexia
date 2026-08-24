"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { formatCentsToEuro } from "@/lib/pricing/tariff-schema";
import type { TariffFormState } from "@/lib/actions/admin/tariffs";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";

/**
 * Base-rate entry, laid out like the reference: the vehicle on the left with
 * prev/next stepping, the effective range and the six duration rates on the
 * right, then pickup-point applicability.
 *
 * Rates are typed as euros per day and stored as integer cents. The zero
 * warning is stated in the form itself, because a blank box meaning "not
 * sold" rather than "free" is the one rule an operator could otherwise get
 * catastrophically wrong.
 */

const TIERS = [
  { name: "rate1DayCents", label: "1 day" },
  { name: "rate3DayCents", label: "3 days" },
  { name: "rate4DayCents", label: "4 days" },
  { name: "rate7DayCents", label: "7 days" },
  { name: "rate14DayCents", label: "14 days" },
  { name: "rate21PlusDayCents", label: "21+ days" },
] as const;

const inputClass =
  "w-full rounded-sm border border-ops-line bg-white px-2 py-1 text-[13px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2";

export type TariffFormVehicle = {
  id: string;
  name: string;
  brand: string;
  model: string;
  transmission: "manual" | "automatic";
  internal_registration_ref: string | null;
  category_id: string;
};

export type TariffFormInitial = {
  id?: string;
  scope?: "vehicle" | "category";
  vehicleId?: string;
  categoryId?: string;
  label?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string;
  rates?: Record<string, number>;
  active?: boolean;
  locationIds?: string[];
};

export function TariffRateForm({
  action,
  vehicles,
  categories,
  locations,
  selectedVehicleId,
  onSelectVehicle,
  initial,
  submitLabel = "Add tariff period",
  canManage,
  mode = "create",
  footerExtra,
}: {
  action: (prev: TariffFormState, formData: FormData) => Promise<TariffFormState>;
  vehicles: TariffFormVehicle[];
  categories: { id: string; name_en: string }[];
  locations: { id: string; name_en: string }[];
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
  initial?: TariffFormInitial;
  submitLabel?: string;
  canManage: boolean;
  /**
   * `edit` targets one existing period, so stepping through the fleet would
   * silently repoint it at another vehicle — the stepper is hidden and the
   * subject is shown read-only instead.
   */
  mode?: "create" | "edit";
  /** e.g. a Cancel link, rendered beside the submit button. */
  footerExtra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as TariffFormState);
  const [scope, setScope] = useState<"vehicle" | "category">(initial?.scope ?? "vehicle");
  const router = useRouter();

  // A saved period must appear in the listing without a manual reload —
  // revalidatePath alone leaves the already-rendered tree on screen.
  //
  // Refresh only: an earlier attempt also navigated the inline editor closed
  // on save, but that navigation and this refresh cancelled each other and
  // the listing stopped updating at all. Keeping the editor open until the
  // operator dismisses it is both simpler and closer to the reference, where
  // the expanded row persists.
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  const index = vehicles.findIndex((v) => v.id === selectedVehicleId);
  const vehicle = index >= 0 ? vehicles[index] : vehicles[0];
  const prev = index > 0 ? vehicles[index - 1] : null;
  const next = index >= 0 && index < vehicles.length - 1 ? vehicles[index + 1] : null;
  const isEdit = mode === "edit";
  const selectedCategory = categories.find(
    (c) => c.id === (initial?.categoryId ?? vehicle?.category_id)
  );

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-[15rem_1fr]">
      {/* Left rail — always shows what is being priced. */}
      <div className="flex flex-col gap-2 border-ops-line md:border-r md:pr-4">
        {scope === "category" ? (
          // A category tariff prices a whole group, so showing one car's photo
          // here would misrepresent what the operator is about to change.
          <div className="rounded-sm border border-ops-line bg-ops-panel-2 px-2.5 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-3">Category</p>
            <p className="mt-0.5 text-[15px] font-semibold leading-tight text-ops-ink">
              {selectedCategory?.name_en ?? "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-ops-ink-3">Applies to every vehicle in this category</p>
          </div>
        ) : vehicle ? (
          <VehicleIdentity
            size="lg"
            orientation="stacked"
            vehicle={{
              id: vehicle.id,
              name: vehicle.name,
              subtitle: `${vehicle.brand} ${vehicle.model}`,
              transmission: vehicle.transmission,
              registration: vehicle.internal_registration_ref,
            }}
          />
        ) : (
          <p className="text-[12px] text-ops-ink-3">No vehicles available.</p>
        )}

        {!isEdit && scope === "vehicle" ? (
          <div className="flex items-center gap-1 text-[12px]">
            <span className="text-ops-ink-3">Vehicle:</span>
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && onSelectVehicle(prev.id)}
              className="rounded-sm border border-ops-line px-1.5 py-0.5 font-semibold text-ops-header disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onSelectVehicle(next.id)}
              className="rounded-sm border border-ops-line px-1.5 py-0.5 font-semibold text-ops-header disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        ) : null}

        <fieldset className="mt-1">
          <legend className={labelClass}>Applies to</legend>
          <div className="mt-1 flex flex-col gap-1">
            <label className="flex items-center gap-1.5 text-[12px] text-ops-ink-2">
              <input
                type="radio"
                name="scope"
                value="vehicle"
                checked={scope === "vehicle"}
                onChange={() => setScope("vehicle")}
              />
              This vehicle only
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-ops-ink-2">
              <input
                type="radio"
                name="scope"
                value="category"
                checked={scope === "category"}
                onChange={() => setScope("category")}
              />
              A whole category
            </label>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ops-ink-3">
            A vehicle tariff always overrides its category on the same dates.
          </p>
        </fieldset>

        <input type="hidden" name="vehicleId" value={scope === "vehicle" ? (vehicle?.id ?? "") : ""} />
        {scope === "category" ? (
          <label className="mt-1 block">
            <span className={labelClass}>Category</span>
            <select name="categoryId" defaultValue={initial?.categoryId ?? vehicle?.category_id} className={cn(inputClass, "mt-1")}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="categoryId" value="" />
        )}
      </div>

      {/* Right — the rate grid. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9rem]">
            <span className={labelClass}>From</span>
            <input
              type="date"
              name="effectiveFrom"
              required
              defaultValue={initial?.effectiveFrom}
              className={cn(inputClass, "mt-1")}
            />
          </label>
          <label className="min-w-[9rem]">
            <span className={labelClass}>To</span>
            <input
              type="date"
              name="effectiveTo"
              required
              defaultValue={initial?.effectiveTo}
              className={cn(inputClass, "mt-1")}
            />
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className={labelClass}>Season label (optional)</span>
            <input
              type="text"
              name="label"
              placeholder="High season"
              defaultValue={initial?.label ?? ""}
              className={cn(inputClass, "mt-1")}
            />
          </label>
        </div>

        {/* Auto-fit rather than fixed breakpoint columns: this form renders
            both full width in the create panel and inside a narrower inline
            editor within the table, and viewport breakpoints know nothing
            about the container, which squeezed the rate inputs until values
            like "20.00" were clipped. */}
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr))]">
          {TIERS.map((tier) => (
            <label key={tier.name}>
              <span className={labelClass}>{tier.label}</span>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  name={tier.name}
                  placeholder="0.00"
                  defaultValue={
                    initial?.rates?.[tier.name] !== undefined
                      ? formatCentsToEuro(initial.rates[tier.name])
                      : ""
                  }
                  className={inputClass}
                  aria-label={`${tier.label} rate in euros per day`}
                />
                <span className="whitespace-nowrap text-[11px] text-ops-ink-3">€ / day</span>
              </div>
            </label>
          ))}
        </div>

        <p className="flex items-start gap-2 rounded-sm border-l-[3px] border-ops-maint bg-ops-maint/10 px-2.5 py-1.5 text-[12px] text-ops-ink-2">
          <span aria-hidden="true" className="font-bold text-ops-maint">
            !
          </span>
          <span>
            <strong className="text-ops-ink">0.00 means that rental length is not offered</strong> during this
            period — it is never a free rental. Leave a box blank to withdraw that duration, for example to
            enforce a four-night minimum in peak season.
          </span>
        </p>

        <fieldset>
          <legend className={labelClass}>Pickup points</legend>
          <p className="mb-1 text-[11px] text-ops-ink-3">
            Leave all unticked to apply at every pickup point.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {locations.map((loc) => (
              <label key={loc.id} className="flex items-center gap-1.5 text-[12px] text-ops-ink-2">
                <input
                  type="checkbox"
                  name="locationIds"
                  value={loc.id}
                  defaultChecked={initial?.locationIds?.includes(loc.id)}
                />
                {loc.name_en}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-ops-line pt-3">
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-ops-ink-2">
            <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
            Active
          </label>
          <button
            type="submit"
            disabled={pending || !canManage}
            className="rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-ops-header-2 disabled:opacity-50"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          {footerExtra}
          {state.status === "error" ? (
            <p role="alert" className="text-[12px] font-medium text-ops-booked">
              {state.error}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p role="status" className="text-[12px] font-medium text-ops-agency">
              Saved.
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
