import type { Metadata } from "next";
import Link from "next/link";

import { listMaintenanceRecordsAdmin, listVehiclesForMaintenanceSelect } from "@/lib/actions/admin/maintenance";
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_TYPES,
  resolveMaintenanceCostBreakdown,
  summariseMaintenanceCosts,
  type MaintenanceType,
} from "@/lib/maintenance/schema";
import { formatMoney } from "@/lib/pricing/format";
import { MaintenanceDeleteButton } from "@/components/admin/MaintenanceDeleteButton";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { Pagination } from "@/components/admin/ui/Pagination";

export const metadata: Metadata = { title: "Vehicle Maintenance Records" };

const inputClass =
  "rounded-sm border border-ops-line bg-white px-2 py-1 text-[12px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[10px] font-bold uppercase tracking-wide text-ops-ink-3";

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

  // Every figure on this page is Mauritian Rupees. Customer rental pricing is
  // EUR and lives in an entirely separate set of tables.
  //
  // Components are summed only from rows that carry a breakdown, so a legacy
  // lump-sum record contributes to the total without making the Parts figure
  // look wrong.
  const spend = summariseMaintenanceCosts(records);
  const subtitleParts = [
    `${total} record${total === 1 ? "" : "s"}`,
    ...(spend.hasItemisation
      ? [
          `Parts ${formatMoney(spend.parts, "MUR", "en")}`,
          `Labour ${formatMoney(spend.labour, "MUR", "en")}`,
          `Other ${formatMoney(spend.other, "MUR", "en")}`,
        ]
      : []),
    ...(spend.unitemisedTotal > 0
      ? [`Unitemised ${formatMoney(spend.unitemisedTotal, "MUR", "en")}`]
      : []),
    `Total ${formatMoney(spend.total, "MUR", "en")}`,
  ];

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Vehicle maintenance"
        subtitle={subtitleParts.join(" · ")}
        flush
        actions={
          <Link
            href="/admin/maintenance/new"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            New record
          </Link>
        }
      >
        <OpsToolbar>
          <form method="get" action="/admin/maintenance" className="flex flex-wrap items-end gap-2">
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
              <span className={labelClass}>Type</span>
              <select name="type" defaultValue={params.type ?? ""} className={inputClass}>
                <option value="">All types</option>
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MAINTENANCE_TYPE_LABELS[t]}
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
              <input
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Garage or remarks"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="rounded-sm border border-ops-header bg-ops-header px-2 py-1 text-[12px] font-semibold text-white"
            >
              Filter
            </button>
            <Link
              href="/admin/maintenance"
              className="rounded-sm border border-ops-line px-2 py-1 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent"
            >
              Reset
            </Link>
          </form>
        </OpsToolbar>

        <OpsTable minWidth="68rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="6rem">Date</OpsTh>
              <OpsTh width="12rem">Vehicle</OpsTh>
              <OpsTh align="right" width="5.5rem">
                Mileage
              </OpsTh>
              <OpsTh width="6rem">Type</OpsTh>
              <OpsTh width="6.5rem">Garage</OpsTh>
              <OpsTh align="right" width="4.5rem" wrap>
                Parts Rs
              </OpsTh>
              <OpsTh align="right" width="5rem" wrap>
                Labour Rs
              </OpsTh>
              <OpsTh align="right" width="4.5rem" wrap>
                Other Rs
              </OpsTh>
              <OpsTh align="right" width="6.5rem" wrap>
                Total Rs
              </OpsTh>
              <OpsTh width="6.5rem">Downtime</OpsTh>
              <OpsTh align="right" width="5.5rem">
                Action
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {records.length === 0 ? (
              <OpsEmptyRow colSpan={11}>No maintenance records match these filters.</OpsEmptyRow>
            ) : (
              records.map((r, i) => {
                const breakdown = resolveMaintenanceCostBreakdown(r);
                return (
                <OpsTr key={r.id} zebra={i}>
                  <OpsTd numeric className="whitespace-nowrap font-semibold text-ops-ink">
                    {r.maintenance_date}
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
                  <OpsTd align="right" numeric>
                    {r.mileage_km !== null ? `${r.mileage_km.toLocaleString()} km` : "—"}
                  </OpsTd>
                  <OpsTd>
                    {MAINTENANCE_TYPE_LABELS[r.maintenance_type as MaintenanceType] ?? r.maintenance_type}
                    {r.custom_type ? (
                      <span className="block text-[11px] text-ops-ink-3">{r.custom_type}</span>
                    ) : null}
                  </OpsTd>
                  <OpsTd className="truncate">
                    {r.service_provider ?? "—"}
                    {r.invoice_reference ? (
                      <span className="block font-mono text-[11px] text-ops-ink-3">{r.invoice_reference}</span>
                    ) : null}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {breakdown.kind === "itemised" ? (breakdown.parts / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {breakdown.kind === "itemised" ? (breakdown.labour / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {breakdown.kind === "itemised" ? (breakdown.other / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric className="font-semibold text-ops-ink">
                    {breakdown.kind === "none" ? (
                      "—"
                    ) : (
                      <>
                        {formatMoney(breakdown.total, "MUR", "en")}
                        {breakdown.kind === "unitemised" ? (
                          <span
                            className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-ops-ink-3"
                            title="Recorded as a lump sum — no parts/labour breakdown was captured."
                          >
                            Unitemised
                          </span>
                        ) : null}
                      </>
                    )}
                  </OpsTd>
                  <OpsTd>
                    {r.availability_block_id ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-ops-maint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        <span aria-hidden="true">M</span> Off road
                      </span>
                    ) : (
                      <span className="text-[11px] text-ops-ink-3">History only</span>
                    )}
                  </OpsTd>
                  <OpsTd align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/maintenance/${r.id}`}
                        className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                      >
                        Open
                      </Link>
                      <MaintenanceDeleteButton recordId={r.id} />
                    </div>
                  </OpsTd>
                </OpsTr>
                );
              })
            )}
          </OpsTbody>
        </OpsTable>

        <div className="border-t border-ops-line px-3 py-2">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="maintenance records"
            pageHref={pageHref}
          />
        </div>
      </OpsPanel>
    </div>
  );
}
