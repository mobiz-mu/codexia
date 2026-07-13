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
        <button type="button" onClick={onBack} className="text-sm font-medium text-primary-dark">
          {tVehicle("modifySearch")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">…</p>
      ) : vehicles.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-sm text-muted">{tVehicle("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onSelect(vehicle)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 text-left transition-shadow hover:shadow-md"
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
              <p className="text-lg font-bold text-ink">
                {formatMoney(vehicle.daily_price_cents, vehicle.currency, locale)}
                <span className="text-sm font-normal text-muted"> / day</span>
              </p>
              <span className="mt-1 self-start rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
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
