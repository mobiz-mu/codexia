import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMaintenanceRecordAdmin,
  listVehiclesForMaintenanceSelect,
  updateMaintenanceRecord,
} from "@/lib/actions/admin/maintenance";
import { MaintenanceRecordForm } from "@/components/admin/MaintenanceRecordForm";
import { MaintenanceAttachmentsPanel } from "@/components/admin/MaintenanceAttachmentsPanel";

export const metadata: Metadata = { title: "Edit Maintenance Record" };

export default async function EditMaintenanceRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Independent reads, fetched in parallel — the vehicle picker's options
  // don't depend on which record is being edited.
  const [{ record, attachments }, vehicles] = await Promise.all([
    getMaintenanceRecordAdmin(id),
    listVehiclesForMaintenanceSelect(),
  ]);
  if (!record) notFound();

  const boundUpdate = updateMaintenanceRecord.bind(null, id);
  const vehicleName = (record as { vehicles?: { name: string } | null }).vehicles?.name ?? "Vehicle";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{vehicleName} — Maintenance Record</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <MaintenanceRecordForm action={boundUpdate} vehicles={vehicles} initial={record} submitLabel="Save Changes" />
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Documents</h2>
          <MaintenanceAttachmentsPanel recordId={id} attachments={attachments} />
        </div>
      </div>
    </div>
  );
}
