import { z } from "zod";

export const MAINTENANCE_TYPES = [
  "scheduled_service",
  "repair",
  "tyre_change",
  "battery_change",
  "oil_filter_change",
  "brake_work",
  "suspension_work",
  "electrical_work",
  "other",
] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  scheduled_service: "Scheduled service",
  repair: "Repair",
  tyre_change: "Tyre change",
  battery_change: "Battery change",
  oil_filter_change: "Oil / filter change",
  brake_work: "Brake work",
  suspension_work: "Suspension work",
  electrical_work: "Electrical work",
  other: "Other",
};

// FormData sends "" for an empty input — the DB column should be null, not
// an empty string, so every optional detail field normalizes through this.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

// Rupee decimal string ("1499.77") -> MUR minor units. Money never becomes a
// float: the string is parsed once and immediately rounded to integer cents.
const murAmount = (label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim().replace(",", ".") : "0"))
    .refine((v) => /^\d+(\.\d{0,2})?$/.test(v), {
      message: `${label} must be a valid rupee amount, for example 1499.77.`,
    })
    .transform((v) => Math.round(Number.parseFloat(v) * 100));

export const maintenanceSchema = z
  .object({
    vehicleId: z.string().uuid("Please select a vehicle."),
    maintenanceDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Please enter a valid maintenance date."),
    maintenanceType: z.enum(MAINTENANCE_TYPES, { message: "Please select a maintenance type." }),
    customType: optionalText(200),
    repairsPerformed: optionalText(4000),
    partsChanged: optionalText(4000),
    tyreChanges: optionalText(4000),
    batteryChanges: optionalText(4000),
    servicingDetails: optionalText(4000),
    oilFilterChanges: optionalText(4000),
    brakeWork: optionalText(4000),
    suspensionWork: optionalText(4000),
    electricalWork: optionalText(4000),
    mileageKm: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
        message: "Mileage must be a whole number of 0 or more.",
      }),
    serviceProvider: optionalText(200),
    invoiceReference: optionalText(120),
    // Entered as a plain rupee decimal string ("1499.77"), stored as MUR minor
    // units. Fleet running costs are rupee-denominated (0030); customer rental
    // pricing is EUR and lives in an entirely different set of tables.
    costMur: murAmount("Total cost"),
    partsCostMur: murAmount("Parts cost"),
    labourCostMur: murAmount("Labour cost"),
    otherCostMur: murAmount("Other cost"),
    nextServiceDate: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : null)),
    nextServiceMileageKm: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
        message: "Next service mileage must be a whole number of 0 or more.",
      }),
    remarks: optionalText(4000),

    // Set when this job was raised from a weekly inspection defect (0034).
    // Carried through the SAME create path as any other maintenance record so
    // an inspection follow-up is a normal maintenance job, not a parallel one.
    sourceInspectionId: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : null))
      .refine((v) => v === null || z.string().uuid().safeParse(v).success, {
        message: "Invalid source inspection reference.",
      }),

    // Downtime is opt-in. Recording that work happened must never, on its own,
    // retroactively take a vehicle off the road.
    markUnavailable: z.coerce.boolean().default(false),
    downtimeStart: z.string().optional().transform((v) => (v && v.trim() ? v : null)),
    downtimeEnd: z.string().optional().transform((v) => (v && v.trim() ? v : null)),
    // Unchecked checkboxes are omitted from FormData entirely, not sent as
    // "false" — .default(false) covers the key being absent. Opt-in only:
    // backfilling an old record must never silently overwrite the vehicle's
    // live last_service_date/current_mileage_km unless the admin explicitly
    // asks for it here.
    updateVehicleInfo: z.coerce.boolean().default(false),
  })
  .refine((data) => data.maintenanceType !== "other" || (data.customType && data.customType.length > 0), {
    message: "Please enter a custom type when maintenance type is Other.",
    path: ["customType"],
  })
  .refine((data) => !data.markUnavailable || (data.downtimeStart && data.downtimeEnd), {
    message: "Enter the downtime start and end when marking the vehicle unavailable.",
    path: ["downtimeStart"],
  })
  .refine(
    (data) =>
      !data.markUnavailable ||
      !data.downtimeStart ||
      !data.downtimeEnd ||
      new Date(data.downtimeEnd) > new Date(data.downtimeStart),
    { message: "Downtime must end after it starts.", path: ["downtimeEnd"] }
  );

