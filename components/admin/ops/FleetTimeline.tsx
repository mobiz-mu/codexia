"use client";

import { useMemo } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import {
  OPS_STATUS,
  opsStatusForBlock,
  opsStatusForBooking,
  type OpsStatusKey,
} from "@/lib/fleet/status-config";
import { VehicleIdentity } from "./VehicleIdentity";
import { newBookingHref } from "@/lib/booking/prefill";
import type {
  AvailabilityBoardBlock,
  AvailabilityBoardBooking,
  AvailabilityBoardCategory,
  AvailabilityBoardVehicle,
} from "@/lib/actions/admin/availability";

/**
 * Fleet planning board: a sticky vehicle rail on the left, a horizontal date
 * matrix on the right, grouped under month bands.
 *
 * Physical vehicles stay physical. A category header shows a stock count for
 * orientation, but every reservation bar still belongs to one real car —
 * availability is never collapsed into a counter, because the booking engine
 * allocates specific vehicles and the board has to show the same truth.
 *
 * Only the window handed in is rendered, and each row is a single flex track
 * of day cells rather than an absolutely-positioned overlay, so a 60-day
 * range stays a bounded, predictable DOM.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RAIL_WIDTH = 224;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayIndex(windowStart: Date, at: string) {
  return Math.floor((startOfUtcDay(new Date(at)).getTime() - windowStart.getTime()) / DAY_MS);
}

type Segment = {
  key: string;
  status: OpsStatusKey;
  startIndex: number;
  /** Exclusive. */
  endIndex: number;
  label: string;
  sub: string | null;
  href: string | null;
  title: string;
};

/** Lay overlapping segments onto as few lanes as possible so nothing is hidden. */
function packIntoLanes(segments: Segment[]): Segment[][] {
  const lanes: Segment[][] = [];
  for (const seg of [...segments].sort((a, b) => a.startIndex - b.startIndex)) {
    const lane = lanes.find((l) => l.every((s) => seg.startIndex >= s.endIndex || seg.endIndex <= s.startIndex));
    if (lane) lane.push(seg);
    else lanes.push([seg]);
  }
  return lanes;
}

