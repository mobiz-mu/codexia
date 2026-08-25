import { z } from "zod";

import { mlFromLitres, totalCostCents } from "./fuel";

/**
 * Validation for a fuel fill.
 *
 * Litres and money are parsed from decimal strings exactly once and converted
 * straight to integers — millilitres and MUR minor units — so nothing
 * downstream ever performs float arithmetic on a volume or a price.
 */

const decimal = (label: string, maxDp: number) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => new RegExp(`^\\d+(\\.\\d{0,${maxDp}})?$`).test(v), {
      message: `${label} must be a number, for example ${maxDp === 2 ? "45.67" : "45.6"}.`,
    });

export const fuelRecordSchema = z
  .object({
    vehicleId: z.uuid("Choose a vehicle"),
    filledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date of the fill"),
    odometerKm: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v), { message: "Odometer must be a whole number of kilometres." })
      .transform((v) => Number(v)),
    litres: decimal("Litres", 2).transform((v) => mlFromLitres(Number(v))),
    pricePerLitre: decimal("Price per litre", 2)
      .optional()
      .transform((v) => (v ? Math.round(Number(v) * 100) : 0)),
    totalCost: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(",", ".") : ""))
      .refine((v) => v === "" || /^\d+(\.\d{0,2})?$/.test(v), {
        message: "Total cost must be a rupee amount, for example 2600.00.",
      })
      .transform((v) => (v === "" ? null : Math.round(Number(v) * 100))),
    station: z.string().trim().max(160).optional().or(z.literal("")),
    driverName: z.string().trim().max(160).optional().or(z.literal("")),
    fullTank: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    receiptReference: z.string().trim().max(120).optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((d) => d.litres > 0, { message: "Litres must be more than zero.", path: ["litres"] })
  .refine((d) => d.totalCost !== null || d.pricePerLitre > 0, {
    // One of the two must be present, otherwise the fill has no cost at all
    // and the monthly spend figure would quietly under-report.
    message: "Enter either a price per litre or a total cost.",
    path: ["totalCost"],
  });

export type FuelRecordInputParsed = z.infer<typeof fuelRecordSchema>;

/**
 * The stored total: an explicit total wins, otherwise it is derived from
 * litres and unit price. Deriving is preferred over trusting a hand-typed
 * total that disagrees with the pump.
 */
export function resolveTotalCostCents(d: { totalCost: number | null; litres: number; pricePerLitre: number }): number {
  if (d.totalCost !== null) return d.totalCost;
  return totalCostCents(d.litres, d.pricePerLitre);
}