export type MaintenanceListFilters = {
  vehicleId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  type: MaintenanceType | null;
  search: string | null;
  page: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeMaintenanceListFilters(params: {
  vehicleId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  search?: string;
  page?: string;
}): MaintenanceListFilters {
  const page = Number(params.page);
  const type = params.type;
  return {
    vehicleId: params.vehicleId && UUID_RE.test(params.vehicleId) ? params.vehicleId : null,
    dateFrom: params.dateFrom && !Number.isNaN(Date.parse(params.dateFrom)) ? params.dateFrom : null,
    dateTo: params.dateTo && !Number.isNaN(Date.parse(params.dateTo)) ? params.dateTo : null,
    type: type && (MAINTENANCE_TYPES as readonly string[]).includes(type) ? (type as MaintenanceType) : null,
    search: params.search && params.search.trim().length > 0 ? params.search.trim().slice(0, 200) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

// Strips characters with special meaning in a PostgREST `.or()` filter
// expression (comma separates conditions, parentheses group them) so a
// search term can't break out of the two ilike conditions it's placed into.
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").trim();
}

/**
 * How a maintenance record's money should be presented.
 *
 * Records predating the itemised columns (0032) carry a total with all three
 * components at zero. Rendering those as "Parts Rs 0.00 · Labour Rs 0.00 ·
 * Other Rs 0.00 · Total Rs 1,499.77" reads as a reconciliation failure to an
 * operator, when in fact the breakdown was simply never captured.
 *
 * The stored row is never rewritten and no breakdown is ever invented — this
 * only decides which of three shapes the UI draws.
 */
export type MaintenanceCostBreakdown =
  | { kind: "itemised"; parts: number; labour: number; other: number; total: number }
  | { kind: "unitemised"; total: number }
  | { kind: "none" };

export function resolveMaintenanceCostBreakdown(costs: {
  parts_cost_cents: number | null;
  labour_cost_cents: number | null;
  other_cost_cents: number | null;
  cost_cents: number | null;
}): MaintenanceCostBreakdown {
  const parts = costs.parts_cost_cents ?? 0;
  const labour = costs.labour_cost_cents ?? 0;
  const other = costs.other_cost_cents ?? 0;
  const total = costs.cost_cents ?? 0;
  const itemisedSum = parts + labour + other;

  // Nothing was ever recorded against this job.
  if (total === 0 && itemisedSum === 0) return { kind: "none" };

  // A total with no components behind it: legacy, or entered as a lump sum.
  if (itemisedSum === 0) return { kind: "unitemised", total };

  return { kind: "itemised", parts, labour, other, total };
}

/**
 * Aggregate across a page of records. Components are summed only from rows
 * that actually have a breakdown, so a legacy lump sum never inflates the
 * "Parts" figure — but it still counts toward the total, and the caller is
 * told how much of that total is unaccounted for.
 */
export function summariseMaintenanceCosts(
  rows: Array<{
    parts_cost_cents: number | null;
    labour_cost_cents: number | null;
    other_cost_cents: number | null;
    cost_cents: number | null;
  }>
) {
  let parts = 0;
  let labour = 0;
  let other = 0;
  let total = 0;
  let unitemisedTotal = 0;

  for (const row of rows) {
    const breakdown = resolveMaintenanceCostBreakdown(row);
    if (breakdown.kind === "itemised") {
      parts += breakdown.parts;
      labour += breakdown.labour;
      other += breakdown.other;
      total += breakdown.total;
    } else if (breakdown.kind === "unitemised") {
      unitemisedTotal += breakdown.total;
      total += breakdown.total;
    }
  }

  return { parts, labour, other, total, unitemisedTotal, hasItemisation: parts + labour + other > 0 };
}
