import { z } from "zod";

export const INCIDENT_TYPES = [
  "collision",
  "parking_damage",
  "windscreen",
  "tyre_wheel",
  "vandalism",
  "theft_attempt",
  "weather_damage",
  "mechanical_damage",
  "other",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  collision: "Collision",
  parking_damage: "Parking damage",
  windscreen: "Windscreen",
  tyre_wheel: "Tyre / wheel",
  vandalism: "Vandalism",
  theft_attempt: "Theft attempt",
  weather_damage: "Weather damage",
  mechanical_damage: "Mechanical damage",
  other: "Other",
};

export const SEVERITIES = ["minor", "moderate", "major", "write_off"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  write_off: "Write-off",
};

export const REPAIR_STATUSES = [
  "reported",
  "under_assessment",
  "awaiting_insurance",
  "approved_for_repair",
  "under_repair",
  "repaired",
  "closed",
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  reported: "Reported",
  under_assessment: "Under assessment",
  awaiting_insurance: "Awaiting insurance",
  approved_for_repair: "Approved for repair",
  under_repair: "Under repair",
  repaired: "Repaired",
  closed: "Closed",
};

// "Open" = not yet fully wrapped up — drives dashboard KPIs and the vehicle
// detail compact section.
export const OPEN_REPAIR_STATUSES: readonly RepairStatus[] = [
  "reported",
  "under_assessment",
  "awaiting_insurance",
  "approved_for_repair",
  "under_repair",
];

export function isOpenRepairStatus(status: RepairStatus): boolean {
  return OPEN_REPAIR_STATUSES.includes(status);
}

// No explicit list was given for this field in the spec — this is my own
// proposed 3-value set (driveability right after the incident, distinct
// from the repair workflow status), flagged for confirmation.
export const VEHICLE_OPERATIONAL_STATUSES = ["operational", "limited_operation", "not_operational"] as const;
export type VehicleOperationalStatus = (typeof VEHICLE_OPERATIONAL_STATUSES)[number];

export const VEHICLE_OPERATIONAL_STATUS_LABELS: Record<VehicleOperationalStatus, string> = {
  operational: "Operational",
  limited_operation: "Limited operation",
  not_operational: "Not operational",
};

export const ATTACHMENT_CATEGORIES = ["photo", "police_report", "insurance_document", "repair_quotation", "other"] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  photo: "Photo",
  police_report: "Police report",
  insurance_document: "Insurance document",
  repair_quotation: "Repair quotation / invoice",
  other: "Other",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalDate = () =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Not a valid date." });

const optionalEurCost = () =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : null))
    .refine((v) => v === null || (Number.isFinite(Number.parseFloat(v)) && Number.parseFloat(v) >= 0), {
      message: "Cost must be a valid EUR amount of 0 or more.",
    })
    .transform((v) => (v === null ? null : Math.round(Number.parseFloat(v) * 100)));

export const incidentSchema = z
  .object({
    vehicleId: z.string().uuid("Please select a vehicle."),
    incidentDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Please enter a valid incident date." }),
    incidentTime: optionalText(10),
    location: optionalText(200),
    driverCustomerName: optionalText(200),
    bookingReference: optionalText(50),
    incidentType: z.enum(INCIDENT_TYPES, { message: "Please select an incident type." }),
    customType: optionalText(200),
    accidentDescription: optionalText(4000),
    damageDescription: optionalText(4000),
    affectedAreas: optionalText(1000),
    policeReportReference: optionalText(200),
    insuranceClaimReference: optionalText(200),
    thirdPartyDetails: optionalText(2000),
    estimatedRepairCostEur: optionalEurCost(),
    actualRepairCostEur: optionalEurCost(),
    vehicleOperationalStatus: z.enum(VEHICLE_OPERATIONAL_STATUSES, { message: "Please select an operational status." }),
    repairStatus: z.enum(REPAIR_STATUSES, { message: "Please select a repair status." }),
    severity: z.enum(SEVERITIES, { message: "Please select a severity." }),
    dateReported: optionalDate(),
    dateRepairStarted: optionalDate(),
    dateRepaired: optionalDate(),
    downtimeStart: optionalDate(),
    downtimeEnd: optionalDate(),
    remarks: optionalText(4000),
  })
  .refine((data) => data.incidentType !== "other" || (data.customType && data.customType.length > 0), {
    message: "Please enter a custom type when incident type is Other.",
    path: ["customType"],
  })
  .refine((data) => data.dateReported === null || data.dateReported >= data.incidentDate, {
    message: "Date reported cannot be before the incident date.",
    path: ["dateReported"],
  })
  .refine((data) => data.dateRepairStarted === null || data.dateRepairStarted >= data.incidentDate, {
    message: "Repair start date cannot be before the incident date.",
    path: ["dateRepairStarted"],
  })
  .refine((data) => data.dateRepaired === null || data.dateRepaired >= data.incidentDate, {
    message: "Repair date cannot be before the incident date.",
    path: ["dateRepaired"],
  })
  .refine(
    (data) => data.dateRepaired === null || data.dateRepairStarted === null || data.dateRepaired >= data.dateRepairStarted,
    { message: "Repair completion date cannot be before the repair start date.", path: ["dateRepaired"] }
  )
  .refine((data) => data.downtimeStart === null || data.downtimeStart >= data.incidentDate, {
    message: "Downtime cannot start before the incident date.",
    path: ["downtimeStart"],
  })
  .refine((data) => data.downtimeEnd === null || data.downtimeStart === null || data.downtimeEnd >= data.downtimeStart, {
    message: "Downtime end cannot be before downtime start.",
    path: ["downtimeEnd"],
  });

export type IncidentListFilters = {
  vehicleId: string | null;
  severity: Severity | null;
  repairStatus: RepairStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
  page: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeIncidentListFilters(params: {
  vehicleId?: string;
  severity?: string;
  repairStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: string;
}): IncidentListFilters {
  const page = Number(params.page);
  return {
    vehicleId: params.vehicleId && UUID_RE.test(params.vehicleId) ? params.vehicleId : null,
    severity: params.severity && (SEVERITIES as readonly string[]).includes(params.severity) ? (params.severity as Severity) : null,
    repairStatus:
      params.repairStatus && (REPAIR_STATUSES as readonly string[]).includes(params.repairStatus)
        ? (params.repairStatus as RepairStatus)
        : null,
    dateFrom: params.dateFrom && !Number.isNaN(Date.parse(params.dateFrom)) ? params.dateFrom : null,
    dateTo: params.dateTo && !Number.isNaN(Date.parse(params.dateTo)) ? params.dateTo : null,
    search: params.search && params.search.trim().length > 0 ? params.search.trim().slice(0, 200) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

// Duplicated (not shared) from the maintenance/compliance modules — each
// stays independent of the others per the established convention.
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").trim();
}
