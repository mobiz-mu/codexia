import { z } from "zod";

/**
 * Validation for the tariff admin form.
 *
 * Rates arrive as euro strings from the form ("22.00") and are stored as
 * integer cents — money never becomes a float. An empty box means zero,
 * which in this system means "this duration is not sold in this period"
 * rather than "free"; the form makes that explicit to the operator.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "22.00" | "22" | "22,00" | "" -> integer cents. */
export function parseEuroToCents(input: unknown): number | null {
  if (input === null || input === undefined) return 0;
  const raw = String(input).trim().replace(",", ".");
  if (raw === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatCentsToEuro(cents: number): string {
  return (cents / 100).toFixed(2);
}

const rateField = z.preprocess((v) => parseEuroToCents(v), z.number().int().min(0).nullable()).refine(
  (v) => v !== null,
  { message: "Enter an amount like 22.00" }
);

export const tariffPeriodSchema = z
  .object({
    scope: z.enum(["vehicle", "category"]),
    vehicleId: z.string().uuid().optional().or(z.literal("")),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    label: z.string().trim().max(120).optional().or(z.literal("")),
    effectiveFrom: z.string().regex(DATE, "Enter a valid start date"),
    effectiveTo: z.string().regex(DATE, "Enter a valid end date"),
    rate1DayCents: rateField,
    rate3DayCents: rateField,
    rate4DayCents: rateField,
    rate7DayCents: rateField,
    rate14DayCents: rateField,
    rate21PlusDayCents: rateField,
    active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    locationIds: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => d.effectiveTo >= d.effectiveFrom, {
    message: "The end date must not be before the start date",
    path: ["effectiveTo"],
  })
  .refine((d) => (d.scope === "vehicle" ? Boolean(d.vehicleId) : Boolean(d.categoryId)), {
    message: "Choose what this tariff applies to",
    path: ["scope"],
  })
  .refine(
    (d) =>
      [
        d.rate1DayCents,
        d.rate3DayCents,
        d.rate4DayCents,
        d.rate7DayCents,
        d.rate14DayCents,
        d.rate21PlusDayCents,
      ].some((r) => (r ?? 0) > 0),
    {
      // All six at zero would publish a period that sells nothing at any
      // length — almost certainly a mistake, and indistinguishable at a
      // glance from a period that simply has not been filled in.
      message: "At least one duration must have a rate, otherwise this period sells nothing",
      path: ["rate1DayCents"],
    }
  );

export type TariffPeriodInput = z.infer<typeof tariffPeriodSchema>;

/** Read the repeated `locationIds` checkboxes out of a FormData payload. */
export function readTariffFormData(formData: FormData): Record<string, unknown> {
  const entries = Object.fromEntries(formData) as Record<string, unknown>;
  return { ...entries, locationIds: formData.getAll("locationIds").map(String).filter(Boolean) };
}
