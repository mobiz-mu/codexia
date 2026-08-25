import type { Metadata } from "next";

import { getManualBookingFormData } from "@/lib/actions/admin/manual-booking";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { ManualBookingForm, type ManualBookingVehicle } from "@/components/admin/bookings/ManualBookingForm";
import { prefillFromDate } from "@/lib/booking/prefill";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string; date?: string }>;
}) {
  const params = await searchParams;
  const data = await getManualBookingFormData();
  const { pickupAt, returnAt } = prefillFromDate(params.date);

  const preselected = params.vehicle && data.vehicles.some((v) => v.id === params.vehicle) ? params.vehicle : undefined;

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="New booking"
        subtitle="Entered at the counter — priced by the same tariff engine as the website"
        flush
      >
        <ManualBookingForm
          vehicles={data.vehicles as ManualBookingVehicle[]}
          locations={data.locations}
          extras={data.extras}
          categories={data.categories}
          initialVehicleId={preselected}
          initialPickupAt={pickupAt}
          initialReturnAt={returnAt}
        />
      </OpsPanel>
    </div>
  );
}
