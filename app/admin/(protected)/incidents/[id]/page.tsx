import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getIncidentRecordAdmin,
  listVehiclesForIncidentSelect,
  updateIncidentRecord,
} from "@/lib/actions/admin/incidents";
import { IncidentRecordForm } from "@/components/admin/IncidentRecordForm";
import { IncidentAttachmentsPanel } from "@/components/admin/IncidentAttachmentsPanel";
import { IncidentCloseBlockButton } from "@/components/admin/IncidentCloseBlockButton";
import { SeverityBadge, RepairStatusBadge } from "@/components/admin/IncidentBadges";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import type { RepairStatus, Severity } from "@/lib/incidents/schema";

export const metadata: Metadata = { title: "Edit Incident Record" };

type RecordVehicle = {
  name: string;
  brand: string | null;
  model: string | null;
  transmission: "manual" | "automatic" | null;
  internal_registration_ref: string | null;
};

export default async function EditIncidentRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ record, attachments }, vehicles] = await Promise.all([
    getIncidentRecordAdmin(id),
    listVehiclesForIncidentSelect(),
  ]);
  if (!record) notFound();

  const boundUpdate = updateIncidentRecord.bind(null, id);
  const r = record as unknown as {
    vehicles?: RecordVehicle | null;
    vehicle_id: string;
    incident_date: string;
    severity: Severity;
    repair_status: RepairStatus;
    availability_block_id?: string | null;
  };
  const v = r.vehicles ?? null;
  const availabilityBlockId = r.availability_block_id;

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Incident record"
        subtitle={r.incident_date}
        actions={
          <Link
            href="/admin/incidents"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            Back to list
          </Link>
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          {v ? (
            <VehicleIdentity
              size="lg"
              vehicle={{
                id: r.vehicle_id,
                name: v.name,
                subtitle: `${v.brand ?? ""} ${v.model ?? ""}`.trim() || null,
                transmission: v.transmission,
                registration: v.internal_registration_ref,
              }}
            />
          ) : (
            <p className="text-[13px] text-ops-ink-3">Vehicle no longer on the fleet.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={r.severity} />
            <RepairStatusBadge status={r.repair_status} />
          </div>
        </div>
      </OpsPanel>

      {availabilityBlockId ? (
        <OpsPanel title="Vehicle off road" subtitle="This incident is holding the vehicle out of service">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ops-ink-2">
              The vehicle is unavailable for booking while this block is open. Closing it releases the car from
              today onwards; the downtime already served is kept.
            </p>
            <IncidentCloseBlockButton incidentId={id} />
          </div>
        </OpsPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OpsPanel title="Details" subtitle="All repair costs in Mauritian Rupees" className="lg:col-span-2">
          <IncidentRecordForm action={boundUpdate} vehicles={vehicles} initial={record} submitLabel="Save changes" />
        </OpsPanel>
        <OpsPanel title="Documents" subtitle="Photos, reports and insurance papers">
          <IncidentAttachmentsPanel incidentId={id} attachments={attachments} />
        </OpsPanel>
      </div>
    </div>
  );
}
