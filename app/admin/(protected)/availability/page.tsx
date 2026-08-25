import type { Metadata } from "next";
import Link from "next/link";

import { listBlocks, listVehicleOptions, getAvailabilityBoardData } from "@/lib/actions/admin/availability";
import { CreateBlockForm } from "@/components/admin/CreateBlockForm";
import { DeleteBlockButton } from "@/components/admin/DeleteBlockButton";
import { FleetTimeline } from "@/components/admin/ops/FleetTimeline";
import { PlanningLegend } from "@/components/admin/ops/OpsStatusBadge";
import { OpsPanel, OpsToolbar } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { cn } from "@/lib/utils/cn";
import { newBookingHref } from "@/lib/booking/prefill";

export const metadata: Metadata = { title: "Availability" };

/** Preset windows, matching the reference's Today / 7 / 30 day views. */
const RANGES = [
  { key: "today", label: "Today", days: 1, dayWidth: 120 },
  { key: "7", label: "7 days", days: 7, dayWidth: 84 },
  { key: "30", label: "30 days", days: 30, dayWidth: 40 },
  { key: "60", label: "60 days", days: 60, dayWidth: 30 },
] as const;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    range?: string;
    days?: string;
    category?: string;
    vehicle?: string;
    group?: string;
    staff?: string;
  }>;
}) {
  const params = await searchParams;

  const windowStart =
    params.start && !Number.isNaN(Date.parse(params.start)) ? params.start : isoDate(new Date());

  const range = (RANGES.find((r) => r.key === params.range) ?? RANGES[2]) as (typeof RANGES)[number];
  // A custom range overrides the preset but is still clamped: an unbounded
  // window would let one URL ask for years of cells.
  const customDays = Number(params.days);
  const days = Number.isFinite(customDays) && customDays > 0 ? Math.min(customDays, 120) : range.days;
  const dayWidth = days === range.days ? range.dayWidth : days <= 10 ? 84 : days <= 40 ? 40 : 30;

  const groupByCategory = params.group !== "off";
  const showStaff = params.staff !== "off";

  const [board, blocks, vehicleOptions] = await Promise.all([
    getAvailabilityBoardData(windowStart, days),
    listBlocks(),
    listVehicleOptions(),
  ]);

  let vehicles = board.vehicles;
  if (params.category) vehicles = vehicles.filter((v) => v.categoryId === params.category);
  if (params.vehicle) vehicles = vehicles.filter((v) => v.id === params.vehicle);
  // Staff cars are internal-only: they belong on this board (they still need
  // servicing and can be off the road) but never in public inventory.
  if (!showStaff) vehicles = vehicles.filter((v) => !v.isStaffCar);

  const visibleIds = new Set(vehicles.map((v) => v.id));
  const bookings = board.bookings.filter((b) => visibleIds.has(b.vehicleId));
  const boardBlocks = board.blocks.filter((b) => visibleIds.has(b.vehicleId));

  const qs = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = {
      start: windowStart,
      range: params.range,
      days: params.days,
      category: params.category,
      vehicle: params.vehicle,
      group: params.group,
      staff: params.staff,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/admin/availability?${sp.toString()}`;
  };

  const prevStart = isoDate(addDays(new Date(windowStart), -days));
  const nextStart = isoDate(addDays(new Date(windowStart), days));
  const windowEndLabel = isoDate(addDays(new Date(windowStart), days - 1));

  const chip = (active: boolean) =>
    cn(
      "rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors",
      active
        ? "border-ops-header bg-ops-header text-white"
        : "border-ops-line bg-ops-panel text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
    );

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="Fleet planning board"
        subtitle={`${windowStart} → ${windowEndLabel} · ${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
        flush
      >
        <OpsToolbar>
          <div className="flex items-center gap-1">
            <Link href={qs({ start: prevStart })} aria-label="Previous window" className={chip(false)}>
              ‹
            </Link>
            <Link href={qs({ start: isoDate(new Date()) })} className={chip(false)}>
              Today
            </Link>
            <Link href={qs({ start: nextStart })} aria-label="Next window" className={chip(false)}>
              ›
            </Link>
          </div>

          <span className="mx-1 h-4 w-px bg-ops-line" aria-hidden="true" />

          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={qs({ range: r.key, days: undefined })}
                aria-current={!params.days && range.key === r.key ? "true" : undefined}
                className={chip(!params.days && range.key === r.key)}
              >
                {r.label}
              </Link>
            ))}
          </div>

          <span className="mx-1 h-4 w-px bg-ops-line" aria-hidden="true" />

          {/* Custom range — a GET form so the window stays addressable by URL. */}
          <form method="get" action="/admin/availability" className="flex items-end gap-1.5">
            <label className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wide text-ops-ink-3">From</span>
              <input
                type="date"
                name="start"
                defaultValue={windowStart}
                className="rounded-sm border border-ops-line bg-white px-1.5 py-1 text-[12px] text-ops-ink"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wide text-ops-ink-3">Days</span>
              <input
                type="number"
                name="days"
                min={1}
                max={120}
                defaultValue={days}
                className="w-16 rounded-sm border border-ops-line bg-white px-1.5 py-1 text-[12px] tabular-nums text-ops-ink"
              />
            </label>
            {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
            {params.group ? <input type="hidden" name="group" value={params.group} /> : null}
            {params.staff ? <input type="hidden" name="staff" value={params.staff} /> : null}
            <button type="submit" className={chip(false)}>
              Apply
            </button>
          </form>

          <span className="mx-1 h-4 w-px bg-ops-line" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-1">
            <Link href={qs({ category: undefined, vehicle: undefined })} className={chip(!params.category)}>
              All categories
            </Link>
            {board.categories.map((c) => (
              <Link
                key={c.id}
                href={qs({ category: c.id, vehicle: undefined })}
                className={chip(params.category === c.id)}
              >
                {c.name}
              </Link>
            ))}
          </div>

          <span className="mx-1 h-4 w-px bg-ops-line" aria-hidden="true" />

          <Link href={qs({ group: groupByCategory ? "off" : undefined })} className={chip(groupByCategory)}>
            Group by category
          </Link>
          <Link href={qs({ staff: showStaff ? "off" : undefined })} className={chip(showStaff)}>
            Show staff cars
          </Link>
        </OpsToolbar>

        <div className="bg-ops-frame">
          <FleetTimeline
            windowStart={windowStart}
            days={days}
            dayWidth={dayWidth}
            vehicles={vehicles}
            categories={board.categories}
            bookings={bookings}
            blocks={boardBlocks}
            groupByCategory={groupByCategory}
            bookingHref={(id) => `/admin/bookings/${id}`}
            newBookingHref={newBookingHref}
          />
          <div className="border-t border-ops-rail px-3 py-2">
            <PlanningLegend />
          </div>
        </div>
      </OpsPanel>

      <OpsPanel title="Unavailability management" subtitle="Maintenance, internal use, preparation and cleaning">
        <CreateBlockForm vehicles={vehicleOptions} />
      </OpsPanel>

      <OpsPanel title="Current blocks" flush>
        <OpsTable minWidth="44rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="14rem">Vehicle</OpsTh>
              <OpsTh width="9rem">Type</OpsTh>
              <OpsTh>Period</OpsTh>
              <OpsTh>Note</OpsTh>
              <OpsTh width="6rem" align="right">
                Actions
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {blocks.map((b, i) => (
              <OpsTr key={b.id} zebra={i}>
                <OpsTd>
                  <span className="font-semibold text-ops-ink">{b.vehicles?.name ?? "—"}</span>
                </OpsTd>
                <OpsTd className="capitalize">{b.type.replace("_", " ")}</OpsTd>
                <OpsTd className="font-mono text-[11px]">{b.period}</OpsTd>
                <OpsTd>{b.note ?? "—"}</OpsTd>
                <OpsTd align="right">
                  <DeleteBlockButton blockId={b.id} />
                </OpsTd>
              </OpsTr>
            ))}
            {blocks.length === 0 ? <OpsEmptyRow colSpan={5}>No blocks recorded.</OpsEmptyRow> : null}
          </OpsTbody>
        </OpsTable>
      </OpsPanel>
    </div>
  );
}
