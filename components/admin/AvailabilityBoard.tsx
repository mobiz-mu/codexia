"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type {
  AvailabilityBoardBlock,
  AvailabilityBoardBooking,
  AvailabilityBoardVehicle,
} from "@/lib/actions/admin/availability";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_COL_WIDTH = 40;
const VEHICLE_COL_WIDTH = 200;

// Matches BookingCalendarGrid's palette so a status reads the same colour
// everywhere in the admin — pending family = amber, confirmed family = blue,
// vehicle-assignment family = indigo, active = the brand action colour,
// terminal/negative = gray or red.
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-800",
  awaiting_payment: "bg-amber-100 text-amber-800",
  payment_proof_submitted: "bg-amber-100 text-amber-800",
  payment_under_review: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800 border border-blue-300",
  partially_paid: "bg-blue-100 text-blue-800 border border-blue-300",
  paid: "bg-blue-100 text-blue-800 border border-blue-300",
  vehicle_assigned: "bg-indigo-100 text-indigo-800 border border-indigo-300",
  ready_for_pickup: "bg-indigo-100 text-indigo-800 border border-indigo-300",
  active: "bg-action text-ink",
  completed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  refunded: "bg-gray-200 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  payment_proof_submitted: "Proof Submitted",
  payment_under_review: "Proof Under Review",
  confirmed: "Confirmed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  vehicle_assigned: "Vehicle Assigned",
  ready_for_pickup: "Ready for Pickup",
  active: "Active Rental",
  completed: "Returned",
  cancelled: "Cancelled",
  no_show: "No Show",
  refunded: "Refunded",
  rejected: "Rejected",
};

const BLOCK_STYLES: Record<string, string> = {
  maintenance: "bg-orange-200 text-orange-900",
  internal: "bg-gray-300 text-gray-700",
  preparing: "bg-teal-200 text-teal-900",
  cleaning: "bg-sky-200 text-sky-900",
  incident: "bg-red-200 text-red-900",
};

const BLOCK_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  internal: "Blocked",
  preparing: "Preparing",
  cleaning: "Cleaning",
  incident: "Accident / Damage",
};

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayOffset(windowStart: Date, date: Date) {
  return Math.round((startOfDay(date).getTime() - windowStart.getTime()) / DAY_MS);
}

