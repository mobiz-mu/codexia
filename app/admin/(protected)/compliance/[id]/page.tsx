import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getComplianceRecordAdmin,
  listVehiclesForComplianceSelect,
  updateComplianceRecord,
} from "@/lib/actions/admin/compliance";
import { ComplianceRecordForm } from "@/components/admin/ComplianceRecordForm";
import { ComplianceAttachmentsPanel } from "@/components/admin/ComplianceAttachmentsPanel";

export const metadata: Metadata = { title: "Edit Compliance Record" };

export default async function EditComplianceRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ record, attachments }, vehicles] = await Promise.all([
    getComplianceRecordAdmin(id),
    listVehiclesForComplianceSelect(),
  ]);
  if (!record) notFound();

  const boundUpdate = updateComplianceRecord.bind(null, id);
  const vehicleName = (record as { vehicles?: { name: string } | null }).vehicles?.name ?? "Vehicle";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{vehicleName} — Compliance Record</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <ComplianceRecordForm action={boundUpdate} vehicles={vehicles} initial={record} submitLabel="Save Changes" />
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Documents</h2>
          <ComplianceAttachmentsPanel recordId={id} attachments={attachments} />
        </div>
      </div>
    </div>
  );
}
