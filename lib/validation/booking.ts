import { z } from "zod";

export const searchCriteriaSchema = z
  .object({
    category: z.string().optional(),
    vehicle: z.string().optional(),
    pickupLocation: z.string().min(1),
    dropoffLocation: z.string().min(1),
    pickup: z.iso.datetime({ local: true }).or(z.string().min(1)),
    return: z.iso.datetime({ local: true }).or(z.string().min(1)),
    passengers: z.coerce.number().int().min(1).max(9).default(1),
  })
  .refine((data) => new Date(data.pickup) > new Date(), {
    message: "Pickup date must be in the future",
    path: ["pickup"],
  })
  .refine((data) => new Date(data.return) > new Date(data.pickup), {
    message: "Return date must be after pickup date",
    path: ["return"],
  });

export const extrasSelectionSchema = z.record(z.string(), z.coerce.number().int().min(0).max(10));

export const driverDetailsSchema = z.object({
  age: z.coerce.number().int().min(18).max(99),
  licenceCountry: z.string().trim().min(1).max(100),
  licenceIssueDate: z.string().min(1),
});

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  phone: z.string().trim().min(1).max(50),
  whatsapp: z.string().trim().max(50).optional().or(z.literal("")),
  country: z.string().trim().min(1).max(100),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  passengers: z.coerce.number().int().min(1).max(9),
  driver: driverDetailsSchema,
  secondDriver: driverDetailsSchema.extend({ fullName: z.string().trim().min(1).max(200) }).optional(),
  flightNumber: z.string().trim().max(50).optional().or(z.literal("")),
  flightAirline: z.string().trim().max(100).optional().or(z.literal("")),
  flightArrivalDate: z.string().optional().or(z.literal("")),
  flightArrivalTime: z.string().optional().or(z.literal("")),
  specialRequests: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const policyAcceptanceSchema = z
  .object({
    generalConditions: z.boolean(),
    privacy: z.boolean(),
    cancellation: z.boolean(),
    insurance: z.boolean(),
  })
  .refine((data) => Object.values(data).every(Boolean), {
    message: "All policies must be accepted",
  });

export const paymentMethodSchema = z.enum(["online"]);

export const createBookingSchema = z.object({
  vehicleId: z.uuid(),
  categoryId: z.uuid(),
  pickupLocationId: z.uuid(),
  dropoffLocationId: z.uuid(),
  pickupAt: z.string().min(1),
  returnAt: z.string().min(1),
  extras: extrasSelectionSchema,
  customer: customerDetailsSchema,
  policyAcceptance: policyAcceptanceSchema,
  paymentMethod: paymentMethodSchema,
  idempotencyKey: z.string().min(1),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
