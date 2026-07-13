"use server";

import { randomBytes, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBookingPrice } from "@/lib/pricing/calculate";
import { sendBookingReceivedEmails } from "@/lib/email/booking-received";
import {
  createBookingSchema,
  type CreateBookingInput,
} from "@/lib/validation/booking";
import type { VehicleWithImages } from "@/lib/data/vehicles";

const ACTIVE_BOOKING_STATUSES = [
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

export async function searchAvailableVehicles(criteria: {
  categorySlug?: string;
  vehicleSlug?: string;
  pickupAt: string;
  returnAt: string;
}): Promise<VehicleWithImages[]> {
  const supabase = createAdminClient();
  const pickupAt = new Date(criteria.pickupAt).toISOString();
  const returnAt = new Date(criteria.returnAt).toISOString();

  let query = supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_categories!inner(slug)")
    .eq("status", "active");

  if (criteria.categorySlug) {
    query = query.eq("vehicle_categories.slug", criteria.categorySlug);
  }
  if (criteria.vehicleSlug) {
    query = query.eq("slug", criteria.vehicleSlug);
  }

  const [{ data: vehicles, error: vehiclesError }, { data: conflictingBookings }, { data: conflictingBlocks }] =
    await Promise.all([
      query,
      supabase
        .from("bookings")
        .select("vehicle_id")
        .in("status", ACTIVE_BOOKING_STATUSES)
        .not("vehicle_id", "is", null)
        .lt("pickup_at", returnAt)
        .gt("return_at", pickupAt),
      supabase
        .from("vehicle_blocks")
        .select("vehicle_id")
        .filter("period", "ov", `[${pickupAt},${returnAt})`),
    ]);

  if (vehiclesError) {
    console.error("searchAvailableVehicles failed", vehiclesError.message);
    return [];
  }

  const unavailableIds = new Set([
    ...(conflictingBookings ?? []).map((b) => b.vehicle_id as string),
    ...(conflictingBlocks ?? []).map((b) => b.vehicle_id as string),
  ]);

  const results = (vehicles ?? []) as unknown as VehicleWithImages[];
  return results.filter((v) => !unavailableIds.has(v.id));
}

export async function getExtras() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("extras")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getExtras failed", error.message);
    return [];
  }
  return data ?? [];
}

export type BookingQuoteResult =
  | { ok: true; breakdown: ReturnType<typeof calculateBookingPrice>; vehicle: Record<string, unknown> }
  | { ok: false; error: string };

export async function quoteBooking(input: {
  vehicleId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  pickupAt: string;
  returnAt: string;
  extras: Record<string, number>;
}): Promise<BookingQuoteResult> {
  const supabase = createAdminClient();

  const [{ data: vehicle }, { data: locations }, { data: extrasRows }, { data: settingsRows }] =
    await Promise.all([
      supabase.from("vehicles").select("*").eq("id", input.vehicleId).maybeSingle(),
      supabase
        .from("locations")
        .select("id, delivery_fee_cents")
        .in("id", [input.pickupLocationId, input.dropoffLocationId]),
      supabase.from("extras").select("*").in("id", Object.keys(input.extras)),
      supabase.from("site_settings").select("key, value").eq("key", "tax_rate_percent"),
    ]);

  if (!vehicle) return { ok: false, error: "Vehicle not found" };

  const pickupLocation = locations?.find((l) => l.id === input.pickupLocationId);
  const dropoffLocation = locations?.find((l) => l.id === input.dropoffLocationId);
  if (!pickupLocation || !dropoffLocation) return { ok: false, error: "Location not found" };

  const taxRatePercent = Number(settingsRows?.[0]?.value ?? 0);

  const breakdown = calculateBookingPrice({
    dailyPriceCents: vehicle.daily_price_cents,
    currency: vehicle.currency,
    pickupAt: new Date(input.pickupAt),
    returnAt: new Date(input.returnAt),
    pickupDeliveryFeeCents: pickupLocation.delivery_fee_cents,
    dropoffDeliveryFeeCents: dropoffLocation.delivery_fee_cents,
    depositCents: vehicle.deposit_cents,
    taxRatePercent,
    extras: (extrasRows ?? []).map((e) => ({
      nameEn: e.name_en,
      priceCents: e.price_cents,
      pricingMode: e.pricing_mode,
      quantity: input.extras[e.id] ?? 0,
    })),
  });

  return { ok: true, breakdown, vehicle };
}

export type CreateBookingResult =
  | { ok: true; reference: string; accessToken: string; paymentMethod: string }
  | { ok: false; error: string };

