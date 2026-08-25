import type { Metadata } from "next";
import Link from "next/link";

import { listComplianceVehicles } from "@/lib/actions/admin/compliance";
import {
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_SORT_ORDER,
  computeComplianceStatus,
  type ComplianceStatus,
} from "@/lib/compliance/status";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Fleet compliance" };

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  expired: "bg-ops-booked text-white",
  expires_today: "bg-ops-booked text-white",
  urgent: "bg-ops-maint text-white",
  warning: "bg-ops-conflict text-ops-ink",
  valid: "bg-ops-agency text-white",
};

export default async function ComplianceVehiclesPage() {
  const vehicles = await listComplianceVehicles();

  // A vehicle's headline status is its worst document — a car with a valid
  // insurance and an expired road tax is not "valid".
  const rows = vehicles
    .map((v) => {
      const statuses = v.expiryDates.map((d) => computeComplianceStatus(d).status);
      const worst =
        statuses.length === 0
          ? null
          : statuses.reduce((a, b) => (COMPLIANCE_STATUS_SORT_ORDER[a] <= COMPLIANCE_STATUS_SORT_ORDER[b] ? a : b));
      return { ...v, documentCount: v.expiryDates.length, worst };
    })
    .sort((a, b) => {
      const rank = (s: ComplianceStatus | null) => (s === null ? 99 : COMPLIANCE_STATUS_SORT_ORDER[s]);
      return rank(a.worst) - rank(b.worst) || a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Fleet compliance"
        subtitle="Open a vehicle to see its full document register"
        flush
      >
        <OpsTable minWidth="46rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="20rem">Vehicle</OpsTh>
              <OpsTh align="right" width="9rem">
                Documents
              </OpsTh>
              <OpsTh width="12rem">Worst status</OpsTh>
              <OpsTh align="right" width="8rem">
                Actions
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {rows.length === 0 ? (
              <OpsEmptyRow colSpan={4}>No vehicles in the fleet.</OpsEmptyRow>
            ) : (
              rows.map((v, i) => (
                <OpsTr key={v.id} zebra={i} highlight={v.worst === "expired"}>
                  <OpsTd>
                    <VehicleIdentity
                      size="sm"
                      vehicle={{
                        id: v.id,
                        name: v.name,
                        subtitle: `${v.brand} ${v.model}`,
                        transmission: v.transmission,
                        registration: v.internal_registration_ref,
                        isStaffCar: v.is_staff_car,
                      }}
                    />
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {v.documentCount}
                  </OpsTd>
                  <OpsTd>
                    {v.worst ? (
                      <span
                        className={cn(
                          "inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
                          STATUS_STYLE[v.worst]
                        )}
                      >
                        {COMPLIANCE_STATUS_LABELS[v.worst]}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-ops-ink-3">
                        No documents
                      </span>
                    )}
                  </OpsTd>
                  <OpsTd align="right">
                    <Link
                      href={`/admin/compliance/vehicle/${v.id}`}
                      className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-header hover:border-ops-accent"
                    >
                      Open dossier
                    </Link>
                  </OpsTd>
                </OpsTr>
              ))
            )}
          </OpsTbody>
        </OpsTable>
      </OpsPanel>
    </div>
  );
}
