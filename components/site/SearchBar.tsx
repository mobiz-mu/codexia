"use client";

import { useState } from "react";
import { Car, MapPin, CalendarClock, Users, Search } from "lucide-react";
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

  const fieldClass =
    "w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid w-full max-w-5xl grid-cols-1 gap-4 rounded-2xl border border-border bg-background p-5 shadow-lg sm:grid-cols-2 sm:p-6 lg:grid-cols-7 lg:items-end lg:gap-3"
    >
      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label htmlFor="search-category" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Car className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("category")}
        </label>
        <select id="search-category" name="category" className={fieldClass}>
          <option value="">{t("anyCategory")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label
          htmlFor="search-pickup-location"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted"
        >
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("pickupLocation")}
        </label>
        <select id="search-pickup-location" name="pickupLocation" required className={fieldClass}>
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label
          htmlFor="search-dropoff-location"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted"
        >
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("dropoffLocation")}
        </label>
        <select id="search-dropoff-location" name="dropoffLocation" required className={fieldClass}>
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label htmlFor="search-pickup" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("pickupDate")}
        </label>
        <input id="search-pickup" name="pickup" type="datetime-local" required className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label htmlFor="search-return" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("returnDate")}
        </label>
        <input id="search-return" name="return" type="datetime-local" required className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <label htmlFor="search-passengers" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t("passengers")}
        </label>
        <input
          id="search-passengers"
          name="passengers"
          type="number"
          min={1}
          max={9}
          defaultValue={1}
          className={fieldClass}
        />
      </div>

      <div className="lg:col-span-1">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t("submit")}
        </button>
      </div>

      {error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-7"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}
    </form>
  );
}
