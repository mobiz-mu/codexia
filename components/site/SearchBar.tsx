"use client";

import { useState } from "react";
import {
  CalendarClock,
  CarFront,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

type Option = {
  slug: string;
  label: string;
};

type SearchBarProps = {
  categories: Option[];
  locations: Option[];
};

const BRAND_GRADIENT =
  "bg-gradient-to-r from-[#28a9df] via-[#1599c7] to-[#76b82a]";

export function SearchBar({
  categories,
  locations,
}: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);

    const pickup = String(form.get("pickup") ?? "");
    const returnAt = String(form.get("return") ?? "");

    if (pickup && new Date(pickup) < new Date()) {
      setError(t("pickupPastError"));
      return;
    }

    if (
      pickup &&
      returnAt &&
      new Date(returnAt) <= new Date(pickup)
    ) {
      setError(t("returnBeforePickupError"));
      return;
    }

    const params = new URLSearchParams();

    const fields = [
      "category",
      "pickupLocation",
      "dropoffLocation",
      "pickup",
      "return",
      "passengers",
    ] as const;

    for (const key of fields) {
      const value = form.get(key);

      if (value) {
        params.set(key, String(value));
      }
    }

    router.push(`/book?${params.toString()}`);
  }

  const fieldClass = cn(
    "h-[54px] w-full min-w-0 rounded-xl",
    "border border-slate-200 bg-white",
    "px-3.5 text-[14px] font-medium text-slate-900",
    "shadow-[0_2px_5px_rgba(15,35,60,0.04)]",
    "outline-none transition-all duration-200",
    "placeholder:text-slate-400",
    "hover:border-sky-300",
    "focus:border-[#1599c7]",
    "focus:ring-4 focus:ring-[#1599c7]/10"
  );

  const labelClass = cn(
    "flex min-h-5 items-center gap-1.5",
    "whitespace-nowrap text-[12px] font-bold",
    "leading-none text-slate-700"
  );

  const iconClass =
    "h-4 w-4 shrink-0 text-[#1599c7]";

  return (
    <div className="mx-auto w-full max-w-[1420px] px-4 sm:px-6 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "w-full rounded-[24px]",
          "border border-slate-200/90 bg-white",
          "p-4 sm:p-5",
          "shadow-[0_20px_55px_rgba(17,47,84,0.14)]"
        )}
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            "sm:grid-cols-2",
            "lg:grid-cols-3",
            "xl:grid-cols-[1.18fr_1.45fr_1.45fr_1.30fr_1.30fr_0.78fr_0.88fr]",
            "xl:items-end xl:gap-3"
          )}
        >
          {/* Category */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-category"
              className={labelClass}
            >
              <CarFront
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("category")}</span>
            </label>

            <div className="relative min-w-0">
              <select
                id="search-category"
                name="category"
                className={cn(
                  fieldClass,
                  "cursor-pointer appearance-none pr-10"
                )}
              >
                <option value="">
                  {t("anyCategory")}
                </option>

                {categories.map((category) => (
                  <option
                    key={category.slug}
                    value={category.slug}
                  >
                    {category.label}
                  </option>
                ))}
              </select>

              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-3.5 top-1/2",
                  "h-0 w-0 -translate-y-1/2",
                  "border-x-[4px] border-t-[5px]",
                  "border-x-transparent border-t-slate-500"
                )}
              />
            </div>
          </div>

          {/* Pickup location */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-pickup-location"
              className={labelClass}
            >
              <MapPin
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("pickupLocation")}</span>
            </label>

            <div className="relative min-w-0">
              <select
                id="search-pickup-location"
                name="pickupLocation"
                required
                className={cn(
                  fieldClass,
                  "cursor-pointer appearance-none pr-10"
                )}
              >
                {locations.map((location) => (
                  <option
                    key={location.slug}
                    value={location.slug}
                  >
                    {location.label}
                  </option>
                ))}
              </select>

              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-3.5 top-1/2",
                  "h-0 w-0 -translate-y-1/2",
                  "border-x-[4px] border-t-[5px]",
                  "border-x-transparent border-t-slate-500"
                )}
              />
            </div>
          </div>

          {/* Drop-off location */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-dropoff-location"
              className={labelClass}
            >
              <MapPin
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("dropoffLocation")}</span>
            </label>

            <div className="relative min-w-0">
              <select
                id="search-dropoff-location"
                name="dropoffLocation"
                required
                className={cn(
                  fieldClass,
                  "cursor-pointer appearance-none pr-10"
                )}
              >
                {locations.map((location) => (
                  <option
                    key={location.slug}
                    value={location.slug}
                  >
                    {location.label}
                  </option>
                ))}
              </select>

              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-3.5 top-1/2",
                  "h-0 w-0 -translate-y-1/2",
                  "border-x-[4px] border-t-[5px]",
                  "border-x-transparent border-t-slate-500"
                )}
              />
            </div>
          </div>

          {/* Pickup date */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-pickup"
              className={labelClass}
            >
              <CalendarClock
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("pickupDate")}</span>
            </label>

            <input
              id="search-pickup"
              name="pickup"
              type="datetime-local"
              required
              className={cn(
                fieldClass,
                "min-w-0 [color-scheme:light]"
              )}
            />
          </div>

          {/* Return date */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-return"
              className={labelClass}
            >
              <CalendarClock
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("returnDate")}</span>
            </label>

            <input
              id="search-return"
              name="return"
              type="datetime-local"
              required
              className={cn(
                fieldClass,
                "min-w-0 [color-scheme:light]"
              )}
            />
          </div>

          {/* Passengers */}
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="search-passengers"
              className={labelClass}
            >
              <Users
                className={iconClass}
                aria-hidden="true"
              />

              <span>{t("passengers")}</span>
            </label>

            <input
              id="search-passengers"
              name="passengers"
              type="number"
              min={1}
              max={9}
              defaultValue={1}
              inputMode="numeric"
              className={fieldClass}
            />
          </div>

          {/* Search */}
          <div className="flex min-w-0 flex-col gap-2">
            <span
              aria-hidden="true"
              className="hidden min-h-5 xl:block"
            />

            <button
              type="submit"
              className={cn(
                "group relative flex h-[54px] w-full",
                "items-center justify-center gap-2",
                "overflow-hidden rounded-xl px-4",
                BRAND_GRADIENT,
                "text-[14px] font-bold text-white",
                "shadow-[0_10px_24px_rgba(21,153,199,0.25)]",
                "transition-all duration-300",
                "hover:-translate-y-0.5",
                "hover:shadow-[0_14px_30px_rgba(21,153,199,0.34)]",
                "focus-visible:outline-none",
                "focus-visible:ring-4",
                "focus-visible:ring-[#1599c7]/20",
                "active:translate-y-0"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 -left-1/2",
                  "w-1/3 skew-x-[-22deg]",
                  "bg-white/25 blur-sm",
                  "transition-transform duration-700",
                  "group-hover:translate-x-[430%]"
                )}
              />

              <Search
                className="relative h-4 w-4 shrink-0"
                aria-hidden="true"
              />

              <span className="relative whitespace-nowrap">
                {t("searchButton")}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className={cn(
              "mt-3 rounded-xl border border-red-200",
              "bg-red-50 px-4 py-2.5",
              "text-sm font-medium text-red-700"
            )}
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}