import type { Metadata } from "next";
import { createIncidentRecord, listVehiclesForIncidentSelect } from "@/lib/actions/admin/incidents";
import { IncidentRecordForm } from "@/components/admin/IncidentRecordForm";

export const metadata: Metadata = { title: "Add Incident Record" };

export default async function NewIncidentRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const vehicles = await listVehiclesForIncidentSelect();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Incident Record</h1>
      <div className="max-w-3xl">
        <IncidentRecordForm
          action={createIncidentRecord}
          vehicles={vehicles}
          initial={vehicleId ? { vehicle_id: vehicleId } : undefined}
          submitLabel="Create Record"
        />
      </div>
    </div>
  );
}
