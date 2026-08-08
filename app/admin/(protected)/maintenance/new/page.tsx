import type { Metadata } from "next";
import { createMaintenanceRecord, listVehiclesForMaintenanceSelect } from "@/lib/actions/admin/maintenance";
import { MaintenanceRecordForm } from "@/components/admin/MaintenanceRecordForm";

export const metadata: Metadata = { title: "Add Maintenance Record" };

export default async function NewMaintenanceRecordPage() {
  const vehicles = await listVehiclesForMaintenanceSelect();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Maintenance Record</h1>
      <div className="max-w-3xl rounded-xl border border-border bg-background p-6">
        <MaintenanceRecordForm action={createMaintenanceRecord} vehicles={vehicles} submitLabel="Create Record" />
      </div>
    </div>
  );
}
