"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { BookingCriteria } from "../types";
import { DateTimeSelect } from "../DateTimeSelect";

type Option = { slug: string; label: string };

const fieldClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function SearchStep({
  categories,
  locations,
  criteria,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  categories: Option[];
  locations: Option[];
  criteria: BookingCriteria;
  onChange: (criteria: BookingCriteria) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("search");
  const tBooking = useTranslations("booking");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="wizard-category" className="text-sm font-medium text-ink">
            {t("category")}
          </label>
          <select
            id="wizard-category"
            value={criteria.categorySlug}
            onChange={(e) => onChange({ ...criteria, categorySlug: e.target.value })}
            className={fieldClass}
          >
            <option value="">{t("anyCategory")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="wizard-passengers" className="text-sm font-medium text-ink">
            {t("passengers")}
          </label>
          <input
            id="wizard-passengers"
            type="number"
            min={1}
            max={9}
            value={criteria.passengers}
            onChange={(e) => onChange({ ...criteria, passengers: Number(e.target.value) })}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="wizard-pickup-location" className="text-sm font-medium text-ink">
            {t("pickupLocation")}
          </label>
          <select
            id="wizard-pickup-location"
            required
            value={criteria.pickupLocationSlug}
            onChange={(e) => onChange({ ...criteria, pickupLocationSlug: e.target.value })}
            className={fieldClass}
          >
            <option value="" disabled>
              —
            </option>
            {locations.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="wizard-dropoff-location" className="text-sm font-medium text-ink">
            {t("dropoffLocation")}
          </label>
          <select
            id="wizard-dropoff-location"
            required
            value={criteria.dropoffLocationSlug}
            onChange={(e) => onChange({ ...criteria, dropoffLocationSlug: e.target.value })}
            className={fieldClass}
          >
            <option value="" disabled>
              —
            </option>
            {locations.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/*
          The same half-hour / AM-PM control the homepage search uses. The
          wizard kept a raw datetime-local for a while, so a customer arriving
          through the navigation could pick 09:07 while one arriving from the
          homepage could not — two different pickup rules in one funnel. It
          submits the identical `YYYY-MM-DDTHH:mm` string, so criteria,
          validation, pricing and the availability query are untouched.
        */}
        <DateTimeSelect
          id="wizard-pickup"
          name="pickupAt"
          required
          defaultValue={criteria.pickupAt}
          fieldClassName={fieldClass}
          labelClassName="text-sm font-medium text-ink"
          labels={{
            field: t("pickupDate"),
            date: t("dateLabel"),
            time: t("pickupTime"),
            meridiem: t("meridiemLabel"),
          }}
          onChange={(value) => onChange({ ...criteria, pickupAt: value })}
        />

        <DateTimeSelect
          id="wizard-return"
          name="returnAt"
          required
          defaultValue={criteria.returnAt}
          fieldClassName={fieldClass}
          labelClassName="text-sm font-medium text-ink"
          labels={{
            field: t("returnDate"),
            date: t("dateLabel"),
            time: t("returnTime"),
            meridiem: t("meridiemLabel"),
          }}
          onChange={(value) => onChange({ ...criteria, returnAt: value })}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 self-start rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        {tBooking("continue")}
      </button>
    </form>
  );
}
