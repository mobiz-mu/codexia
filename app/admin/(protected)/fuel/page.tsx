import type { Metadata } from "next";
import Link from "next/link";

import { getFuelFormData, listFuelRecords } from "@/lib/actions/admin/fuel";
import { litresFromMl } from "@/lib/fleet/fuel";
import { formatMoney } from "@/lib/pricing/format";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { FuelRecordForm } from "@/components/admin/fuel/FuelRecordForm";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Fuel" };

/** Explains a missing consumption figure instead of showing a bare dash. */
const REASON_LABEL: Record<string, string> = {
  no_previous_fill: "First fill",
  partial_fill: "Part fill",
  odometer_not_advanced: "No distance",
  no_distance: "No distance",
};

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const params = await searchParams;
  const [form, data] = await Promise.all([getFuelFormData(), listFuelRecords({ vehicleId: params.vehicle })]);

  const chip = (active: boolean) =>
    cn(
      "rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors",
      active
        ? "border-ops-header bg-ops-header text-white"
        : "border-ops-line bg-ops-panel text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
    );

  const totalSpend = data.rows.reduce((sum, r) => sum + r.totalCostCents, 0);
  const totalLitres = data.rows.reduce((sum, r) => sum + r.litresMl, 0);

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Record a fill"
        subtitle="All fuel costs are in Mauritian Rupees"
      >
        <FuelRecordForm
          vehicles={form.vehicles}
          canManage={form.canManage}
          defaultVehicleId={params.vehicle}
        />
      </OpsPanel>

      <OpsPanel
        title="Fuel records"
        subtitle={`${data.rows.length} fill${data.rows.length === 1 ? "" : "s"} · ${litresFromMl(totalLitres).toFixed(2)} L · ${formatMoney(totalSpend, "MUR", "en")}`}
        flush
      >
        <OpsToolbar>
          <Link href="/admin/fuel" className={chip(!params.vehicle)}>
            All vehicles
          </Link>
          {form.vehicles.map((v) => (
            <Link key={v.id} href={`/admin/fuel?vehicle=${v.id}`} className={chip(params.vehicle === v.id)}>
              {v.name}
              {v.internal_registration_ref ? ` · ${v.internal_registration_ref}` : ""}
            </Link>
          ))}
        </OpsToolbar>

        <OpsTable minWidth="72rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="7rem">Date</OpsTh>
              <OpsTh>Vehicle</OpsTh>
              <OpsTh align="right">Odometer</OpsTh>
              <OpsTh align="right">Litres</OpsTh>
              <OpsTh align="right">Rs / L</OpsTh>
              <OpsTh align="right">Total</OpsTh>
              <OpsTh align="right">Distance</OpsTh>
              <OpsTh align="right">L / 100 km</OpsTh>
              <OpsTh align="right">Rs / km</OpsTh>
              <OpsTh>Driver</OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {data.rows.length === 0 ? (
              <OpsEmptyRow colSpan={10}>No fuel records yet.</OpsEmptyRow>
            ) : (
              data.rows.map((r, i) => (
                <OpsTr key={r.id} zebra={i}>
                  <OpsTd numeric className="font-semibold text-ops-ink">
                    {r.filledAt}
                  </OpsTd>
                  <OpsTd>
                    <span className="block truncate text-ops-ink">{r.vehicleName ?? "—"}</span>
                    {r.registration ? (
                      <span className="block font-mono text-[11px] text-ops-ink-3">{r.registration}</span>
                    ) : null}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.odometerKm.toLocaleString()}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {litresFromMl(r.litresMl).toFixed(2)}
                    {!r.fullTank ? (
                      <span className="ml-1 rounded-[2px] bg-ops-maint/20 px-1 text-[10px] font-bold uppercase text-ops-maint">
                        part
                      </span>
                    ) : null}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.pricePerLitreCents > 0 ? (r.pricePerLitreCents / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric className="font-semibold text-ops-ink">
                    {formatMoney(r.totalCostCents, "MUR", "en")}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.derived.distanceKm !== null ? `${r.derived.distanceKm.toLocaleString()} km` : "—"}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.derived.litresPer100Km !== null ? (
                      <span className="font-semibold text-ops-ink">{r.derived.litresPer100Km.toFixed(1)}</span>
                    ) : (
                      // Never fabricate a consumption figure — say why instead.
                      <span
                        className="text-[11px] text-ops-ink-3"
                        title="Consumption needs a previous full-tank fill and a forward odometer reading"
                      >
                        {REASON_LABEL[r.derived.reason ?? ""] ?? "—"}
                      </span>
                    )}
                  </OpsTd>
                  <OpsTd align="right" numeric>
                    {r.derived.costPerKmCents !== null ? (r.derived.costPerKmCents / 100).toFixed(2) : "—"}
                  </OpsTd>
                  <OpsTd className="truncate">{r.driverName ?? "—"}</OpsTd>
                </OpsTr>
              ))
            )}
          </OpsTbody>
        </OpsTable>
      </OpsPanel>

      {data.monthly.length > 0 ? (
        <OpsPanel title="Monthly fuel spend" flush>
          <OpsTable minWidth="20rem">
            <OpsThead>
              <OpsTr>
                <OpsTh>Month</OpsTh>
                <OpsTh align="right">Spend</OpsTh>
              </OpsTr>
            </OpsThead>
            <OpsTbody>
              {data.monthly.map((m, i) => (
                <OpsTr key={m.month} zebra={i}>
                  <OpsTd>{monthLabel(m.month)}</OpsTd>
                  <OpsTd align="right" numeric className="font-semibold text-ops-ink">
                    {formatMoney(m.totalCents, "MUR", "en")}
                  </OpsTd>
                </OpsTr>
              ))}
            </OpsTbody>
          </OpsTable>
        </OpsPanel>
      ) : null}
    </div>
  );
}
