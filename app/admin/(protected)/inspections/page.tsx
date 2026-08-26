import type { Metadata } from "next";
import Link from "next/link";

import {
  getFleetWeekStatus,
  listInspectionsAdmin,
  listVehiclesForInspectionSelect,
} from "@/lib/actions/admin/inspections";
import { FleetWeekPanel } from "@/components/admin/inspections/FleetWeekPanel";
import {
  InspectionApprovalBadge,
  InspectionResultBadge,
} from "@/components/admin/inspections/InspectionBadges";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { Pagination } from "@/components/admin/ui/Pagination";
import type { DerivedResult } from "@/lib/inspections/presentation";

export const metadata: Metadata = { title: "Weekly Vehicle Inspections" };

const inputClass =
  "rounded-sm border border-ops-line bg-white px-2 py-1 text-[12px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent";
const labelClass = "text-[10px] font-bold uppercase tracking-wide text-ops-ink-3";

export default async function AdminInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    vehicleId?: string;
    weekEnding?: string;
    result?: string;
    approval?: string;
    defectsOnly?: string;
    search?: string;
    page?: string;
    week?: string;
    fleetStatus?: string;
  }>;
}) {
  const params = await searchParams;

  const [{ records, total, page, pageSize }, vehicles, fleetWeek] = await Promise.all([
    listInspectionsAdmin(params),
    listVehiclesForInspectionSelect(),
    getFleetWeekStatus(params.week),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params.weekEnding) qs.set("weekEnding", params.weekEnding);
    if (params.result) qs.set("result", params.result);
    if (params.approval) qs.set("approval", params.approval);
    if (params.defectsOnly) qs.set("defectsOnly", params.defectsOnly);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(targetPage));
    return `/admin/inspections?${qs.toString()}`;
  }

  const failed = records.filter((r) => r.result === "failed").length;
  const attention = records.filter((r) => r.result === "attention_required").length;
  const unapproved = records.filter((r) => !r.approved_at).length;

  return (
    <div className="flex flex-col gap-3">
      <FleetWeekPanel summary={fleetWeek} statusFilter={params.fleetStatus} />

      <OpsPanel
        title="Weekly vehicle inspections"
        subtitle={`${total} inspection${total === 1 ? "" : "s"} · ${failed} failed · ${attention} attention · ${unapproved} awaiting approval`}
        flush
        actions={
          <Link
            href="/admin/inspections/new"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            New inspection
          </Link>
        }
      >
        <OpsToolbar>
          <form method="get" action="/admin/inspections" className="flex flex-wrap items-end gap-2">
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
              <span className={labelClass}>Week ending</span>
              <input type="date" name="weekEnding" defaultValue={params.weekEnding ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Result</span>
              <select name="result" defaultValue={params.result ?? ""} className={inputClass}>
                <option value="">Any result</option>
                <option value="draft">In progress</option>
                <option value="completed">Passed</option>
                <option value="attention_required">Attention required</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Approval</span>
              <select name="approval" defaultValue={params.approval ?? ""} className={inputClass}>
                <option value="">Any</option>
                <option value="approved">Approved</option>
                <option value="unapproved">Not approved</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Search</span>
              <input
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Inspector, driver, registration"
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-1.5 pb-1 text-[12px] text-ops-ink-2">
              <input
                type="checkbox"
                name="defectsOnly"
                value="1"
                defaultChecked={params.defectsOnly === "1"}
              />
              Defects only
            </label>
            <button
              type="submit"
              className="rounded-sm border border-ops-header bg-ops-header px-2 py-1 text-[12px] font-semibold text-white"
            >
              Filter
            </button>
            <Link
              href="/admin/inspections"
              className="rounded-sm border border-ops-line px-2 py-1 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent"
            >
              Reset
            </Link>
          </form>
        </OpsToolbar>

        <OpsTable minWidth="72rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="6rem">Date</OpsTh>
              <OpsTh width="6rem" wrap>
                Week ending
              </OpsTh>
              <OpsTh width="12rem">Vehicle</OpsTh>
              <OpsTh align="right" width="6rem">
                Odometer
              </OpsTh>
              <OpsTh width="8rem">Inspector</OpsTh>
              <OpsTh align="right" width="4.5rem" wrap>
                Attention
              </OpsTh>
              <OpsTh align="right" width="3.5rem">
                Fail
              </OpsTh>
              <OpsTh width="8rem">Result</OpsTh>
              <OpsTh width="8rem">Approval</OpsTh>
              <OpsTh align="right" width="5.5rem">
                Action
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {records.length === 0 ? (
              <OpsEmptyRow colSpan={10}>No inspections match these filters.</OpsEmptyRow>
            ) : (
              records.map((r, i) => (
                <OpsTr key={r.id} zebra={i} highlight={r.result === "failed"}>
                  <OpsTd numeric className="whitespace-nowrap font-semibold text-ops-ink">
                    {r.inspection_date}
                  </OpsTd>
                  <OpsTd numeric className="whitespace-nowrap">
                    {r.week_ending}
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
                      // Falls back to the historical snapshot when the vehicle
                      // row is gone, so the list stays explainable.
                      <span className="text-[12px] text-ops-ink-2">
                        {r.vehicle_make_model ?? "—"}
                        {r.vehicle_registration ? ` · ${r.vehicle_registration}` : ""}
                      </span>
                    )}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.odometer_km.toLocaleString()} km
                  </OpsTd>
                  <OpsTd className="truncate">{r.inspector_name ?? "—"}</OpsTd>
                  <OpsTd align="right" numeric className={r.attentionCount ? "font-semibold text-ops-warning" : ""}>
                    {r.attentionCount || "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric className={r.failCount ? "font-semibold text-ops-danger" : ""}>
                    {r.failCount || "—"}
                  </OpsTd>
                  {/* Result and approval stay in separate columns: a reviewed
                      failure must read "Failed" AND "Approved", never merge. */}
                  <OpsTd>
                    <InspectionResultBadge result={r.result as DerivedResult} />
                  </OpsTd>
                  <OpsTd>
                    <InspectionApprovalBadge approvedAt={r.approved_at} />
                  </OpsTd>
                  <OpsTd align="right">
                    <Link
                      href={`/admin/inspections/${r.id}`}
                      className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                    >
                      Open
                    </Link>
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
            itemLabel="inspections"
            pageHref={pageHref}
          />
        </div>
      </OpsPanel>
    </div>
  );
}
