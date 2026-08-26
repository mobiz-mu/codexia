import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMaintenanceRecordAdmin,
  listVehiclesForMaintenanceSelect,
  updateMaintenanceRecord,
} from "@/lib/actions/admin/maintenance";
import { MaintenanceRecordForm } from "@/components/admin/MaintenanceRecordForm";
import { MaintenanceAttachmentsPanel } from "@/components/admin/MaintenanceAttachmentsPanel";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { formatMoney } from "@/lib/pricing/format";
import { resolveMaintenanceCostBreakdown } from "@/lib/maintenance/schema";

export const metadata: Metadata = { title: "Edit Maintenance Record" };

type RecordVehicle = {
  name: string;
  brand: string | null;
  model: string | null;
  transmission: "manual" | "automatic" | null;
  internal_registration_ref: string | null;
};

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
  const r = record as unknown as {
    vehicles?: RecordVehicle | null;
    vehicle_id: string;
    cost_cents: number;
    parts_cost_cents: number | null;
    labour_cost_cents: number | null;
    other_cost_cents: number | null;
    maintenance_date: string;
    availability_block_id: string | null;
  };
  const v = r.vehicles ?? null;
  const breakdown = resolveMaintenanceCostBreakdown(r);
  // A legacy lump sum is labelled as such rather than being presented beside
  // three zeroed components that look like a reconciliation failure.
  const costSummary =
    breakdown.kind === "none"
      ? "No cost recorded"
      : breakdown.kind === "unitemised"
        ? `Unitemised total ${formatMoney(breakdown.total, "MUR", "en")}`
        : `Total ${formatMoney(breakdown.total, "MUR", "en")}`;

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Maintenance record"
        subtitle={`${r.maintenance_date} · ${costSummary}`}
        actions={
          <Link
            href="/admin/maintenance"
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
          {r.availability_block_id ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-ops-maint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <span aria-hidden="true">M</span> Off road
            </span>
          ) : (
            <span className="text-[11px] text-ops-ink-3">History only — vehicle not blocked</span>
          )}
        </div>
      </OpsPanel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OpsPanel title="Details" subtitle="All costs in Mauritian Rupees" className="lg:col-span-2">
          <MaintenanceRecordForm action={boundUpdate} vehicles={vehicles} initial={record} submitLabel="Save changes" />
        </OpsPanel>
        <OpsPanel title="Documents" subtitle="Invoices and job cards">
          <MaintenanceAttachmentsPanel recordId={id} attachments={attachments} />
        </OpsPanel>
      </div>
    </div>
  );
}
