import Image from "next/image";
import { Car } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Vehicle image beside the operational data, the way the reference does it
 * on every fleet screen. Used in the planning board's left rail, in tariff
 * rows, and as the header of a maintenance, fuel, compliance, inspection or
 * incident record — so the controller can always see which car they are
 * working on rather than trusting a name in a breadcrumb.
 *
 * Falls back to a marque silhouette when a vehicle has no photo yet, which
 * is currently every vehicle: the image pipeline and its WebP/AVIF variants
 * exist, but no photos have been uploaded.
 */

export type VehicleIdentityData = {
  id: string;
  name: string;
  /** e.g. "Suzuki Swift" when the display name is just "Swift". */
  subtitle?: string | null;
  transmission?: "manual" | "automatic" | null;
  registration?: string | null;
  imageUrl?: string | null;
  /** Number of physical cars behind a grouped model row. */
  stock?: number | null;
  isStaffCar?: boolean;
};

const SIZES = {
  sm: { box: "h-9 w-14", img: 56, text: "text-[12px]", sub: "text-[10px]" },
  md: { box: "h-12 w-20", img: 80, text: "text-[13px]", sub: "text-[11px]" },
  lg: { box: "h-20 w-32", img: 128, text: "text-[15px]", sub: "text-[12px]" },
} as const;

export function VehicleIdentity({
  vehicle,
  size = "md",
  className,
  onDark = false,
}: {
  vehicle: VehicleIdentityData;
  size?: keyof typeof SIZES;
  className?: string;
  /** Rendered on the dark frame (the board's vehicle rail) rather than a light panel. */
  onDark?: boolean;
}) {
  const s = SIZES[size];
  const detail = [
    vehicle.transmission === "automatic" ? "Automatic" : vehicle.transmission === "manual" ? "Manual" : null,
    vehicle.registration,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-sm border",
          onDark ? "border-ops-rail bg-ops-frame-3" : "border-ops-line bg-ops-panel-2",
          s.box
        )}
      >
        {vehicle.imageUrl ? (
          <Image
            src={vehicle.imageUrl}
            alt=""
            width={s.img}
            height={Math.round(s.img * 0.625)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center" aria-hidden="true">
            <Car className={cn("h-4 w-4", onDark ? "text-ops-ink-inv-2" : "text-ops-ink-3")} />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold leading-tight",
            onDark ? "text-ops-ink-inv" : "text-ops-ink",
            s.text
          )}
        >
          {vehicle.name}
        </p>
        {vehicle.subtitle ? (
          <p className={cn("truncate leading-tight", onDark ? "text-ops-ink-inv-2" : "text-ops-ink-3", s.sub)}>
            {vehicle.subtitle}
          </p>
        ) : null}
        {detail ? (
          <p className={cn("truncate leading-tight", onDark ? "text-ops-ink-inv-2" : "text-ops-ink-3", s.sub)}>
            {detail}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {typeof vehicle.stock === "number" ? (
            <span
              className={cn(
                "inline-block rounded-[2px] px-1 py-px text-[10px] font-semibold tabular-nums",
                onDark ? "bg-ops-frame-3 text-ops-ink-inv-2" : "bg-ops-panel-3 text-ops-ink-2"
              )}
            >
              Stock: {vehicle.stock} {vehicle.stock === 1 ? "vehicle" : "vehicles"}
            </span>
          ) : null}
          {vehicle.isStaffCar ? (
            <span className="inline-block rounded-[2px] bg-ops-staff px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white">
              Staff
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
