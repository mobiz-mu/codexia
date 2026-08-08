"use client";

import { useActionState } from "react";
import type { VehicleFormState } from "@/lib/actions/admin/vehicles";

export function VehicleForm({
  action,
  categories,
  initial,
  submitLabel,
}: {
  action: (prev: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  categories: { id: string; name_en: string }[];
  initial?: Partial<{
    name: string;
    brand: string;
    model: string;
    year: number;
    category_id: string;
    description_en: string | null;
    description_fr: string | null;
    daily_price_cents: number;
    deposit_cents: number;
    passengers: number;
    doors: number;
    luggage: number;
    transmission: string;
    fuel: string;
    air_conditioning: boolean;
    bluetooth: boolean;
    gps: boolean;
    child_seat_available: boolean;
    status: string;
    featured: boolean;
    internal_registration_ref: string | null;
    vin: string | null;
    engine_number: string | null;
    last_service_date: string | null;
    next_service_date: string | null;
    current_mileage_km: number | null;
    weekly_price_cents: number | null;
    monthly_price_cents: number | null;
    currency: string;
  }>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as VehicleFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={initial?.name} required />
        <Field label="Brand" name="brand" defaultValue={initial?.brand} required />
        <Field label="Model" name="model" defaultValue={initial?.model} required />
        <Field label="Year" name="year" type="number" defaultValue={initial?.year} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Category</label>
          <select
            name="categoryId"
            defaultValue={initial?.category_id}
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Daily Price (EUR cents)"
          name="dailyPriceCents"
          type="number"
          defaultValue={initial?.daily_price_cents}
          required
        />
        <Field label="Deposit (EUR cents)" name="depositCents" type="number" defaultValue={initial?.deposit_cents ?? 0} />
        <Field label="Weekly Rate (EUR cents)" name="weeklyPriceCents" type="number" defaultValue={initial?.weekly_price_cents ?? undefined} />
        <Field label="Monthly Rate (EUR cents)" name="monthlyPriceCents" type="number" defaultValue={initial?.monthly_price_cents ?? undefined} />

        {initial && initial.currency && initial.currency !== "EUR" && (
          <div className="sm:col-span-2 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              This vehicle is still priced in <strong>{initial.currency}</strong> (legacy) and will not appear on
              the public site or be bookable until it is priced in EUR. The price fields above have NOT been
              converted — re-enter the Daily/Weekly/Monthly/Deposit values in real EUR cents before checking the
              box below.
            </p>
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="confirmEurRepricing" value="true" />
              I have re-entered the prices above in EUR — mark this vehicle as EUR-priced
            </label>
          </div>
        )}

        <Field label="Passengers" name="passengers" type="number" defaultValue={initial?.passengers ?? 5} required />
        <Field label="Doors" name="doors" type="number" defaultValue={initial?.doors ?? 4} required />
        <Field label="Luggage" name="luggage" type="number" defaultValue={initial?.luggage ?? 2} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Transmission</label>
          <select
            name="transmission"
            defaultValue={initial?.transmission ?? "manual"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Fuel</label>
          <select
            name="fuel"
            defaultValue={initial?.fuel ?? "petrol"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Status</label>
          <select
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="airConditioning" defaultChecked={initial?.air_conditioning ?? true} value="true" className="h-4 w-4 accent-primary" />
          Air Conditioning
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="bluetooth" defaultChecked={initial?.bluetooth ?? true} value="true" className="h-4 w-4 accent-primary" />
          Bluetooth
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="gps" defaultChecked={initial?.gps ?? false} value="true" className="h-4 w-4 accent-primary" />
          GPS
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="childSeatAvailable"
            defaultChecked={initial?.child_seat_available ?? false}
            value="true"
            className="h-4 w-4 accent-primary"
          />
          Child Seat Available
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? false} value="true" className="h-4 w-4 accent-primary" />
          Featured on homepage
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Fleet &amp; Compliance</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Registration Number" name="registrationNumber" defaultValue={initial?.internal_registration_ref ?? undefined} />
        <Field label="VIN" name="vin" defaultValue={initial?.vin ?? undefined} />
        <Field label="Engine Number" name="engineNumber" defaultValue={initial?.engine_number ?? undefined} />
        <Field label="Current Mileage (km)" name="currentMileageKm" type="number" defaultValue={initial?.current_mileage_km ?? undefined} />
        {/* Insurance/Road Tax/Fitness expiry fields removed — this data now
            lives in Fleet Documents & Compliance (vehicle_compliance_records),
            which supports renewal history. See "Compliance" on the vehicle
            detail page. */}
        <Field label="Last Service Date" name="lastServiceDate" type="date" defaultValue={initial?.last_service_date ?? undefined} />
        <Field label="Next Service Date" name="nextServiceDate" type="date" defaultValue={initial?.next_service_date ?? undefined} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Description (EN)</label>
        <textarea
          name="descriptionEn"
          defaultValue={initial?.description_en ?? undefined}
          rows={3}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Description (FR)</label>
        <textarea
          name="descriptionFr"
          defaultValue={initial?.description_fr ?? undefined}
          rows={3}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg bg-action-tint px-3 py-2 text-sm text-action-dark" role="status">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-ink">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}