export function AvailabilityBoard({
  windowStart,
  days,
  vehicles,
  bookings,
  blocks,
}: {
  windowStart: string;
  days: number;
  vehicles: AvailabilityBoardVehicle[];
  bookings: AvailabilityBoardBooking[];
  blocks: AvailabilityBoardBlock[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const start = useMemo(() => startOfDay(new Date(windowStart)), [windowStart]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayOffset = dayOffset(start, today);

  const dateColumns = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const d = new Date(start.getTime() + i * DAY_MS);
        return d;
      }),
    [start, days]
  );

  const bookingsByVehicle = useMemo(() => {
    const map = new Map<string, AvailabilityBoardBooking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.vehicleId) ?? [];
      list.push(booking);
      map.set(booking.vehicleId, list);
    }
    return map;
  }, [bookings]);

  const blocksByVehicle = useMemo(() => {
    const map = new Map<string, AvailabilityBoardBlock[]>();
    for (const block of blocks) {
      const list = map.get(block.vehicleId) ?? [];
      list.push(block);
      map.set(block.vehicleId, list);
    }
    return map;
  }, [blocks]);

  const gridTemplateColumns = `${VEHICLE_COL_WIDTH}px repeat(${days}, ${DAY_COL_WIDTH}px)`;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <div className="min-w-max" style={{ display: "grid", gridTemplateColumns }}>
        {/* Header row */}
        <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-surface px-3 py-2 text-xs font-semibold uppercase text-muted">
          Vehicle
        </div>
        {dateColumns.map((d, i) => {
          const isToday = i === todayOffset;
          const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
          return (
            <div
              key={i}
              className={cn(
                "border-b border-border py-2 text-center text-[11px] font-medium text-muted",
                isWeekend && "bg-surface",
                isToday && "bg-primary-tint text-primary-dark"
              )}
            >
              <div>{d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</div>
            </div>
          );
        })}

        {/* Vehicle rows */}
        {vehicles.map((vehicle, rowIndex) => {
          const rowTop = rowIndex + 2; // +1 for 1-index, +1 for header row
          const vehicleBookings = bookingsByVehicle.get(vehicle.id) ?? [];
          const vehicleBlocks = blocksByVehicle.get(vehicle.id) ?? [];

          return (
            <div key={vehicle.id} className="contents">
              <div
                className="sticky left-0 z-10 flex items-center border-b border-r border-border bg-background px-3 py-3 text-sm font-medium text-ink"
                style={{ gridRow: rowTop, gridColumn: 1 }}
              >
                {vehicle.name}
              </div>
              <div
                className="relative border-b border-border"
                style={{ gridRow: rowTop, gridColumn: `2 / span ${days}`, height: "48px" }}
              >
                {/* day-cell background stripes (weekend shading) */}
                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days}, ${DAY_COL_WIDTH}px)` }}>
                  {dateColumns.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-border/50",
                        (d.getUTCDay() === 0 || d.getUTCDay() === 6) && "bg-surface/60",
                        i === todayOffset && "bg-primary-tint/40"
                      )}
                    />
                  ))}
                </div>

                {vehicleBlocks.map((block) => {
                  const startOff = Math.max(0, dayOffset(start, new Date(block.startAt)));
                  const endOff = Math.min(days, dayOffset(start, new Date(block.endAt)));
                  const span = Math.max(1, endOff - startOff);
                  if (startOff >= days || endOff <= 0) return null;
                  return (
                    <div
                      key={block.id}
                      className={cn(
                        "absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium",
                        BLOCK_STYLES[block.type] ?? BLOCK_STYLES.internal
                      )}
                      style={{
                        left: startOff * DAY_COL_WIDTH,
                        width: span * DAY_COL_WIDTH - 4,
                      }}
                      title={`${BLOCK_LABELS[block.type] ?? block.type}${block.note ? ` — ${block.note}` : ""}`}
                    >
                      {BLOCK_LABELS[block.type] ?? block.type}
                    </div>
                  );
                })}

                {vehicleBookings.map((booking) => {
                  const startOff = Math.max(0, dayOffset(start, new Date(booking.pickupAt)));
                  const endOff = Math.min(days, dayOffset(start, new Date(booking.returnAt)) || 1);
                  const span = Math.max(1, endOff - startOff);
                  if (startOff >= days || endOff <= 0) return null;
                  const isHovered = hovered === booking.id;

                  return (
                    <Link
                      key={booking.id}
                      href={`/admin/bookings/${booking.id}`}
                      className={cn(
                        "absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold shadow-sm transition-all",
                        STATUS_STYLES[booking.status] ?? "bg-gray-200 text-gray-700",
                        isHovered && "z-30 ring-2 ring-primary"
                      )}
                      style={{
                        left: startOff * DAY_COL_WIDTH,
                        width: span * DAY_COL_WIDTH - 4,
                      }}
                      onMouseEnter={() => setHovered(booking.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="truncate">{booking.reference}</span>

                      {isHovered && (
                        <div className="absolute left-0 top-11 z-40 w-56 rounded-lg border border-border bg-background p-3 text-left text-xs text-ink shadow-lg">
                          <p className="font-semibold">{booking.reference}</p>
                          <p className="mt-1 text-muted">{booking.customerName || "—"}</p>
                          <p className="mt-1">
                            {new Date(booking.pickupAt).toLocaleDateString("en-GB")} →{" "}
                            {new Date(booking.returnAt).toLocaleDateString("en-GB")}
                          </p>
                          <p className="mt-1 font-medium text-primary-dark">
                            {STATUS_LABELS[booking.status] ?? booking.status}
                          </p>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {vehicles.length === 0 && (
          <div
            className="px-4 py-8 text-center text-sm text-muted"
            style={{ gridColumn: `1 / span ${days + 1}` }}
          >
            No active vehicles yet.
          </div>
        )}
      </div>
    </div>
  );
}

const LEGEND_GROUPS: Array<{ key: string; styles: Record<string, string>; labels: Record<string, string> }> = [
  { key: "pending", styles: STATUS_STYLES, labels: STATUS_LABELS },
  { key: "confirmed", styles: STATUS_STYLES, labels: STATUS_LABELS },
  { key: "vehicle_assigned", styles: STATUS_STYLES, labels: STATUS_LABELS },
  { key: "active", styles: STATUS_STYLES, labels: STATUS_LABELS },
  { key: "completed", styles: STATUS_STYLES, labels: STATUS_LABELS },
  { key: "cancelled", styles: STATUS_STYLES, labels: STATUS_LABELS },
];

export function AvailabilityBoardLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {LEGEND_GROUPS.map(({ key, styles, labels }) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-sm", styles[key])} />
          {labels[key]}
        </span>
      ))}
      {Object.entries(BLOCK_LABELS).map(([key, label]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-sm", BLOCK_STYLES[key])} />
          {label}
        </span>
      ))}
    </div>
  );
}
