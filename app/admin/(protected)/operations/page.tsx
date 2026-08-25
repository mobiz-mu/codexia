import type { Metadata } from "next";
import Link from "next/link";

import { getMovements } from "@/lib/actions/admin/operations";
import { businessTime, type Movement } from "@/lib/fleet/movements";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow, OpsGroupRow } from "@/components/admin/ops/OpsTable";
import { OpsStatusBadge } from "@/components/admin/ops/OpsStatusBadge";
import { opsStatusForBooking } from "@/lib/fleet/status-config";
import { formatMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Departures & Returns" };

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7", label: "Next 7 days", days: 7 },
  { key: "30", label: "Next 30 days", days: 30 },
] as const;

const FILTERS = [
  { key: "all", label: "Departures / Returns" },
  { key: "departure", label: "Departures" },
  { key: "return", label: "Returns" },
] as const;

const COLS = 8;

function longDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.find((r) => r.key === params.range) ?? RANGES[0];
  const kind = FILTERS.find((f) => f.key === params.kind) ?? FILTERS[0];

  const all = await getMovements(range.days);
  const movements = kind.key === "all" ? all : all.filter((m) => m.kind === kind.key);

  // Group into day sheets, as the reference does, with per-day counts.
  const byDay = new Map<string, Movement[]>();
  for (const m of movements) {
    const list = byDay.get(m.day) ?? [];
    list.push(m);
    byDay.set(m.day, list);
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors",
      active
        ? "border-ops-header bg-ops-header text-white"
        : "border-ops-line bg-ops-panel text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
    );

  const href = (over: { range?: string; kind?: string }) => {
    const sp = new URLSearchParams();
    const merged = { range: params.range, kind: params.kind, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `/admin/operations?${qs}` : "/admin/operations";
  };

  const departures = movements.filter((m) => m.kind === "departure").length;
  const returns = movements.filter((m) => m.kind === "return").length;
  const needsAttention = movements.filter((m) => m.attention.length > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Departures & returns"
        subtitle={`${departures} departure${departures === 1 ? "" : "s"} · ${returns} return${returns === 1 ? "" : "s"}${needsAttention ? ` · ${needsAttention} ${needsAttention === 1 ? "needs" : "need"} attention` : ""}`}
        flush
      >
        <OpsToolbar>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <Link key={r.key} href={href({ range: r.key })} className={chip(range.key === r.key)}>
                {r.label}
              </Link>
            ))}
          </div>
          <span className="mx-1 h-4 w-px bg-ops-line" aria-hidden="true" />
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href({ kind: f.key })} className={chip(kind.key === f.key)}>
                {f.label}
              </Link>
            ))}
          </div>
        </OpsToolbar>

        <OpsTable minWidth="62rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="6rem">Time</OpsTh>
              <OpsTh width="7rem">Movement</OpsTh>
              <OpsTh width="9rem">Reference</OpsTh>
              <OpsTh>Customer</OpsTh>
              <OpsTh>Vehicle</OpsTh>
              <OpsTh>Location</OpsTh>
              <OpsTh width="10rem">Status</OpsTh>
              <OpsTh width="9rem" align="right">
                Balance
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {byDay.size === 0 ? (
              <OpsEmptyRow colSpan={COLS}>Nothing scheduled in this window.</OpsEmptyRow>
            ) : (
              [...byDay.entries()].map(([day, rows]) => {
                const deps = rows.filter((r) => r.kind === "departure").length;
                const rets = rows.filter((r) => r.kind === "return").length;
                return [
                  <OpsGroupRow key={`${day}-h`} colSpan={COLS}>
                    {longDay(day)} — Departures: {deps} · Returns: {rets}
                  </OpsGroupRow>,
                  ...rows.map((m, i) => {
                    const status = opsStatusForBooking(m.status, m.source === "admin" ? "agency" : "web");
                    const balance = m.totalCents - m.paidCents;
                    return (
                      // Amber marks a genuinely blocking gap only, so the
                      // highlight keeps meaning something.
                      <OpsTr key={`${m.kind}-${m.bookingId}`} zebra={i} highlight={m.attention.length > 0}>
                        <OpsTd numeric className="font-semibold text-ops-ink">
                          {businessTime(m.at)}
                        </OpsTd>
                        <OpsTd>
                          <span
                            className={cn(
                              "rounded-[2px] px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white",
                              m.kind === "departure" ? "bg-ops-agency" : "bg-ops-stopsell"
                            )}
                          >
                            {m.kind === "departure" ? "Out" : "In"}
                          </span>
                        </OpsTd>
                        <OpsTd>
                          <Link href={`/admin/bookings/${m.bookingId}`} className="font-mono text-[12px] font-semibold text-ops-header hover:underline">
                            {m.reference}
                          </Link>
                        </OpsTd>
                        <OpsTd>
                          <span className="block truncate text-ops-ink">{m.customerName}</span>
                          {m.customerPhone ? (
                            <span className="block text-[11px] text-ops-ink-3">{m.customerPhone}</span>
                          ) : null}
                        </OpsTd>
                        <OpsTd>
                          {m.vehicleName ? (
                            <>
                              <span className="block truncate text-ops-ink">{m.vehicleName}</span>
                              {m.registration ? (
                                <span className="block font-mono text-[11px] text-ops-ink-3">{m.registration}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-ops-maint">Not assigned</span>
                          )}
                        </OpsTd>
                        <OpsTd className="truncate">{m.locationName ?? "—"}</OpsTd>
                        <OpsTd>
                          <div className="flex flex-col gap-0.5">
                            {status ? <OpsStatusBadge status={status} /> : null}
                            {m.attention.map((a) => (
                              <span key={a} className="text-[10px] font-semibold uppercase tracking-wide text-ops-maint">
                                {a}
                              </span>
                            ))}
                          </div>
                        </OpsTd>
                        <OpsTd align="right" numeric>
                          {balance > 0 ? (
                            <span className="font-semibold text-ops-booked">
                              {formatMoney(balance, m.currency, "en")}
                            </span>
                          ) : (
                            <span className="text-ops-agency">Settled</span>
                          )}
                        </OpsTd>
                      </OpsTr>
                    );
                  }),
                ];
              })
            )}
          </OpsTbody>
        </OpsTable>
      </OpsPanel>
    </div>
  );
}
