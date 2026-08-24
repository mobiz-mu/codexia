"use client";

import { useState } from "react";

import { createTariffPeriod } from "@/lib/actions/admin/tariffs";
import { TariffRateForm, type TariffFormVehicle } from "./TariffRateForm";

/** Holds the vehicle the operator is currently pricing as they step through the fleet. */
export function TariffWorkspace({
  vehicles,
  categories,
  locations,
  canManage,
}: {
  vehicles: TariffFormVehicle[];
  categories: { id: string; name_en: string }[];
  locations: { id: string; name_en: string }[];
  canManage: boolean;
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(vehicles[0]?.id ?? null);

  return (
    <TariffRateForm
      action={createTariffPeriod}
      vehicles={vehicles}
      categories={categories}
      locations={locations}
      selectedVehicleId={selectedVehicleId}
      onSelectVehicle={setSelectedVehicleId}
      canManage={canManage}
    />
  );
}
