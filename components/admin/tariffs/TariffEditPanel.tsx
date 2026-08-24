"use client";

import Link from "next/link";
import { useState } from "react";

import { updateTariffPeriod } from "@/lib/actions/admin/tariffs";
import { TariffRateForm, type TariffFormInitial, type TariffFormVehicle } from "./TariffRateForm";

/**
 * Inline editor for one existing tariff period, expanded under its row in the
 * listing — the same place the reference system opens "Modifier".
 *
 * This is a thin binding layer, not a second form: it pre-binds the period id
 * to the existing updateTariffPeriod action and hands everything else to the
 * same TariffRateForm the create panel uses, so the two can never drift apart
 * in layout, validation or the meaning of a zero rate.
 */
export function TariffEditPanel({
  periodId,
  initial,
  vehicles,
  categories,
  locations,
  canManage,
  closeHref,
}: {
  periodId: string;
  initial: TariffFormInitial;
  vehicles: TariffFormVehicle[];
  categories: { id: string; name_en: string }[];
  locations: { id: string; name_en: string }[];
  canManage: boolean;
  /** Where Cancel returns to — the same listing without the edit param. */
  closeHref: string;
}) {
  // Bound here rather than in the page so the server component never has to
  // hand a function across the boundary.
  const [action] = useState(() => updateTariffPeriod.bind(null, periodId));

  return (
    <div className="border-l-[3px] border-ops-accent bg-ops-panel-2 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ops-header">
        Modify tariff period
      </p>
      <TariffRateForm
        mode="edit"
        action={action}
        vehicles={vehicles}
        categories={categories}
        locations={locations}
        selectedVehicleId={initial.vehicleId ?? null}
        onSelectVehicle={() => {}}
        initial={initial}
        submitLabel="Save changes"
        canManage={canManage}
        footerExtra={
          <Link
            href={closeHref}
            className="rounded-sm border border-ops-line px-2.5 py-1.5 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
          >
            Cancel
          </Link>
        }
      />
    </div>
  );
}
