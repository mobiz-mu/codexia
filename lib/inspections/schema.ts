import { z } from "zod";
import {
  INSPECTION_RESULTS,
  INSPECTION_CHECKLIST,
  type InspectionResult,
} from "@/lib/fleet/inspection-checklist";
import { businessDate } from "@/lib/pricing/tariff";

/**
 * Validation and week arithmetic for Weekly Vehicle Inspections.
 *
 * The operational week is Mauritius local: Monday 00:00 through Sunday
 * 23:59:59, identified by its Sunday. `businessDate` is reused rather than
 * reimplemented so "today" means the same thing here as it does in pricing.
 */

/** The Sunday ending the Mauritius week that contains this calendar date. */
export function weekEndingFor(dateIso: string): string {
  // Parse as UTC noon: date-only arithmetic, immune to any host offset.
  const at = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) throw new Error(`Invalid date: ${dateIso}`);
  // getUTCDay: 0 = Sunday. Days remaining until (or on) Sunday.
  const daysUntilSunday = (7 - at.getUTCDay()) % 7;
  at.setUTCDate(at.getUTCDate() + daysUntilSunday);
  return at.toISOString().slice(0, 10);
}

/** The Monday opening the Mauritius week that ends on this Sunday. */
export function weekStartFor(weekEndingIso: string): string {
  const at = new Date(`${weekEndingIso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) throw new Error(`Invalid date: ${weekEndingIso}`);
  at.setUTCDate(at.getUTCDate() - 6);
  return at.toISOString().slice(0, 10);
}

export function isSunday(dateIso: string): boolean {
  const at = new Date(`${dateIso}T12:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.getUTCDay() === 0;
}

/** The current Mauritius calendar date — never the server's own date. */
export function todayInMauritius(now: Date = new Date()): string {
  return businessDate(now);
}

/** True when `dateIso` falls inside the Monday-Sunday week ending on `weekEnding`. */
export function dateFallsInWeek(dateIso: string, weekEnding: string): boolean {
  return dateIso <= weekEnding && dateIso >= weekStartFor(weekEnding);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateField = (label: string) =>
  z
    .string()
    .refine((v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)), `Please enter a valid ${label}.`);

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
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null))
    .refine((v) => v === null || (ISO_DATE.test(v) && !Number.isNaN(Date.parse(v))), {
      message: "Please enter a valid date.",
    });

export type InspectionFormState = { status: "idle" | "success" | "error"; error?: string; inspectionId?: string };

/**
 * Creating an inspection. Note what is NOT here: no checklist items, and no
 * `result`. Items are generated from the canonical catalogue server-side so a
 * client cannot introduce an unsupported key, and the result is always
 * derived from the items rather than submitted.
 */
export const createInspectionSchema = z
  .object({
    vehicleId: z.string().uuid("Please select a vehicle."),
    inspectionDate: dateField("inspection date"),
    weekEnding: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    odometerKm: z
      .string()
      .min(1, "Please enter the odometer reading.")
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v >= 0, "Odometer must be a whole number of kilometres, 0 or more."),
    driverName: optionalText(200),
    inspectorName: optionalText(200),
    companyName: optionalText(200),
    defectsNotes: optionalText(4000),
  })
  .refine((d) => d.weekEnding === null || isSunday(d.weekEnding), {
    message: "The week ending must be a Sunday.",
    path: ["weekEnding"],
  })
  .refine((d) => d.weekEnding === null || dateFallsInWeek(d.inspectionDate, d.weekEnding), {
    message: "The inspection date must fall inside the week it belongs to.",
    path: ["inspectionDate"],
  });

/** Editing the header of an existing inspection. */
export const updateInspectionSchema = z.object({
  inspectionDate: dateField("inspection date"),
  odometerKm: z
    .string()
    .min(1, "Please enter the odometer reading.")
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 0, "Odometer must be a whole number of kilometres, 0 or more."),
  driverName: optionalText(200),
  inspectorName: optionalText(200),
  companyName: optionalText(200),
  defectsNotes: optionalText(4000),
  driverAcknowledgedOn: optionalDate(),
  inspectorAcknowledgedOn: optionalDate(),
});

