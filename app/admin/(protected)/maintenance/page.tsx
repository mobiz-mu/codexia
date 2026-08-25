import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listMaintenanceRecordsAdmin, listVehiclesForMaintenanceSelect } from "@/lib/actions/admin/maintenance";
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_TYPES } from "@/lib/maintenance/schema";
import { formatMoney } from "@/lib/pricing/format";
import { MaintenanceDeleteButton } from "@/components/admin/MaintenanceDeleteButton";
import { PageHeader, PageHeaderAction } from "@/components/admin/ui/PageHeader";
import { Pagination } from "@/components/admin/ui/Pagination";

const fieldClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const metadata: Metadata = { title: "Vehicle Maintenance Records" };

export default async function AdminMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  // Independent reads — the filter dropdown's vehicle list has no
  // dependency on the (already-filtered) records list, so they run in
  // parallel rather than one after another.
  const [{ records, total, page, pageSize }, vehicles] = await Promise.all([
    listMaintenanceRecordsAdmin(params),
    listVehiclesForMaintenanceSelect(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    if (params.type) qs.set("type", params.type);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(targetPage));
    return `/admin/maintenance?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vehicle Maintenance Records"
        action={<PageHeaderAction href="/admin/maintenance/new">Add Record</PageHeaderAction>}
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
        <select name="type" defaultValue={params.type ?? ""} className={fieldClass}>
          <option value="">All types</option>
          {MAINTENANCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {MAINTENANCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className={fieldClass} />
        <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className={fieldClass} />
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search remarks, provider..."
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
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2 text-xs">{new Date(r.maintenance_date).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/maintenance/${r.id}`}
                    className="font-medium text-primary-dark hover:underline"
                  >
                    {r.vehicles?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {r.maintenance_type === "other"
                    ? r.custom_type ?? "Other"
                    : MAINTENANCE_TYPE_LABELS[r.maintenance_type as keyof typeof MAINTENANCE_TYPE_LABELS] ??
                      r.maintenance_type}
                </td>
                <td className="px-4 py-2">{r.service_provider ?? "—"}</td>
                {/* Fleet running costs are rupees, not euros. */}
                <td className="px-4 py-2 font-medium text-ink">{formatMoney(r.cost_cents, "MUR", "en")}</td>
                <td className="px-4 py-2 text-right">
                  <MaintenanceDeleteButton recordId={r.id} />
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No maintenance records found.
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