export async function createBooking(input: CreateBookingInput & { locale: "en" | "fr" }): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking data" };
  }
  const data = parsed.data;

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("bookings")
    .select("reference, access_token_hash")
    .eq("idempotency_key", data.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "This booking has already been submitted." };
  }

  const quote = await quoteBooking({
    vehicleId: data.vehicleId,
    pickupLocationId: data.pickupLocationId,
    dropoffLocationId: data.dropoffLocationId,
    pickupAt: data.pickupAt,
    returnAt: data.returnAt,
    extras: data.extras,
  });
  if (!quote.ok) return { ok: false, error: quote.error };

  const accessToken = randomBytes(24).toString("base64url");
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");

  const initialStatus = "pending";

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      vehicle_id: data.vehicleId,
      category_id: data.categoryId,
      pickup_at: data.pickupAt,
      return_at: data.returnAt,
      pickup_location_id: data.pickupLocationId,
      dropoff_location_id: data.dropoffLocationId,
      status: initialStatus,
      pricing: { lineItems: quote.breakdown.lineItems },
      total_cents: quote.breakdown.totalCents,
      paid_cents: 0,
      passengers: data.customer.passengers,
      flight_number: data.customer.flightNumber || null,
      flight_airline: data.customer.flightAirline || null,
      flight_arrival_date: data.customer.flightArrivalDate || null,
      flight_arrival_time: data.customer.flightArrivalTime || null,
      special_requests: data.customer.specialRequests || null,
      policy_acceptance: data.policyAcceptance,
      accepted_at: new Date().toISOString(),
      access_token_hash: accessTokenHash,
      idempotency_key: data.idempotencyKey,
      payment_method: data.paymentMethod,
    })
    .select("id, reference")
    .single();

  if (bookingError) {
    if (bookingError.code === "23P01") {
      return { ok: false, error: "This vehicle was just booked for these dates. Please choose another vehicle or dates." };
    }
    console.error("createBooking failed", bookingError.message);
    return { ok: false, error: "Something went wrong creating your booking. Please try again." };
  }

  await supabase.from("booking_customers").insert({
    booking_id: booking.id,
    full_name: data.customer.fullName,
    email: data.customer.email,
    phone: data.customer.phone,
    whatsapp: data.customer.whatsapp || null,
    country: data.customer.country,
    address: data.customer.address || null,
  });

  const drivers = [
    {
      booking_id: booking.id,
      is_primary: true,
      full_name: data.customer.fullName,
      age: data.customer.driver.age,
      licence_country: data.customer.driver.licenceCountry,
      licence_issue_date: data.customer.driver.licenceIssueDate,
    },
    ...(data.customer.secondDriver
      ? [
          {
            booking_id: booking.id,
            is_primary: false,
            full_name: data.customer.secondDriver.fullName,
            age: data.customer.secondDriver.age,
            licence_country: data.customer.secondDriver.licenceCountry,
            licence_issue_date: data.customer.secondDriver.licenceIssueDate,
          },
        ]
      : []),
  ];
  await supabase.from("booking_drivers").insert(drivers);

  const extraEntries = Object.entries(data.extras).filter(([, qty]) => qty > 0);
  if (extraEntries.length > 0) {
    const { data: extrasRows } = await supabase
      .from("extras")
      .select("*")
      .in("id", extraEntries.map(([id]) => id));

    const bookingExtras = extraEntries.map(([extraId, quantity]) => {
      const extra = extrasRows?.find((e) => e.id === extraId);
      return {
        booking_id: booking.id,
        extra_id: extraId,
        quantity,
        unit_price_cents: extra?.price_cents ?? 0,
        pricing_mode: extra?.pricing_mode ?? "flat",
      };
    });
    await supabase.from("booking_extras").insert(bookingExtras);
  }

  await supabase.from("booking_status_history").insert({
    booking_id: booking.id,
    old_status: null,
    new_status: initialStatus,
    customer_note: "Booking submitted by customer",
  });

  const vehicle = quote.vehicle as { name: string; currency: string };
  const [{ data: pickupLoc }, { data: dropoffLoc }] = await Promise.all([
    supabase.from("locations").select("name_en, name_fr").eq("id", data.pickupLocationId).single(),
    supabase.from("locations").select("name_en, name_fr").eq("id", data.dropoffLocationId).single(),
  ]);

  await sendBookingReceivedEmails({
    locale: input.locale,
    bookingId: booking.id,
    reference: booking.reference,
    customerName: data.customer.fullName,
    customerEmail: data.customer.email,
    vehicleName: vehicle.name,
    pickupLocationName: input.locale === "fr" ? pickupLoc?.name_fr ?? "" : pickupLoc?.name_en ?? "",
    dropoffLocationName: input.locale === "fr" ? dropoffLoc?.name_fr ?? "" : dropoffLoc?.name_en ?? "",
    pickupAt: new Date(data.pickupAt),
    returnAt: new Date(data.returnAt),
    paymentMethod: data.paymentMethod,
    totalCents: quote.breakdown.totalCents,
    currency: vehicle.currency,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    accessToken,
  });

  return { ok: true, reference: booking.reference, accessToken, paymentMethod: data.paymentMethod };
}