export function FleetTimeline({
  windowStart,
  days,
  dayWidth = 34,
  vehicles,
  categories,
  bookings,
  blocks,
  groupByCategory,
}: {
  windowStart: string;
  days: number;
  dayWidth?: number;
  vehicles: AvailabilityBoardVehicle[];
  categories: AvailabilityBoardCategory[];
  bookings: AvailabilityBoardBooking[];
  blocks: AvailabilityBoardBlock[];
  groupByCategory: boolean;
}) {
  const start = useMemo(() => startOfUtcDay(new Date(windowStart)), [windowStart]);

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS)),
    [start, days]
  );

  const todayIndex = useMemo(() => dayIndex(start, new Date().toISOString()), [start]);

  // Month bands across the top: one header per calendar month in the window.
  const monthBands = useMemo(() => {
    const bands: { label: string; span: number }[] = [];
    for (const d of dayList) {
      const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      const last = bands.at(-1);
      if (last && last.label === label) last.span += 1;
      else bands.push({ label, span: 1 });
    }
    return bands;
  }, [dayList]);

  const segmentsByVehicle = useMemo(() => {
    const map = new Map<string, Segment[]>();
    const push = (vehicleId: string, seg: Segment) => {
      const list = map.get(vehicleId) ?? [];
      list.push(seg);
      map.set(vehicleId, list);
    };

    for (const b of bookings) {
      const status = opsStatusForBooking(b.status, b.source === "admin" ? "agency" : "web");
      if (!status) continue;
      push(b.vehicleId, {
        key: `b-${b.id}`,
        status,
        startIndex: Math.max(0, dayIndex(start, b.pickupAt)),
        endIndex: Math.min(days, dayIndex(start, b.returnAt) + 1),
        label: b.customerName || b.reference,
        sub: b.reference,
        href: `/admin/bookings/${b.id}`,
        title: `${b.reference} · ${b.customerName} · ${OPS_STATUS[status].label}`,
      });
    }

    for (const bl of blocks) {
      const status = opsStatusForBlock(bl.type);
      push(bl.vehicleId, {
        key: `k-${bl.id}`,
        status,
        startIndex: Math.max(0, dayIndex(start, bl.startAt)),
        endIndex: Math.min(days, dayIndex(start, bl.endAt) + 1),
        label: OPS_STATUS[status].label,
        sub: bl.note,
        href: null,
        title: bl.note ? `${OPS_STATUS[status].label} — ${bl.note}` : OPS_STATUS[status].label,
      });
    }

    return map;
  }, [bookings, blocks, start, days]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return [{ category: null as AvailabilityBoardCategory | null, rows: vehicles }];
    return categories
      .map((c) => ({ category: c, rows: vehicles.filter((v) => v.categoryId === c.id) }))
      .filter((g) => g.rows.length > 0);
  }, [groupByCategory, categories, vehicles]);

  const gridWidth = days * dayWidth;

  return (
    <div className="relative w-full overflow-x-auto">
      <div style={{ width: RAIL_WIDTH + gridWidth }}>
        {/* Month band */}
        <div className="sticky top-0 z-30 flex bg-ops-frame-2">
          <div
            style={{ width: RAIL_WIDTH }}
            className="sticky left-0 z-40 shrink-0 border-r border-ops-rail bg-ops-frame-2 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ops-ink-inv-2"
          >
            Vehicle
          </div>
          {monthBands.map((band, i) => (
            <div
              key={`${band.label}-${i}`}
              style={{ width: band.span * dayWidth }}
              className="shrink-0 border-r border-ops-rail py-1 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-inv"
            >
              {band.label}
            </div>
          ))}
        </div>

        {/* Day numbers */}
        <div className="sticky top-[22px] z-30 flex bg-ops-frame-3">
          <div
            style={{ width: RAIL_WIDTH }}
            className="sticky left-0 z-40 shrink-0 border-r border-ops-rail bg-ops-frame-3"
          />
          {dayList.map((d, i) => {
            const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
            return (
              <div
                key={i}
                style={{ width: dayWidth }}
                className={cn(
                  "shrink-0 border-r border-ops-rail py-0.5 text-center text-[10px] font-semibold tabular-nums",
                  i === todayIndex ? "bg-ops-accent text-white" : weekend ? "text-ops-ink-inv-2" : "text-ops-ink-inv"
                )}
                title={d.toISOString().slice(0, 10)}
              >
                {d.getUTCDate()}
              </div>
            );
          })}
        </div>

        {grouped.map((group) => (
          <section key={group.category?.id ?? "all"}>
            {group.category ? (
              <div className="flex bg-ops-header-2">
                <div
                  style={{ width: RAIL_WIDTH }}
                  className="sticky left-0 z-20 shrink-0 bg-ops-header-2 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white"
                >
                  {group.category.name}
                  <span className="ml-1 font-normal opacity-80">
                    · Stock: {group.rows.length} {group.rows.length === 1 ? "vehicle" : "vehicles"}
                  </span>
                </div>
                <div style={{ width: gridWidth }} className="shrink-0 bg-ops-header-2" />
              </div>
            ) : null}

            {group.rows.map((vehicle) => {
              const lanes = packIntoLanes(segmentsByVehicle.get(vehicle.id) ?? []);
              const laneCount = Math.max(1, lanes.length);

              return (
                <div key={vehicle.id} className="flex border-b border-ops-rail">
                  <div
                    style={{ width: RAIL_WIDTH }}
                    className="sticky left-0 z-20 shrink-0 border-r border-ops-rail bg-ops-frame-2 px-2 py-1.5"
                  >
                    <VehicleIdentity
                      size="sm"
                      onDark
                      vehicle={{
                        id: vehicle.id,
                        name: vehicle.name,
                        subtitle: `${vehicle.brand} ${vehicle.model}`,
                        transmission: vehicle.transmission,
                        registration: vehicle.registration,
                        imageUrl: vehicle.imageUrl,
                        isStaffCar: vehicle.isStaffCar,
                      }}
                    />
                  </div>

                  <div className="relative shrink-0" style={{ width: gridWidth }}>
                    {/* Empty grid — each cell is a click target that pre-fills a manual booking. */}
                    <div className="absolute inset-0 flex">
                      {dayList.map((d, i) => {
                        const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                        return (
                          <Link
                            key={i}
                            href={newBookingHref(vehicle.id, d.toISOString().slice(0, 10))}
                            style={{ width: dayWidth }}
                            aria-label={`New booking for ${vehicle.name} on ${d.toISOString().slice(0, 10)}`}
                            className={cn(
                              "shrink-0 border-r border-ops-rail/60",
                              i === todayIndex && "bg-ops-accent/15",
                              weekend && i !== todayIndex && "bg-black/15",
                              "hover:bg-ops-accent/25"
                            )}
                          />
                        );
                      })}
                    </div>

                    <div
                      className="relative flex flex-col gap-px py-px"
                      style={{ minHeight: laneCount * 22 + 4 }}
                    >
                      {lanes.map((lane, laneIdx) => (
                        <div key={laneIdx} className="relative h-[20px]">
                          {lane.map((seg) => {
                            const def = OPS_STATUS[seg.status];
                            const width = (seg.endIndex - seg.startIndex) * dayWidth;
                            if (width <= 0) return null;
                            // The sr-only status label guarantees the state is
                            // never conveyed by colour alone. It is redundant
                            // when the segment already says it though — a
                            // maintenance bar labelled "Maintenance" was read
                            // out as "Maintenance Maintenance" — so it is
                            // emitted only when it adds something. The status
                            // itself is never dropped.
                            const statusNeedsAnnouncing =
                              seg.label.replace(/\s+/g, " ").trim().toLowerCase() !==
                              def.label.replace(/\s+/g, " ").trim().toLowerCase();
                            const content = (
                              <>
                                <span aria-hidden="true" className="font-mono text-[9px] opacity-80">
                                  {def.glyph}
                                </span>
                                <span className="truncate">{seg.label}</span>
                                {statusNeedsAnnouncing ? <span className="sr-only">{def.label}</span> : null}
                              </>
                            );
                            const className = cn(
                              "absolute top-0 flex h-[20px] items-center gap-1 overflow-hidden rounded-[2px] px-1 text-[10px] font-semibold",
                              def.cell
                            );
                            const style = { left: seg.startIndex * dayWidth + 1, width: width - 2 };
                            return seg.href ? (
                              <Link key={seg.key} href={seg.href} title={seg.title} className={className} style={style}>
                                {content}
                              </Link>
                            ) : (
                              <span key={seg.key} title={seg.title} className={className} style={style}>
                                {content}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {vehicles.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-ops-ink-inv-2">
            No vehicles match the current filters.
          </p>
        ) : null}
      </div>
    </div>
  );
}
