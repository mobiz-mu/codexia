import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getIncidentRecordAdmin,
  listVehiclesForIncidentSelect,
  updateIncidentRecord,
} from "@/lib/actions/admin/incidents";
import { IncidentRecordForm } from "@/components/admin/IncidentRecordForm";
import { IncidentAttachmentsPanel } from "@/components/admin/IncidentAttachmentsPanel";
import { IncidentCloseBlockButton } from "@/components/admin/IncidentCloseBlockButton";

export const metadata: Metadata = { title: "Edit Incident Record" };

export default async function EditIncidentRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ record, attachments }, vehicles] = await Promise.all([
    getIncidentRecordAdmin(id),
    listVehiclesForIncidentSelect(),
  ]);
  if (!record) notFound();

  const boundUpdate = updateIncidentRecord.bind(null, id);
  const vehicleName = (record as { vehicles?: { name: string } | null }).vehicles?.name ?? "Vehicle";
  const availabilityBlockId = (record as { availability_block_id?: string | null }).availability_block_id;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{vehicleName} — Incident Record</h1>

      {availabilityBlockId && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm text-amber-900">
            This vehicle is currently marked unavailable because of this incident.
          </p>
          <IncidentCloseBlockButton incidentId={id} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <IncidentRecordForm action={boundUpdate} vehicles={vehicles} initial={record} submitLabel="Save Changes" />
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Documents</h2>
          <IncidentAttachmentsPanel incidentId={id} attachments={attachments} />
        </div>
      </div>
    </div>
  );
}
