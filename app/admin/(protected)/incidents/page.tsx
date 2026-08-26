import type { Metadata } from "next";
import Link from "next/link";

import { listIncidentRecordsAdmin, listVehiclesForIncidentSelect } from "@/lib/actions/admin/incidents";
import {
  INCIDENT_TYPE_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  type IncidentType,
  type Severity,
  type RepairStatus,
} from "@/lib/incidents/schema";
import { formatMoney } from "@/lib/pricing/format";
import { SeverityBadge, RepairStatusBadge } from "@/components/admin/IncidentBadges";
import { IncidentDeleteButton } from "@/components/admin/IncidentDeleteButton";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { Pagination } from "@/components/admin/ui/Pagination";

export const metadata: Metadata = { title: "Accident & Damage History" };

const inputClass =
  "rounded-sm border border-ops-line bg-white px-2 py-1 text-[12px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[10px] font-bold uppercase tracking-wide text-ops-ink-3";

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

  // Repair costs are rupees — the work is done by local garages.
  const estimated = records.reduce((s, r) => s + (r.estimated_repair_cost_cents ?? 0), 0);
  const actual = records.reduce((s, r) => s + (r.actual_repair_cost_cents ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Accident & damage history"
        subtitle={`${total} incident${total === 1 ? "" : "s"} · Estimated ${formatMoney(estimated, "MUR", "en")} · Actual ${formatMoney(actual, "MUR", "en")}`}
        flush
        actions={
          <Link
            href="/admin/incidents/new"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            New incident
          </Link>
        }
      >
        <OpsToolbar>
          <form method="get" action="/admin/incidents" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col">
              <span className={labelClass}>Vehicle</span>
              <select name="vehicleId" defaultValue={params.vehicleId ?? ""} className={inputClass}>
                <option value="">All vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Severity</span>
              <select name="severity" defaultValue={params.severity ?? ""} className={inputClass}>
                <option value="">Any</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Repair status</span>
              <select name="repairStatus" defaultValue={params.repairStatus ?? ""} className={inputClass}>
                <option value="">Any</option>
                {REPAIR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REPAIR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>From</span>
              <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>To</span>
              <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Search</span>
              <input name="search" defaultValue={params.search ?? ""} placeholder="Location or notes" className={inputClass} />
            </label>
            <button
              type="submit"
              className="rounded-sm border border-ops-header bg-ops-header px-2 py-1 text-[12px] font-semibold text-white"
            >
              Filter
            </button>
            <Link
              href="/admin/incidents"
              className="rounded-sm border border-ops-line px-2 py-1 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent"
            >
              Reset
            </Link>
          </form>
        </OpsToolbar>

        <OpsTable minWidth="62rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="6rem">Date</OpsTh>
              <OpsTh width="12rem">Vehicle</OpsTh>
              <OpsTh width="8rem">Type</OpsTh>
              <OpsTh width="6rem">Severity</OpsTh>
              <OpsTh width="7rem" wrap>
                Repair status
              </OpsTh>
              <OpsTh align="right" width="5rem" wrap>
                Estimated Rs
              </OpsTh>
              <OpsTh align="right" width="5rem" wrap>
                Actual Rs
              </OpsTh>
              <OpsTh width="7.5rem">Downtime</OpsTh>
              <OpsTh align="right" width="5.5rem">
                Action
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {records.length === 0 ? (
              <OpsEmptyRow colSpan={9}>No incidents match these filters.</OpsEmptyRow>
            ) : (
              records.map((r, i) => (
                <OpsTr key={r.id} zebra={i} highlight={r.severity === "write_off"}>
                  <OpsTd numeric className="whitespace-nowrap font-semibold text-ops-ink">
                    {r.incident_date}
                  </OpsTd>
                  <OpsTd>
                    {r.vehicles ? (
                      <VehicleIdentity
                        size="sm"
                        vehicle={{
                          id: r.vehicle_id,
                          name: r.vehicles.name,
                          subtitle: `${r.vehicles.brand} ${r.vehicles.model}`,
                          transmission: r.vehicles.transmission,
                          registration: r.vehicles.internal_registration_ref,
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </OpsTd>
                  <OpsTd>
                    {INCIDENT_TYPE_LABELS[r.incident_type as IncidentType] ?? r.incident_type}
                    {r.custom_type ? (
                      <span className="block text-[11px] text-ops-ink-3">{r.custom_type}</span>
                    ) : null}
                    {r.location ? <span className="block text-[11px] text-ops-ink-3">{r.location}</span> : null}
                  </OpsTd>
                  <OpsTd>
                    <SeverityBadge severity={r.severity as Severity} />
                  </OpsTd>
                  <OpsTd>
                    <RepairStatusBadge status={r.repair_status as RepairStatus} />
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.estimated_repair_cost_cents
                      ? (r.estimated_repair_cost_cents / 100).toFixed(2)
                      : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric className="font-semibold text-ops-ink">
                    {r.actual_repair_cost_cents ? (r.actual_repair_cost_cents / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd>
                    {r.availability_block_id ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-ops-incident px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        <span aria-hidden="true">!</span> Off road
                      </span>
                    ) : r.downtime_start ? (
                      <span className="text-[11px] text-ops-ink-3">
                        {r.downtime_start.slice(0, 10)}
                        {r.downtime_end ? ` → ${r.downtime_end.slice(0, 10)}` : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ops-ink-3">None</span>
                    )}
                  </OpsTd>
                  <OpsTd align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/incidents/${r.id}`}
                        className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                      >
                        Open
                      </Link>
                      <IncidentDeleteButton incidentId={r.id} />
                    </div>
                  </OpsTd>
                </OpsTr>
              ))
            )}
          </OpsTbody>
        </OpsTable>

        <div className="border-t border-ops-line px-3 py-2">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="incidents"
            pageHref={pageHref}
          />
        </div>
      </OpsPanel>
    </div>
  );
}
