import type { Metadata } from "next";
import { createComplianceRecord, listVehiclesForComplianceSelect } from "@/lib/actions/admin/compliance";
import { ComplianceRecordForm } from "@/components/admin/ComplianceRecordForm";

export const metadata: Metadata = { title: "Add Compliance Record" };

export default async function NewComplianceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const vehicles = await listVehiclesForComplianceSelect();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Compliance Record</h1>
      <div className="max-w-3xl rounded-xl border border-border bg-background p-6">
        <ComplianceRecordForm
          action={createComplianceRecord}
          vehicles={vehicles}
          initial={vehicleId ? { vehicle_id: vehicleId } : undefined}
          submitLabel="Create Record"
        />
      </div>
    </div>
  );
}
