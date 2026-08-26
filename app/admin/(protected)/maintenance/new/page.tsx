import type { Metadata } from "next";
import Link from "next/link";
import { createMaintenanceRecord, listVehiclesForMaintenanceSelect } from "@/lib/actions/admin/maintenance";
import { MaintenanceRecordForm } from "@/components/admin/MaintenanceRecordForm";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";

export const metadata: Metadata = { title: "Add Maintenance Record" };

export default async function NewMaintenanceRecordPage() {
  const vehicles = await listVehiclesForMaintenanceSelect();

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="New maintenance record"
        subtitle="All costs in Mauritian Rupees"
        actions={
          <Link
            href="/admin/maintenance"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            Back to list
          </Link>
        }
      >
        <MaintenanceRecordForm action={createMaintenanceRecord} vehicles={vehicles} submitLabel="Create record" />
      </OpsPanel>
    </div>
  );
}
