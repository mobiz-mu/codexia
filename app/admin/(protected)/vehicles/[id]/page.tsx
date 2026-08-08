import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicleAdmin, updateVehicle } from "@/lib/actions/admin/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { VehicleImageManager } from "@/components/admin/VehicleImageManager";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/maintenance/schema";
import { COMPACT_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/compliance/schema";
import { computeComplianceStatus } from "@/lib/compliance/status";
import { INCIDENT_TYPE_LABELS } from "@/lib/incidents/schema";
import { formatMoney } from "@/lib/pricing/format";
import { ComplianceStatusBadge } from "@/components/admin/ComplianceStatusBadge";
import { SeverityBadge, RepairStatusBadge } from "@/components/admin/IncidentBadges";

export const metadata: Metadata = { title: "Edit Vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { vehicle, images, categories, recentMaintenance, currentCompliance, recentIncidents } = await getVehicleAdmin(id);
  if (!vehicle) notFound();

  const complianceByType = new Map(currentCompliance.map((c) => [c.document_type, c]));

  const boundUpdate = updateVehicle.bind(null, id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{vehicle.name}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <VehicleForm action={boundUpdate} categories={categories} initial={vehicle} submitLabel="Save Changes" />
        </div>

        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Images</h2>
          <VehicleImageManager vehicleId={id} images={images} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Compliance</h2>
          <Link href="/admin/compliance/new" className="text-sm font-medium text-primary-dark hover:underline">
            Add / Renew
          </Link>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {COMPACT_DOCUMENT_TYPES.map((type) => {
            const current = complianceByType.get(type);
            return (
              <li key={type} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-ink">{DOCUMENT_TYPE_LABELS[type]}</p>
                  {current ? (
                    <p className="text-xs text-muted">Expires {new Date(current.expiry_date).toLocaleDateString("en-GB")}</p>
                  ) : (
                    <p className="text-xs text-muted">No record on file</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {current && <ComplianceStatusBadge {...computeComplianceStatus(current.expiry_date)} />}
                  {current ? (
                    <Link
                      href={`/admin/compliance?vehicleId=${id}&documentType=${type}`}
                      className="text-xs font-medium text-primary-dark hover:underline"
                    >
                      View history
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/compliance/new?vehicleId=${id}`}
                      className="text-xs font-medium text-primary-dark hover:underline"
                    >
                      Add
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Recent Maintenance</h2>
          <Link href={`/admin/maintenance/new`} className="text-sm font-medium text-primary-dark hover:underline">
            Add record
          </Link>
        </div>
        {recentMaintenance.length === 0 ? (
          <p className="text-sm text-muted">No maintenance records yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recentMaintenance.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <Link href={`/admin/maintenance/${r.id}`} className="font-medium text-primary-dark hover:underline">
                    {r.maintenance_type === "other"
                      ? r.custom_type ?? "Other"
                      : MAINTENANCE_TYPE_LABELS[r.maintenance_type as keyof typeof MAINTENANCE_TYPE_LABELS] ??
                        r.maintenance_type}
                  </Link>
                  <div className="text-xs text-muted">
                    {new Date(r.maintenance_date).toLocaleDateString("en-GB")}
                    {r.service_provider ? ` · ${r.service_provider}` : ""}
                  </div>
                </div>
                <span className="font-medium text-ink">{formatMoney(r.cost_cents, "EUR", "en")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink">Accidents &amp; Damage</h2>
            {recentIncidents.openCount > 0 && (
              <p className="text-xs font-medium text-red-600">{recentIncidents.openCount} open case{recentIncidents.openCount === 1 ? "" : "s"}</p>
            )}
          </div>
          <div className="flex gap-3 text-sm font-medium text-primary-dark">
            <Link href={`/admin/incidents?vehicleId=${id}`} className="hover:underline">
              View history
            </Link>
            <Link href={`/admin/incidents/new?vehicleId=${id}`} className="hover:underline">
              Add incident
            </Link>
          </div>
        </div>
        {recentIncidents.recent.length === 0 ? (
          <p className="text-sm text-muted">No incident records yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recentIncidents.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/incidents/${r.id}`} className="font-medium text-primary-dark hover:underline">
                    {r.incident_type === "other"
                      ? r.custom_type ?? "Other"
                      : INCIDENT_TYPE_LABELS[r.incident_type as keyof typeof INCIDENT_TYPE_LABELS] ?? r.incident_type}
                  </Link>
                  <div className="text-xs text-muted">
                    {new Date(r.incident_date).toLocaleDateString("en-GB")}
                    {r.downtime_start && (
                      <>
                        {" · Downtime "}
                        {new Date(r.downtime_start).toLocaleDateString("en-GB")}
                        {r.downtime_end ? ` – ${new Date(r.downtime_end).toLocaleDateString("en-GB")}` : " – ongoing"}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SeverityBadge severity={r.severity} />
                  <RepairStatusBadge status={r.repair_status} />
                  <span className="font-medium text-ink">
                    {r.actual_repair_cost_cents != null
                      ? formatMoney(r.actual_repair_cost_cents, "EUR", "en")
                      : r.estimated_repair_cost_cents != null
                        ? `~${formatMoney(r.estimated_repair_cost_cents, "EUR", "en")}`
                        : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
