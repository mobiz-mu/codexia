import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listComplianceRecordsAdmin } from "@/lib/actions/admin/compliance";
import { listVehiclesForComplianceSelect } from "@/lib/actions/admin/compliance";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/compliance/schema";
import { computeComplianceStatus, COMPLIANCE_STATUS_LABELS, COMPLIANCE_STATUSES } from "@/lib/compliance/status";
import { formatMoney } from "@/lib/pricing/format";
import { ComplianceStatusBadge } from "@/components/admin/ComplianceStatusBadge";
import { ComplianceDeleteButton } from "@/components/admin/ComplianceDeleteButton";
import { PageHeader, PageHeaderAction } from "@/components/admin/ui/PageHeader";
import { Pagination } from "@/components/admin/ui/Pagination";

const fieldClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const metadata: Metadata = { title: "Fleet Documents & Compliance" };

export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{
    vehicleId?: string;
    documentType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const [{ records, total, page, pageSize }, vehicles] = await Promise.all([
    listComplianceRecordsAdmin(params),
    listVehiclesForComplianceSelect(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params.documentType) qs.set("documentType", params.documentType);
    if (params.status) qs.set("status", params.status);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(targetPage));
    return `/admin/compliance?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fleet Documents & Compliance"
        action={<PageHeaderAction href="/admin/compliance/new">Add Record</PageHeaderAction>}
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
        <select name="documentType" defaultValue={params.documentType ?? ""} className={fieldClass}>
          <option value="">All document types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className={fieldClass}>
          <option value="">All statuses</option>
          {COMPLIANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMPLIANCE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className={fieldClass} />
        <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className={fieldClass} />
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search remarks, provider, reference..."
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
              <th className="px-4 py-2">Document</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const { status, daysRemaining } = computeComplianceStatus(r.expiry_date);
              return (
                <tr key={r.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/admin/compliance/${r.id}`} className="font-medium text-primary-dark hover:underline">
                      {r.vehicles?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {r.document_type === "other"
                      ? r.custom_type ?? "Other"
                      : DOCUMENT_TYPE_LABELS[r.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? r.document_type}
                  </td>
                  <td className="px-4 py-2 text-xs">{new Date(r.expiry_date).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2">
                    <ComplianceStatusBadge status={status} daysRemaining={daysRemaining} />
                  </td>
                  <td className="px-4 py-2">{r.provider ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-ink">
                    {r.cost_cents != null ? formatMoney(r.cost_cents, "EUR", "en") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ComplianceDeleteButton recordId={r.id} />
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No compliance records found.
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
