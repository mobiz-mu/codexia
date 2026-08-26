import { z } from "zod";

export const DOCUMENT_TYPES = ["road_tax", "insurance", "psvl", "fitness", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  road_tax: "Road Tax",
  insurance: "Insurance",
  psvl: "PSVL",
  fitness: "Fitness",
  other: "Other",
};

// The 4 fixed slots shown in the vehicle-detail compact Compliance section —
// "Other" documents (which can be multiple, distinguished by custom_type)
// don't fit a single-current-slot model and are only surfaced via the full
// history/list page.
export const COMPACT_DOCUMENT_TYPES = ["road_tax", "insurance", "psvl", "fitness"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const complianceSchema = z
  .object({
    vehicleId: z.string().uuid("Please select a vehicle."),
    documentType: z.enum(DOCUMENT_TYPES, { message: "Please select a document type." }),
    customType: optionalText(200),
    referenceNumber: optionalText(200),
    provider: optionalText(200),
    issuedDate: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : null))
      .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Issued date is not a valid date." }),
    expiryDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Please enter a valid expiry date." }),
    // Optional — entered as a plain rupee decimal string ("5500.00") when
    // present, stored as cents. An empty field means "cost not recorded",
    // not zero.
    costMur: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : null))
      .refine((v) => v === null || (Number.isFinite(Number.parseFloat(v)) && Number.parseFloat(v) >= 0), {
        message: "Cost must be a valid rupee amount of 0 or more.",
      })
      .transform((v) => (v === null ? null : Math.round(Number.parseFloat(v) * 100))),
    remarks: optionalText(4000),
  })
  .refine((data) => data.documentType !== "other" || (data.customType && data.customType.length > 0), {
    message: "Please enter a custom document type when document type is Other.",
    path: ["customType"],
  })
  .refine((data) => data.issuedDate === null || data.issuedDate <= data.expiryDate, {
    message: "Issued date must be on or before the expiry date.",
    path: ["issuedDate"],
  });

export type ComplianceStatusFilter = "expired" | "expires_today" | "urgent" | "warning" | "valid";

export type ComplianceListFilters = {
  vehicleId: string | null;
  documentType: DocumentType | null;
  status: ComplianceStatusFilter | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
  page: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_FILTERS: readonly ComplianceStatusFilter[] = ["expired", "expires_today", "urgent", "warning", "valid"];

export function normalizeComplianceListFilters(params: {
  vehicleId?: string;
  documentType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: string;
}): ComplianceListFilters {
  const page = Number(params.page);
  const documentType = params.documentType;
  const status = params.status;
  return {
    vehicleId: params.vehicleId && UUID_RE.test(params.vehicleId) ? params.vehicleId : null,
    documentType: documentType && (DOCUMENT_TYPES as readonly string[]).includes(documentType) ? (documentType as DocumentType) : null,
    status: status && STATUS_FILTERS.includes(status as ComplianceStatusFilter) ? (status as ComplianceStatusFilter) : null,
    dateFrom: params.dateFrom && !Number.isNaN(Date.parse(params.dateFrom)) ? params.dateFrom : null,
    dateTo: params.dateTo && !Number.isNaN(Date.parse(params.dateTo)) ? params.dateTo : null,
    search: params.search && params.search.trim().length > 0 ? params.search.trim().slice(0, 200) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

// Strips characters with special meaning in a PostgREST `.or()` filter
// expression (comma separates conditions, parentheses group them) so a
// search term can't break out of the ilike conditions it's placed into.
// Duplicated from lib/maintenance/schema.ts rather than shared, so this
// module stays independent of the already-shipped Maintenance Records phase.
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").trim();
}

// Translates a status filter into the expiry_date range predicate that
// produces it, so the admin list can filter by status via an indexed range
// scan on expiry_date rather than fetching everything and filtering in
// application code. `today` is an ISO date string (YYYY-MM-DD).
export function statusFilterToExpiryRange(
  status: ComplianceStatusFilter,
  today: string
): { gte?: string; lte?: string; lt?: string } {
  const addDays = (days: number) => {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  switch (status) {
    case "expired":
      return { lt: today };
    case "expires_today":
      return { gte: today, lte: today };
    case "urgent":
      return { gte: addDays(1), lte: addDays(7) };
    case "warning":
      return { gte: addDays(8), lte: addDays(30) };
    case "valid":
      return { gte: addDays(31) };
  }
}
