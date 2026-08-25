import { z } from "zod";

/**
 * Validation for the admin/counter booking form.
 *
 * Deliberately looser than the public wizard in the places where a member of
 * staff legitimately knows better than a web form — a walk-in may have no
 * email, and a phone booking may not have licence details to hand yet — and
 * exactly as strict everywhere that feeds pricing or availability, because
 * those must behave identically on both channels.
 */

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Statuses a booking may legitimately start in when staff enter it directly. */
export const MANUAL_BOOKING_STATUSES = ["pending", "confirmed", "paid"] as const;
export type ManualBookingStatus = (typeof MANUAL_BOOKING_STATUSES)[number];

/**
 * Constrained to the values bookings.payment_method already accepts, rather
 * than widening the column for a counter-specific "cash"/"card" split — a
 * payment taken in person is recorded as pay_on_arrival here, and the exact
 * tender is captured on the payments row where it belongs.
 */
export const MANUAL_PAYMENT_METHODS = ["unpaid", "pay_on_arrival", "online", "bank_transfer"] as const;

export const MANUAL_PAYMENT_METHOD_LABELS: Record<(typeof MANUAL_PAYMENT_METHODS)[number], string> = {
  unpaid: "Not paid yet",
  pay_on_arrival: "Paid at counter / on collection",
  online: "Paid online",
  bank_transfer: "Bank transfer",
};

export const manualBookingSchema = z
  .object({
    vehicleId: z.uuid("Choose a vehicle"),
    pickupAt: z.string().regex(DATETIME_LOCAL, "Choose a pickup date and time"),
    returnAt: z.string().regex(DATETIME_LOCAL, "Choose a return date and time"),
    pickupLocationId: z.uuid("Choose a pickup location"),
    dropoffLocationId: z.uuid("Choose a drop-off location"),

    customerName: z.string().trim().min(2, "Enter the customer's name").max(120),
    customerEmail: z.string().trim().email("Enter a valid email").or(z.literal("")),
    customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
    customerCountry: z.string().trim().max(80).optional().or(z.literal("")),

    driverAge: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().int().min(16).max(99).optional()
    ),
    driverLicenceCountry: z.string().trim().max(80).optional().or(z.literal("")),
    driverLicenceIssueDate: z.string().optional().or(z.literal("")),

    passengers: z.preprocess((v) => Number(v || 1), z.number().int().min(1).max(9)),
    status: z.enum(MANUAL_BOOKING_STATUSES),
    paymentMethod: z.enum(MANUAL_PAYMENT_METHODS),
    paidAmount: z.string().optional().or(z.literal("")),
    internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((d) => new Date(d.returnAt) > new Date(d.pickupAt), {
    message: "The return must be after the pickup",
    path: ["returnAt"],
  });

export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

/**
 * Extras arrive as `extra:<uuid>` fields so an arbitrary number of them can
 * ride on the same FormData without a nested encoding.
 */
export function readManualBookingForm(formData: FormData): {
  fields: Record<string, unknown>;
  extras: Record<string, number>;
} {
  const fields: Record<string, unknown> = {};
  const extras: Record<string, number> = {};

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("extra:")) {
      const qty = Number(value);
      if (Number.isFinite(qty) && qty > 0) extras[key.slice("extra:".length)] = qty;
      continue;
    }
    if (key.startsWith("$ACTION")) continue;
    fields[key] = value;
  }

  return { fields, extras };
}
