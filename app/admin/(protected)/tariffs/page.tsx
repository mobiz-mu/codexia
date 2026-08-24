import type { Metadata } from "next";

import { getTariffScreenData, listTariffPeriods, type TariffPeriodRecord } from "@/lib/actions/admin/tariffs";
import { formatCentsToEuro } from "@/lib/pricing/tariff-schema";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr } from "@/components/admin/ops/OpsTable";
import { MonthTabs } from "@/components/admin/ops/MonthTabs";
import { TariffWorkspace } from "@/components/admin/tariffs/TariffWorkspace";
import { TariffRowActions } from "@/components/admin/tariffs/TariffRowActions";
import type { TariffFormVehicle } from "@/components/admin/tariffs/TariffRateForm";

export const metadata: Metadata = { title: "Tariffs" };

const TIER_COLUMNS = [
  { key: "rate1DayCents", label: "1 day" },
  { key: "rate3DayCents", label: "3 days" },
  { key: "rate4DayCents", label: "4 days" },
  { key: "rate7DayCents", label: "7 days" },
  { key: "rate14DayCents", label: "14 days" },
  { key: "rate21PlusDayCents", label: "21+ days" },
] as const;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Abbreviated on purpose: spelled-out months pushed the period column wide
// enough to force the actions column off the end of the table on a laptop.
const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

function formatRange(from: string, to: string) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${String(d).padStart(2, "0")} ${MONTH_ABBR[m - 1]} ${y}`;
  };
  return `${fmt(from)} → ${fmt(to)}`;
}

/** Each period groups under the vehicle or category it prices, as in the reference listing. */
function groupKeyFor(p: TariffPeriodRecord) {
  return p.vehicleId ? `v:${p.vehicleId}` : `c:${p.categoryId}`;
}

function groupLabelFor(p: TariffPeriodRecord) {
  return p.vehicleId
    ? (p.vehicleName ?? "Vehicle")
    : `${p.categoryName ?? "Category"} — whole category`;
}

export default async function TariffsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = params.month === undefined ? null : Number(params.month) || null;

  const [screen, periods] = await Promise.all([
    getTariffScreenData(),
    listTariffPeriods({ month, year }),
  ]);

  const vehicles = screen.vehicles as TariffFormVehicle[];

  const groups = new Map<string, { label: string; rows: TariffPeriodRecord[] }>();
  for (const p of periods) {
    const key = groupKeyFor(p);
    const entry = groups.get(key) ?? { label: groupLabelFor(p), rows: [] };
    entry.rows.push(p);
    groups.set(key, entry);
  }

  const hrefFor = (m: number | null, y: number = year) =>
    m === null ? `/admin/tariffs?year=${y}` : `/admin/tariffs?year=${y}&month=${m}`;

  const locationNameById = new Map(screen.locations.map((l) => [l.id, l.name_en]));

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Base rate management"
        subtitle="Per-day rates banded by rental duration. A vehicle tariff overrides its category on the same dates."
      >
        <TariffWorkspace
          vehicles={vehicles}
          categories={screen.categories}
          locations={screen.locations}
          canManage={screen.canManage}
        />
      </OpsPanel>

      <OpsPanel title="Tariff periods" flush>
        <OpsToolbar>
          <MonthTabs
            selected={month}
            year={year}
            hrefForMonth={(m) => hrefFor(m)}
            hrefForYear={(y) => hrefFor(month, y)}
          />
        </OpsToolbar>

        {groups.size === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-ops-ink-3">
            {month
              ? `No tariff periods covering ${MONTH_NAMES[month - 1]} ${year}.`
              : `No tariff periods for ${year} yet. Vehicles without any tariff still quote their legacy daily rate.`}
          </p>
        ) : (
          <div className="flex flex-col">
            {[...groups.entries()].map(([key, group]) => (
              <section key={key}>
                <h3 className="bg-ops-header-2 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-white">
                  {group.label}
                </h3>
                {/* Sized so the actions column stays reachable without
                    horizontal scrolling on a 1280px laptop — reaching Delete
                    should not require scrolling a fleet table sideways. */}
                <OpsTable minWidth="52rem">
                  <OpsThead>
                    <OpsTr>
                      <OpsTh width="14rem">Period</OpsTh>
                      {TIER_COLUMNS.map((c) => (
                        <OpsTh key={c.key} align="right">
                          {c.label}
                        </OpsTh>
                      ))}
                      <OpsTh width="8.5rem" align="right">
                        Actions
                      </OpsTh>
                    </OpsTr>
                  </OpsThead>
                  <OpsTbody>
                    {group.rows.map((p, i) => (
                      <OpsTr key={p.id} zebra={i}>
                        <OpsTd>
                          <span className="block font-semibold text-ops-ink">
                            {formatRange(p.effectiveFrom, p.effectiveTo)}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1">
                            {p.label ? (
                              <span className="rounded-[2px] bg-ops-panel-3 px-1 py-px text-[10px] font-semibold text-ops-ink-2">
                                {p.label}
                              </span>
                            ) : null}
                            {!p.active ? (
                              <span className="rounded-[2px] bg-ops-staff px-1 py-px text-[10px] font-bold uppercase text-white">
                                Inactive
                              </span>
                            ) : null}
                            {p.locationIds.length > 0 ? (
                              <span className="rounded-[2px] bg-ops-stopsell px-1 py-px text-[10px] font-semibold text-white">
                                {p.locationIds.map((id) => locationNameById.get(id) ?? "?").join(", ")}
                              </span>
                            ) : null}
                          </span>
                        </OpsTd>

                        {TIER_COLUMNS.map((c) => {
                          const cents = p[c.key];
                          return (
                            <OpsTd key={c.key} align="right" numeric>
                              {cents > 0 ? (
                                <span className="font-semibold text-ops-ink">
                                  {formatCentsToEuro(cents)}
                                  <span className="ml-0.5 text-[10px] font-normal text-ops-ink-3">€/day</span>
                                </span>
                              ) : (
                                // Zero is a withdrawal, not a free rental — it has
                                // to read as such at a glance in the listing.
                                <span
                                  className="inline-flex items-center gap-1 rounded-[2px] bg-ops-maint/15 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-ops-maint"
                                  title="This rental length is not offered during this period"
                                >
                                  <span aria-hidden="true">✕</span> Not offered
                                </span>
                              )}
                            </OpsTd>
                          );
                        })}

                        <OpsTd align="right">
                          <TariffRowActions id={p.id} active={p.active} canManage={screen.canManage} />
                        </OpsTd>
                      </OpsTr>
                    ))}
                  </OpsTbody>
                </OpsTable>
              </section>
            ))}
          </div>
        )}
      </OpsPanel>
    </div>
  );
}
