/**
 * The single semantic status vocabulary for the fleet planning board and
 * every operational list in /admin.
 *
 * Before this existed, the same booking status was coloured independently in
 * AvailabilityBoard.tsx and BookingCalendarGrid.tsx, with a comment in one
 * asking the other to be kept in sync by hand. Everything now resolves
 * through here instead, so a status reads identically everywhere and a new
 * state is added in exactly one place.
 *
 * Every entry carries a `glyph` and a `label` as well as a colour. Nothing
 * on the board may be distinguishable by colour alone — that is an
 * accessibility requirement, not a stylistic one.
 *
 * These are presentation mappings over states the booking and availability
 * engines already own. No status is invented here purely to match a colour
 * in the reference screenshots.
 */

export type OpsStatusKey =
  | "free"
  | "booked"
  | "web"
  | "agency"
  | "quote"
  | "maintenance"
  | "incident"
  | "inspection"
  | "staff"
  | "stop_sell"
  | "conflict";

export type OpsStatusDef = {
  key: OpsStatusKey;
  label: string;
  /** Shown inside timeline cells and legend swatches; never the sole cue on its own, always beside a label. */
  glyph: string;
  /** Tailwind classes for a filled timeline cell. */
  cell: string;
  /** Tailwind classes for an inline badge in a table. */
  badge: string;
  /** Inline swatch colour for the legend. */
  swatch: string;
  description: string;
};

export const OPS_STATUS: Record<OpsStatusKey, OpsStatusDef> = {
  free: {
    key: "free",
    label: "Available",
    glyph: "·",
    cell: "bg-ops-free text-ops-ink-3",
    badge: "bg-ops-panel-2 text-ops-ink-2 border border-ops-line",
    swatch: "var(--color-ops-free)",
    description: "No booking or block on this day",
  },
  booked: {
    key: "booked",
    label: "Confirmed booking",
    glyph: "R",
    cell: "bg-ops-booked text-white",
    badge: "bg-ops-booked text-white",
    swatch: "var(--color-ops-booked)",
    description: "Confirmed, paid or active rental",
  },
  web: {
    key: "web",
    label: "Website booking",
    glyph: "W",
    cell: "bg-ops-web text-white",
    badge: "bg-ops-web text-white",
    swatch: "var(--color-ops-web)",
    description: "Booked by the customer online",
  },
  agency: {
    key: "agency",
    label: "Agency booking",
    glyph: "A",
    cell: "bg-ops-agency text-white",
    badge: "bg-ops-agency text-white",
    swatch: "var(--color-ops-agency)",
    description: "Entered manually by staff",
  },
  quote: {
    key: "quote",
    label: "Quote / hold",
    glyph: "Q",
    cell: "bg-ops-quote text-white",
    badge: "bg-ops-quote text-white",
    swatch: "var(--color-ops-quote)",
    description: "Pending and unpaid — not yet firm",
  },
  maintenance: {
    key: "maintenance",
    label: "Maintenance",
    glyph: "M",
    cell: "bg-ops-maint text-white",
    badge: "bg-ops-maint text-white",
    swatch: "var(--color-ops-maint)",
    description: "Off the road for service or repair",
  },
  incident: {
    key: "incident",
    label: "Incident downtime",
    glyph: "!",
    cell: "bg-ops-incident text-white",
    badge: "bg-ops-incident text-white",
    swatch: "var(--color-ops-incident)",
    description: "Off the road after an accident or damage",
  },
  inspection: {
    key: "inspection",
    label: "Inspection downtime",
    glyph: "I",
    // Amber rather than the incident brown: a weekly inspection taking a car
    // off the road is planned fleet work, not an accident. Distinct from
    // maintenance too, so the board says WHY the vehicle is unavailable.
    cell: "bg-ops-warning text-white",
    badge: "bg-ops-warning text-white",
    swatch: "var(--color-ops-warning)",
    description: "Off the road after a weekly inspection defect",
  },
  staff: {
    key: "staff",
    label: "Staff car",
    glyph: "S",
    cell: "bg-ops-staff text-white",
    badge: "bg-ops-staff text-white",
    swatch: "var(--color-ops-staff)",
    description: "Internal vehicle — never publicly rentable",
  },
  stop_sell: {
    key: "stop_sell",
    label: "Stop-sell",
    glyph: "X",
    cell: "bg-ops-stopsell text-white",
    badge: "bg-ops-stopsell text-white",
    swatch: "var(--color-ops-stopsell)",
    description: "Withheld from sale by a commercial decision",
  },
  conflict: {
    key: "conflict",
    label: "Conflict",
    glyph: "!",
    cell: "bg-ops-conflict text-ops-ink",
    badge: "bg-ops-conflict text-ops-ink",
    swatch: "var(--color-ops-conflict)",
    description: "Overlapping commitments needing resolution",
  },
};

/** Legend order — read left to right as: sellable, sold, off the road, exceptional. */
export const OPS_LEGEND_ORDER: OpsStatusKey[] = [
  "free",
  "booked",
  "web",
  "agency",
  "quote",
  "maintenance",
  "incident",
  "inspection",
  "staff",
  "stop_sell",
  "conflict",
];

/**
 * Booking status -> board status.
 *
 * Terminal states (cancelled, no_show, refunded, rejected, completed) are
 * intentionally absent: they release the vehicle, so they must not paint a
 * cell as occupied. Callers filter to active statuses before mapping, and
 * `null` here is the second line of defence.
 */
const BOOKING_STATUS_TO_OPS: Record<string, OpsStatusKey> = {
  draft: "quote",
  pending: "quote",
  awaiting_payment: "quote",
  payment_proof_submitted: "quote",
  payment_under_review: "quote",
  confirmed: "booked",
  partially_paid: "booked",
  paid: "booked",
  vehicle_assigned: "booked",
  ready_for_pickup: "booked",
  active: "booked",
};

/**
 * `channel` refines a firm booking into website vs agency so the board shows
 * where business came from, exactly as the reference does. An unpaid hold
 * stays a quote regardless of channel — how it arrived matters less than the
 * fact it is not yet firm.
 */
export function opsStatusForBooking(status: string, channel?: "web" | "agency" | null): OpsStatusKey | null {
  const mapped = BOOKING_STATUS_TO_OPS[status];
  if (!mapped) return null;
  if (mapped === "booked" && channel === "web") return "web";
  if (mapped === "booked" && channel === "agency") return "agency";
  return mapped;
}

/** vehicle_blocks.type -> board status. `internal` and `preparing`/`cleaning` are turnaround work, shown as maintenance. */
const BLOCK_TYPE_TO_OPS: Record<string, OpsStatusKey> = {
  maintenance: "maintenance",
  internal: "maintenance",
  preparing: "maintenance",
  cleaning: "maintenance",
  incident: "incident",
  inspection: "inspection",
  stop_sell: "stop_sell",
};

export function opsStatusForBlock(type: string): OpsStatusKey {
  return BLOCK_TYPE_TO_OPS[type] ?? "maintenance";
}

export function opsStatus(key: OpsStatusKey): OpsStatusDef {
  return OPS_STATUS[key];
}
