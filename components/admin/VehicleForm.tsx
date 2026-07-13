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
    status: string;
    featured: boolean;
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
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Daily Price (cents)"
          name="dailyPriceCents"
          type="number"
          defaultValue={initial?.daily_price_cents}
          required
        />
        <Field label="Deposit (cents)" name="depositCents" type="number" defaultValue={initial?.deposit_cents ?? 0} />
        <Field label="Passengers" name="passengers" type="number" defaultValue={initial?.passengers ?? 5} required />
        <Field label="Doors" name="doors" type="number" defaultValue={initial?.doors ?? 4} required />
        <Field label="Luggage" name="luggage" type="number" defaultValue={initial?.luggage ?? 2} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Transmission</label>
          <select
            name="transmission"
            defaultValue={initial?.transmission ?? "manual"}
            className="rounded-lg border border-border px-3 py-2 text-sm"
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
            className="rounded-lg border border-border px-3 py-2 text-sm"
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
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="airConditioning" defaultChecked={initial?.air_conditioning ?? true} value="true" />
          Air Conditioning
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? false} value="true" />
          Featured on homepage
        </label>
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
