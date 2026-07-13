"use client";

import { useTranslations } from "next-intl";
import type { BookingCustomer } from "../types";

export function DetailsStep({
  customer,
  onChange,
  isAirportPickup,
  onContinue,
  onBack,
  error,
}: {
  customer: BookingCustomer;
  onChange: (customer: BookingCustomer) => void;
  isAirportPickup: boolean;
  onContinue: () => void;
  onBack: () => void;
  error: string | null;
}) {
  const t = useTranslations("booking");
  const d = useTranslations("booking.detailsStep");

  function set<K extends keyof BookingCustomer>(key: K, value: BookingCustomer[K]) {
    onChange({ ...customer, [key]: value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onContinue();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-ink">{d("title")}</h2>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-muted">{d("customerSection")}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={d("fullName")} value={customer.fullName} onChange={(v) => set("fullName", v)} required />
          <Field
            label={d("email")}
            type="email"
            value={customer.email}
            onChange={(v) => set("email", v)}
            required
          />
          <Field label={d("phone")} type="tel" value={customer.phone} onChange={(v) => set("phone", v)} required />
          <Field label={d("whatsapp")} type="tel" value={customer.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label={d("country")} value={customer.country} onChange={(v) => set("country", v)} required />
          <Field label={d("address")} value={customer.address} onChange={(v) => set("address", v)} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-muted">{d("driverSection")}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label={d("age")}
            type="number"
            value={customer.driverAge}
            onChange={(v) => set("driverAge", v)}
            required
          />
          <Field
            label={d("licenceCountry")}
            value={customer.licenceCountry}
            onChange={(v) => set("licenceCountry", v)}
            required
          />
          <Field
            label={d("licenceIssueDate")}
            type="date"
            value={customer.licenceIssueDate}
            onChange={(v) => set("licenceIssueDate", v)}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={customer.hasSecondDriver}
            onChange={(e) => set("hasSecondDriver", e.target.checked)}
          />
          {d("addSecondDriver")}
        </label>

        {customer.hasSecondDriver && (
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface p-3 sm:grid-cols-2">
            <Field
              label={d("secondDriverName")}
              value={customer.secondDriverName}
              onChange={(v) => set("secondDriverName", v)}
              required
            />
            <Field
              label={d("age")}
              type="number"
              value={customer.secondDriverAge}
              onChange={(v) => set("secondDriverAge", v)}
              required
            />
            <Field
              label={d("licenceCountry")}
              value={customer.secondDriverLicenceCountry}
              onChange={(v) => set("secondDriverLicenceCountry", v)}
              required
            />
            <Field
              label={d("licenceIssueDate")}
              type="date"
              value={customer.secondDriverLicenceIssueDate}
              onChange={(v) => set("secondDriverLicenceIssueDate", v)}
              required
            />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-muted">{d("flightSection")}</legend>
        {isAirportPickup && <p className="text-xs text-accent">{d("flightNotice")}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={d("flightNumber")}
            value={customer.flightNumber}
            onChange={(v) => set("flightNumber", v)}
            required={isAirportPickup}
          />
          <Field
            label={d("flightAirline")}
            value={customer.flightAirline}
            onChange={(v) => set("flightAirline", v)}
          />
          <Field
            label={d("flightArrivalDate")}
            type="date"
            value={customer.flightArrivalDate}
            onChange={(v) => set("flightArrivalDate", v)}
          />
          <Field
            label={d("flightArrivalTime")}
            type="time"
            value={customer.flightArrivalTime}
            onChange={(v) => set("flightArrivalTime", v)}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="details-special-requests" className="text-sm font-medium text-ink">
          {d("specialRequests")}
        </label>
        <textarea
          id="details-special-requests"
          rows={3}
          value={customer.specialRequests}
          onChange={(e) => set("specialRequests", e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted">
          {t("back")}
        </button>
        <button
          type="submit"
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t("continue")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-ink">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}
