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
    // Entered as a plain EUR decimal string ("123.45"), stored as cents —
    // same convention as the deposit-tier admin settings.
    costEur: z
      .string()
      .refine((v) => Number.isFinite(Number.parseFloat(v)) && Number.parseFloat(v) >= 0, {
        message: "Total cost must be a valid EUR amount of 0 or more.",
      })
      .transform((v) => Math.round(Number.parseFloat(v) * 100)),
    remarks: optionalText(4000),
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
  });

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