/**
 * A single checklist answer. `result` accepts the four values plus an empty
 * string meaning "back to unanswered", which a draft sheet legitimately needs
 * when an operator clears a mis-click.
 */
export const inspectionItemUpdateSchema = z.object({
  itemKey: z.string().refine((k) => INSPECTION_CHECKLIST.some((i) => i.key === k), "Unknown checklist item."),
  result: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null))
    .refine((v) => v === null || (INSPECTION_RESULTS as readonly string[]).includes(v), {
      message: "Result must be pass, attention, fail or n/a.",
    })
    .transform((v) => v as InspectionResult | null),
  remarks: optionalText(2000),
});

/** Approval is its own input, deliberately carrying no result field. */
export const approveInspectionSchema = z.object({
  approvalRemarks: optionalText(2000),
});

/** Explicit downtime raised from an inspection. Never implied by a failure. */
export const inspectionDowntimeSchema = z
  .object({
    startAt: z.string().min(1, "Enter when the vehicle goes off the road."),
    endAt: z.string().min(1, "Enter when the vehicle returns to service."),
    note: optionalText(500),
  })
  .refine((d) => !Number.isNaN(Date.parse(d.startAt)) && !Number.isNaN(Date.parse(d.endAt)), {
    message: "Enter valid downtime start and end times.",
    path: ["startAt"],
  })
  .refine(
    (d) =>
      Number.isNaN(Date.parse(d.startAt)) ||
      Number.isNaN(Date.parse(d.endAt)) ||
      new Date(d.endAt) > new Date(d.startAt),
    { message: "Downtime must end after it starts.", path: ["endAt"] }
  );

/** Raising a maintenance job from selected defects. */
export const inspectionFollowUpSchema = z.object({
  itemKeys: z
    .array(z.string())
    .min(1, "Select at least one defect to raise maintenance for.")
    .refine(
      (keys) => keys.every((k) => INSPECTION_CHECKLIST.some((i) => i.key === k)),
      "Unknown checklist item."
    ),
  maintenanceType: z.string().optional(),
  serviceProvider: z.string().optional(),
  notes: z.string().optional(),
});

export type DerivedResultFilter = "draft" | "completed" | "attention_required" | "failed";

export type InspectionListFilters = {
  vehicleId: string | null;
  weekEnding: string | null;
  result: DerivedResultFilter | null;
  approval: "approved" | "unapproved" | null;
  defectsOnly: boolean;
  search: string | null;
  page: number;
};

export function normalizeInspectionListFilters(params: {
  vehicleId?: string;
  weekEnding?: string;
  result?: string;
  approval?: string;
  defectsOnly?: string;
  search?: string;
  page?: string;
}): InspectionListFilters {
  const page = Number.parseInt(params.page ?? "1", 10);
  const validResults: DerivedResultFilter[] = ["draft", "completed", "attention_required", "failed"];
  return {
    vehicleId: params.vehicleId && params.vehicleId.trim().length > 0 ? params.vehicleId : null,
    weekEnding: params.weekEnding && ISO_DATE.test(params.weekEnding) ? params.weekEnding : null,
    result:
      params.result && validResults.includes(params.result as DerivedResultFilter)
        ? (params.result as DerivedResultFilter)
        : null,
    approval: params.approval === "approved" || params.approval === "unapproved" ? params.approval : null,
    defectsOnly: params.defectsOnly === "1" || params.defectsOnly === "true",
    search: params.search && params.search.trim().length > 0 ? params.search.trim() : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Strips PostgREST/ILIKE wildcards from operator-supplied search text. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,()]/g, " ").trim().slice(0, 120);
}
