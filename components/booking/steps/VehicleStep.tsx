"use client";

import { useTranslations } from "next-intl";
import { Users, DoorOpen, Luggage } from "lucide-react";
import { formatMoney } from "@/lib/pricing/format";
import type { VehicleWithImages } from "@/lib/data/vehicles";

export function VehicleStep({
  vehicles,
  loading,
  locale,
  onSelect,
  onBack,
}: {
  vehicles: VehicleWithImages[];
  loading: boolean;
  locale: string;
  onSelect: (vehicle: VehicleWithImages) => void;
  onBack: () => void;
}) {
  const t = useTranslations("booking");
  const tVehicle = useTranslations("booking.vehicleStep");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">{tVehicle("title")}</h2>
        <button type="button" onClick={onBack} className="text-sm font-medium text-primary-dark transition-colors hover:underline">
          {tVehicle("modifySearch")}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-surface" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-surface" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-surface" />
              <div className="mt-1 h-8 w-24 animate-pulse rounded-full bg-surface" />
            </div>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-sm text-muted">{tVehicle("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onSelect(vehicle)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:border-primary focus-visible:shadow-md"
            >
              <h3 className="font-semibold text-ink">{vehicle.name}</h3>
              <ul className="flex gap-3 text-xs text-muted">
                <li className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  {vehicle.passengers}
                </li>
                <li className="flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  {vehicle.doors}
                </li>
                <li className="flex items-center gap-1">
                  <Luggage className="h-3.5 w-3.5" aria-hidden="true" />
                  {vehicle.luggage}
                </li>
              </ul>
              <p className="text-lg font-bold text-action-dark">
                {formatMoney(vehicle.daily_price_cents, vehicle.currency, locale)}
                <span className="text-sm font-normal text-muted"> / day</span>
              </p>
              <span className="mt-1 self-start rounded-full bg-action px-4 py-1.5 text-xs font-semibold text-ink shadow-sm">
                {tVehicle("select")}
              </span>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onBack} className="self-start text-sm font-medium text-muted">
        {t("back")}
      </button>
    </div>
  );
}
