"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Option = { slug: string; label: string };

export function SearchBar({
  categories,
  locations,
}: {
  categories: Option[];
  locations: Option[];
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const pickup = form.get("pickup") as string;
    const returnAt = form.get("return") as string;

    if (pickup && new Date(pickup) < new Date()) {
      setError("Pickup date cannot be in the past");
      return;
    }
    if (pickup && returnAt && new Date(returnAt) <= new Date(pickup)) {
      setError("Return date must be after pickup date");
      return;
    }

    const params = new URLSearchParams();
    for (const key of ["category", "pickupLocation", "dropoffLocation", "pickup", "return", "passengers"]) {
      const value = form.get(key);
      if (value) params.set(key, String(value));
    }

    router.push(`/book?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid w-full max-w-5xl grid-cols-1 gap-3 rounded-xl border border-border bg-background p-4 shadow-md sm:grid-cols-2 lg:grid-cols-7"
    >
      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-category" className="text-xs font-medium text-muted">
          {t("category")}
        </label>
        <select
          id="search-category"
          name="category"
          className="rounded-lg border border-border px-2 py-2 text-sm"
        >
          <option value="">{t("anyCategory")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-pickup-location" className="text-xs font-medium text-muted">
          {t("pickupLocation")}
        </label>
        <select
          id="search-pickup-location"
          name="pickupLocation"
          required
          className="rounded-lg border border-border px-2 py-2 text-sm"
        >
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-dropoff-location" className="text-xs font-medium text-muted">
          {t("dropoffLocation")}
        </label>
        <select
          id="search-dropoff-location"
          name="dropoffLocation"
          required
          className="rounded-lg border border-border px-2 py-2 text-sm"
        >
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-pickup" className="text-xs font-medium text-muted">
          {t("pickupDate")}
        </label>
        <input
          id="search-pickup"
          name="pickup"
          type="datetime-local"
          required
          className="rounded-lg border border-border px-2 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-return" className="text-xs font-medium text-muted">
          {t("returnDate")}
        </label>
        <input
          id="search-return"
          name="return"
          type="datetime-local"
          required
          className="rounded-lg border border-border px-2 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1 lg:col-span-1">
        <label htmlFor="search-passengers" className="text-xs font-medium text-muted">
          {t("passengers")}
        </label>
        <input
          id="search-passengers"
          name="passengers"
          type="number"
          min={1}
          max={9}
          defaultValue={1}
          className="rounded-lg border border-border px-2 py-2 text-sm"
        />
      </div>

      <div className="flex items-end lg:col-span-1">
        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t("submit")}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 lg:col-span-7" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
