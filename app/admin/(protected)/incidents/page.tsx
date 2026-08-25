import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listIncidentRecordsAdmin, listVehiclesForIncidentSelect } from "@/lib/actions/admin/incidents";
import { INCIDENT_TYPE_LABELS, SEVERITIES, SEVERITY_LABELS, REPAIR_STATUSES, REPAIR_STATUS_LABELS } from "@/lib/incidents/schema";
import { formatMoney } from "@/lib/pricing/format";
import { SeverityBadge, RepairStatusBadge } from "@/components/admin/IncidentBadges";
import { IncidentDeleteButton } from "@/components/admin/IncidentDeleteButton";
import { PageHeader, PageHeaderAction } from "@/components/admin/ui/PageHeader";
import { Pagination } from "@/components/admin/ui/Pagination";

const fieldClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const metadata: Metadata = { title: "Accident & Damage History" };

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    vehicleId?: string;
    severity?: string;
    repairStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const [{ records, total, page, pageSize }, vehicles] = await Promise.all([
    listIncidentRecordsAdmin(params),
    listVehiclesForIncidentSelect(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params.severity) qs.set("severity", params.severity);
    if (params.repairStatus) qs.set("repairStatus", params.repairStatus);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(targetPage));
    return `/admin/incidents?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Accident & Damage History"
        action={<PageHeaderAction href="/admin/incidents/new">Add Incident</PageHeaderAction>}
      />

      <form className="flex flex-wrap gap-3">
        <select name="vehicleId" defaultValue={params.vehicleId ?? ""} className={fieldClass}>
          <option value="">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select name="severity" defaultValue={params.severity ?? ""} className={fieldClass}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="repairStatus" defaultValue={params.repairStatus ?? ""} className={fieldClass}>
          <option value="">All repair statuses</option>
          {REPAIR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REPAIR_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className={fieldClass} />
        <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className={fieldClass} />
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search location, references, remarks..."
          className={`${fieldClass} min-w-56 flex-1`}
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-primary-dark"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Repair status</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/incidents/${r.id}`} className="font-medium text-primary-dark hover:underline">
                    {r.vehicles?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs">{new Date(r.incident_date).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-2">
                  {r.incident_type === "other"
                    ? r.custom_type ?? "Other"
                    : INCIDENT_TYPE_LABELS[r.incident_type as keyof typeof INCIDENT_TYPE_LABELS] ?? r.incident_type}
                </td>
                <td className="px-4 py-2">
                  <SeverityBadge severity={r.severity as (typeof SEVERITIES)[number]} />
                </td>
                <td className="px-4 py-2">
                  <RepairStatusBadge status={r.repair_status as (typeof REPAIR_STATUSES)[number]} />
                </td>
                <td className="px-4 py-2 font-medium text-ink">
                  {r.actual_repair_cost_cents != null
                    ? formatMoney(r.actual_repair_cost_cents, "MUR", "en")
                    : r.estimated_repair_cost_cents != null
                      ? `~${formatMoney(r.estimated_repair_cost_cents, "MUR", "en")}`
                      : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <IncidentDeleteButton incidentId={r.id} />
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No incident records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} itemLabel="record" pageHref={pageHref} />
    </div>
  );
}
