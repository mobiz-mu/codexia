"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { createManualBooking, type ManualBookingState } from "@/lib/actions/admin/manual-booking";
import {
  MANUAL_BOOKING_STATUSES,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_METHOD_LABELS,
} from "@/lib/booking/manual-schema";
import { DateTimeSelect } from "@/components/booking/DateTimeSelect";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { OpsSection } from "@/components/admin/ops/OpsPanel";

/**
 * Counter booking form.
 *
 * Pricing is never computed here. The form collects inputs and the server
 * action runs the same quoteBooking the public wizard uses, so a counter
 * booking and a website booking for identical inputs cannot disagree.
 */

const inputClass =
  "w-full rounded-sm border border-ops-line bg-white px-2 py-1 text-[13px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2";

export type ManualBookingVehicle = {
  id: string;
  name: string;
  brand: string;
  model: string;
  transmission: "manual" | "automatic";
  internal_registration_ref: string | null;
  category_id: string;
  is_staff_car: boolean;
};

export function ManualBookingForm({
  vehicles,
  locations,
  extras,
  categories,
  initialVehicleId,
  initialPickupAt,
  initialReturnAt,
}: {
  vehicles: ManualBookingVehicle[];
  locations: { id: string; name_en: string }[];
  extras: { id: string; name_en: string; price_cents: number; pricing_mode: string }[];
  categories: { id: string; name_en: string }[];
  initialVehicleId?: string;
  initialPickupAt?: string;
  initialReturnAt?: string;
}) {
  const [state, formAction, pending] = useActionState(createManualBooking, {
    status: "idle",
  } as ManualBookingState);

  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? vehicles[0]?.id ?? "");
  const vehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);
  const categoryName = categories.find((c) => c.id === vehicle?.category_id)?.name_en;

  if (state.status === "success") {
    return (
      <div className="rounded-sm border border-ops-success bg-ops-success/10 p-4">
        <p className="text-[13px] font-semibold text-ops-ink">
          Booking {state.reference} created.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={`/admin/bookings/${state.bookingId}`}
            className="rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white"
          >
            Open booking
          </Link>
          <Link
            href="/admin/availability"
            className="rounded-sm border border-ops-line px-3 py-1.5 text-[12px] font-semibold text-ops-ink-2"
          >
            Back to planning board
          </Link>
          <Link
            href="/admin/bookings/new"
            className="rounded-sm border border-ops-line px-3 py-1.5 text-[12px] font-semibold text-ops-ink-2"
          >
            Create another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col">
      <OpsSection title="Vehicle & dates">
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div className="flex flex-col gap-2 border-ops-line md:border-r md:pr-4">
            {vehicle ? (
              <VehicleIdentity
                size="lg"
                orientation="stacked"
                vehicle={{
                  id: vehicle.id,
                  name: vehicle.name,
                  subtitle: `${vehicle.brand} ${vehicle.model}`,
                  transmission: vehicle.transmission,
                  registration: vehicle.internal_registration_ref,
                  isStaffCar: vehicle.is_staff_car,
                }}
              />
            ) : null}
            {categoryName ? (
              <p className="text-[11px] text-ops-ink-3">Category: {categoryName}</p>
            ) : null}
            {vehicle?.is_staff_car ? (
              <p className="rounded-sm bg-ops-staff/15 px-2 py-1 text-[11px] text-ops-ink-2">
                This is a staff car. It is not publicly bookable, but you can still record internal use here.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <label className="block">
              <span className={labelClass}>Vehicle</span>
              <select
                name="vehicleId"
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className={cn(inputClass, "mt-1")}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.brand} {v.model}
                    {v.internal_registration_ref ? ` (${v.internal_registration_ref})` : ""}
                    {v.is_staff_car ? " · staff" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <DateTimeSelect
                name="pickupAt"
                id="manual-pickup"
                required
                defaultValue={initialPickupAt}
                fieldClassName={inputClass}
                labelClassName={labelClass}
                labels={{ field: "Pickup", date: "Pickup date", time: "Pickup time", meridiem: "AM or PM" }}
              />
              <DateTimeSelect
                name="returnAt"
                id="manual-return"
                required
                defaultValue={initialReturnAt}
                fieldClassName={inputClass}
                labelClassName={labelClass}
                labels={{ field: "Return", date: "Return date", time: "Return time", meridiem: "AM or PM" }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Pickup location</span>
                <select name="pickupLocationId" required className={cn(inputClass, "mt-1")}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Drop-off location</span>
                <select name="dropoffLocationId" required className={cn(inputClass, "mt-1")}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name_en}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </OpsSection>

      <OpsSection title="Customer">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Full name</span>
            <input name="customerName" required className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input name="customerEmail" type="email" placeholder="optional" className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input name="customerPhone" className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Country</span>
            <input name="customerCountry" className={cn(inputClass, "mt-1")} />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Driver age</span>
            <input name="driverAge" type="number" min={16} max={99} className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Licence country</span>
            <input name="driverLicenceCountry" className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Licence issued</span>
            <input name="driverLicenceIssueDate" type="date" className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block">
            <span className={labelClass}>Passengers</span>
            <input name="passengers" type="number" min={1} max={9} defaultValue={1} className={cn(inputClass, "mt-1")} />
          </label>
        </div>
      </OpsSection>

      {extras.length > 0 ? (
        <OpsSection title="Extras">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((e) => (
              <label key={e.id} className="flex items-center justify-between gap-2 rounded-sm border border-ops-line px-2 py-1">
                <span className="text-[12px] text-ops-ink-2">
                  {e.name_en}
                  <span className="ml-1 text-[11px] text-ops-ink-3">
                    €{(e.price_cents / 100).toFixed(2)}
                    {e.pricing_mode === "per_day" ? "/day" : ""}
                  </span>
                </span>
                <input
                  type="number"
                  name={`extra:${e.id}`}
                  min={0}
                  max={9}
                  defaultValue={0}
                  aria-label={`${e.name_en} quantity`}
                  className="w-14 rounded-sm border border-ops-line px-1 py-0.5 text-[12px] tabular-nums"
                />
              </label>
            ))}
          </div>
        </OpsSection>
      ) : null}

      <OpsSection title="Status & payment">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Booking status</span>
            <select name="status" defaultValue="confirmed" className={cn(inputClass, "mt-1")}>
              {MANUAL_BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Payment method</span>
            <select name="paymentMethod" defaultValue="unpaid" className={cn(inputClass, "mt-1")}>
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {MANUAL_PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Amount already paid (€)</span>
            <input name="paidAmount" inputMode="decimal" placeholder="0.00" className={cn(inputClass, "mt-1")} />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className={labelClass}>Internal reference / notes</span>
            <input name="internalNotes" className={cn(inputClass, "mt-1")} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ops-ink-3">
          The total is calculated by the same tariff engine the website uses — it is not entered here.
        </p>
      </OpsSection>

      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create booking"}
        </button>
        <Link
          href="/admin/availability"
          className="rounded-sm border border-ops-line px-3 py-1.5 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent"
        >
          Cancel
        </Link>

        {state.status === "error" ? (
          <div role="alert" className="w-full rounded-sm border-l-[3px] border-ops-danger bg-ops-danger/10 p-2.5">
            <p className="text-[12px] font-semibold text-ops-ink">{state.error}</p>
            {state.conflicts?.length ? (
              <ul className="mt-1.5 flex flex-col gap-1">
                {state.conflicts.map((c, i) => (
                  <li key={i} className="text-[12px] text-ops-ink-2">
                    <span className="font-semibold text-ops-ink">{c.label}</span> — {c.detail}
                    <span className="ml-1 font-mono text-[11px] text-ops-ink-3">
                      {c.from} → {c.to}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
