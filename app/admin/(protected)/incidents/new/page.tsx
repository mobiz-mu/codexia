import type { Metadata } from "next";
import Link from "next/link";
import { createIncidentRecord, listVehiclesForIncidentSelect } from "@/lib/actions/admin/incidents";
import { IncidentRecordForm } from "@/components/admin/IncidentRecordForm";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";

export const metadata: Metadata = { title: "Add Incident Record" };

export default async function NewIncidentRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const vehicles = await listVehiclesForIncidentSelect();

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="New incident record"
        subtitle="All repair costs in Mauritian Rupees"
        actions={
          <Link
            href="/admin/incidents"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            Back to list
          </Link>
        }
      >
        <IncidentRecordForm
          action={createIncidentRecord}
          vehicles={vehicles}
          initial={vehicleId ? { vehicle_id: vehicleId } : undefined}
          submitLabel="Create record"
        />
      </OpsPanel>
    </div>
  );
}
