"use server";

import { randomBytes, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBookingPrice, daysBetween } from "@/lib/pricing/calculate";
import { resolveDailyRate } from "@/lib/pricing/tariff";
import { loadTariffPeriodsForVehicle, messageForUnavailableRate } from "@/lib/pricing/load-tariffs";
import { computeDeposit, type DepositTier } from "@/lib/pricing/deposit";
import { findNonEurBookingInput } from "@/lib/pricing/currency-guard";
import { createPayPalOrder, capturePayPalOrder, type PayPalCaptureResponse } from "@/lib/payments/paypal-client";
import { sendBookingReceivedEmails } from "@/lib/email/booking-received";
import { sendBookingConfirmedEmail } from "@/lib/email/booking-confirmed";
import { createNotification } from "@/lib/notifications/create";
import { canTransition } from "@/lib/booking/status-machine";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  isPubliclyBookable,
  parseBlockPeriod,
  publicVehicleFilter,
} from "@/lib/fleet/availability-rules";
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

  let query = publicVehicleFilter(
    supabase.from("vehicles").select("*, vehicle_images(*), vehicle_categories!inner(slug), is_staff_car, status")
  );

  if (criteria.categorySlug) {
    query = query.eq("vehicle_categories.slug", criteria.categorySlug);
  }
  if (criteria.vehicleSlug) {
    query = query.eq("slug", criteria.vehicleSlug);
  }

  // Three bulk reads, never one per vehicle. Statuses and periods are both
  // bounded by the requested window.
  const [{ data: vehicles, error: vehiclesError }, { data: conflictingBookings }, { data: conflictingBlocks }] =
    await Promise.all([
      query,
      supabase
        .from("bookings")
        .select("vehicle_id, status, pickup_at, return_at")
        .in("status", ACTIVE_BOOKING_STATUSES)
        .not("vehicle_id", "is", null)
        .lt("pickup_at", returnAt)
        .gt("return_at", pickupAt),
      supabase
        .from("vehicle_blocks")
        .select("vehicle_id, type, period")
        .filter("period", "ov", `[${pickupAt},${returnAt})`),
    ]);

  if (vehiclesError) {
    console.error("searchAvailableVehicles failed", vehiclesError.message);
    return [];
  }

  // Group the already-fetched conflicts by vehicle, then let the canonical
  // rule decide. isPubliclyBookable is the one definition of "sellable" the
  // board, the manual-booking pre-check and this search all share, so the
  // storefront cannot drift from the rest of the system the way it did when
  // this function re-derived availability on its own.
  const bookingsByVehicle = new Map<string, { status: string; start: string; end: string }[]>();
  for (const b of (conflictingBookings ?? []) as unknown as {
    vehicle_id: string;
    status: string;
    pickup_at: string;
    return_at: string;
  }[]) {
    const list = bookingsByVehicle.get(b.vehicle_id) ?? [];
    list.push({ status: b.status, start: b.pickup_at, end: b.return_at });
    bookingsByVehicle.set(b.vehicle_id, list);
  }

  const blocksByVehicle = new Map<string, { type: string; start: string; end: string }[]>();
  for (const b of (conflictingBlocks ?? []) as unknown as {
    vehicle_id: string;
    type: string;
    period: string;
  }[]) {
    const range = parseBlockPeriod(b.period);
    if (!range) continue;
    const list = blocksByVehicle.get(b.vehicle_id) ?? [];
    list.push({ type: b.type, start: range.startsAt.toISOString(), end: range.endsAt.toISOString() });
    blocksByVehicle.set(b.vehicle_id, list);
  }

  const window = { start: pickupAt, end: returnAt };
  const results = (vehicles ?? []) as unknown as (VehicleWithImages & {
    is_staff_car: boolean;
    status: string;
  })[];

  return results.filter((vehicle) =>
    isPubliclyBookable({
      vehicle: { status: vehicle.status, isStaffCar: vehicle.is_staff_car === true },
      window,
      bookings: bookingsByVehicle.get(vehicle.id) ?? [],
      blocks: blocksByVehicle.get(vehicle.id) ?? [],
    })
  );
}

export async function getExtras() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("extras")
    .select("*")
    .eq("active", true)
    .eq("currency", "EUR")
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
        .select("id, delivery_fee_cents, delivery_fee_currency")
        .in("id", [input.pickupLocationId, input.dropoffLocationId]),
      supabase.from("extras").select("*").in("id", Object.keys(input.extras)),
      supabase.from("site_settings").select("key, value").eq("key", "tax_rate_percent"),
    ]);

  if (!vehicle) return { ok: false, error: "Vehicle not found" };

  const pickupLocation = locations?.find((l) => l.id === input.pickupLocationId);
  const dropoffLocation = locations?.find((l) => l.id === input.dropoffLocationId);
  if (!pickupLocation || !dropoffLocation) return { ok: false, error: "Location not found" };

  // EUR invariant: every priced input to a new booking must be EUR — the
  // vehicle, both pickup/dropoff delivery fees (unless the fee is a
  // genuine, currency-agnostic zero), and every extra actually being added.
  // A single non-EUR input fails the whole quote rather than silently
  // computing a total that mixes currencies. This is defense in depth —
  // the public listings (getVehicles/getExtras/searchAvailableVehicles)
  // already filter non-EUR options out of what's offered — so this only
  // fires for a stale client state or a direct/forged request.
  const selectedExtras = (extrasRows ?? []).filter((e) => (input.extras[e.id] ?? 0) > 0);
  const currencyFailure = findNonEurBookingInput({
    vehicleCurrency: vehicle.currency,
    pickupLocation: { deliveryFeeCents: pickupLocation.delivery_fee_cents, deliveryFeeCurrency: pickupLocation.delivery_fee_currency },
    dropoffLocation: { deliveryFeeCents: dropoffLocation.delivery_fee_cents, deliveryFeeCurrency: dropoffLocation.delivery_fee_currency },
    selectedExtras: selectedExtras.map((e) => ({ currency: e.currency })),
  });
  if (currencyFailure === "vehicle") {
    return { ok: false, error: "This vehicle is not currently available for online booking." };
  }
  if (currencyFailure === "pickup_location" || currencyFailure === "dropoff_location") {
    return { ok: false, error: "Delivery from this location is not currently available online. Please contact us to arrange collection." };
  }
  if (currencyFailure === "extra") {
    return { ok: false, error: "One of the selected extras is not currently available online." };
  }

  const taxRatePercent = Number(settingsRows?.[0]?.value ?? 0);

  // Duration-tier tariff resolution. This is the ONE place a per-day rate is
  // decided; the public wizard, admin/manual booking, the stored pricing
  // snapshot, the deposit and the PayPal amount all descend from this call,
  // so a rate can never differ between the customer's quote and the office.
  const pickupAt = new Date(input.pickupAt);
  const returnAt = new Date(input.returnAt);
  const days = daysBetween(pickupAt, returnAt);

  const tariffPeriods = await loadTariffPeriodsForVehicle(supabase, vehicle.id, vehicle.category_id);
  const rate = resolveDailyRate({
    periods: tariffPeriods,
    pickupAt,
    days,
    vehicleId: vehicle.id,
    categoryId: vehicle.category_id,
    pickupLocationId: input.pickupLocationId,
    fallbackDailyPriceCents: vehicle.daily_price_cents,
  });

  if (!rate.available) {
    // A zero tier and a coverage gap both mean "do not sell this" — neither
    // may fall through to the old flat price.
    return { ok: false, error: messageForUnavailableRate(rate.reason) };
  }

  const breakdown = calculateBookingPrice({
    dailyPriceCents: rate.rateCents,
    currency: vehicle.currency,
    pickupAt,
    returnAt,
    rate: {
      dailyRateCents: rate.rateCents,
      source: rate.source,
      tariffPeriodId: rate.periodId,
      tariffPeriodLabel: rate.periodLabel,
      durationTier: rate.tier,
    },
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
  | { ok: true; bookingId: string; reference: string; accessToken: string; paymentMethod: string }
  | { ok: false; error: string };

export async function createBooking(input: CreateBookingInput & { locale: "en" | "fr" }): Promise<CreateBookingResult> {
  const rateLimit = await checkRateLimit("create_booking", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) {
    return { ok: false, error: "Too many booking attempts. Please wait a few minutes and try again." };
  }

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking data" };
  }
  const data = parsed.data;

  const supabase = createAdminClient();

  const [{ data: existing }, { data: vehicleEligibility }] = await Promise.all([
    supabase
      .from("bookings")
      .select("reference, access_token_hash")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle(),
    supabase.from("vehicles").select("is_staff_car, status").eq("id", data.vehicleId).maybeSingle(),
  ]);

  if (existing) {
    return { ok: false, error: "This booking has already been submitted." };
  }

  // Last line of defence on the customer funnel. searchAvailableVehicles and
  // the public listings already exclude staff cars and non-active vehicles,
  // so this only fires for a stale wizard state or a forged vehicleId — but
  // it is the insertion itself, and a staff car must never end up held by a
  // customer booking. Deliberately NOT enforced inside quoteBooking, which
  // admin manual booking also uses: assigning a staff car internally is a
  // legitimate operation, being sold one is not.
  if (!vehicleEligibility || vehicleEligibility.is_staff_car || vehicleEligibility.status !== "active") {
    return { ok: false, error: "This vehicle is not available for online booking." };
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

  // Snapshot what the deposit tiers/amounts looked like at the moment of
  // booking, for audit purposes only — this is never re-read to decide what
  // gets charged. The actual charge is always recomputed live (against
  // whatever settings are current) at the payment step and permanently
  // recorded in payment_transactions/payments once captured, so a later
  // admin settings change can never retroactively alter what a customer
  // actually paid; it can only be a discrepancy between this "as quoted"
  // snapshot and the live re-quote shown at payment time, which is exactly
  // what "server-authoritative, always current" is supposed to mean.
  const depositSettings = await getSiteSettings();
  const depositAtBooking = computeDeposit({
    totalCents: quote.breakdown.totalCents,
    currency: quote.breakdown.currency,
    depositThresholdEurCents: depositSettings.depositThresholdEurCents,
    depositMidTierMaxEurCents: depositSettings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: depositSettings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: depositSettings.depositHighTierAmountEurCents,
    legacyExchangeRate: depositSettings.eurExchangeRate,
  });

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
      currency: quote.breakdown.currency,
      pricing: {
        currency: quote.breakdown.currency,
        days: quote.breakdown.days,
        lineItems: quote.breakdown.lineItems,
        totalCents: quote.breakdown.totalCents,
        vehicleDepositCents: quote.breakdown.depositCents,
        depositQuoteAtBooking: {
          bookingTotalCents: depositAtBooking.bookingTotalCents,
          depositTier: depositAtBooking.depositTier,
          amountDueNowCents: depositAtBooking.amountDueNowCents,
          remainingBalanceCents: depositAtBooking.remainingBalanceCents,
          thresholdsUsed: {
            depositThresholdEurCents: depositSettings.depositThresholdEurCents,
            depositMidTierMaxEurCents: depositSettings.depositMidTierMaxEurCents,
            depositMidTierAmountEurCents: depositSettings.depositMidTierAmountEurCents,
            depositHighTierAmountEurCents: depositSettings.depositHighTierAmountEurCents,
          },
        },
      },
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

  const extraEntries = Object.entries(data.extras).filter(([, qty]) => qty > 0);

  // Independent writes/reads that all only need booking.id — parallelize
  // instead of paying for 4 sequential round trips.
  const [, , extrasRowsResult] = await Promise.all([
    supabase.from("booking_customers").insert({
      booking_id: booking.id,
      full_name: data.customer.fullName,
      email: data.customer.email,
      phone: data.customer.phone,
      whatsapp: data.customer.whatsapp || null,
      country: data.customer.country,
      address: data.customer.address || null,
    }),
    supabase.from("booking_drivers").insert(drivers),
    extraEntries.length > 0
      ? supabase.from("extras").select("*").in("id", extraEntries.map(([id]) => id))
      : Promise.resolve({ data: null }),
    supabase.from("booking_status_history").insert({
      booking_id: booking.id,
      old_status: null,
      new_status: initialStatus,
      customer_note: "Booking submitted by customer",
    }),
  ]);

  if (extraEntries.length > 0) {
    const extrasRows = extrasRowsResult.data;
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

  await createNotification(
    "new_booking",
    { reference: booking.reference, customerName: data.customer.fullName, vehicleName: vehicle.name },
    `/admin/bookings/${booking.id}`
  );

  await supabase.from("analytics_events").insert({ event: "booking_submitted", vehicle_id: data.vehicleId });

  return { ok: true, bookingId: booking.id, reference: booking.reference, accessToken, paymentMethod: data.paymentMethod };
}

function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type BookingDepositQuoteResult =
  | {
      ok: true;
      bookingTotalCents: number;
      currency: string;
      depositTier: DepositTier;
      amountDueNowCents: number;
      remainingBalanceCents: number;
      depositThresholdEurCents: number;
      depositMidTierMaxEurCents: number;
      depositMidTierAmountEurCents: number;
      depositHighTierAmountEurCents: number;
    }
  | { ok: false; error: string };

/**
 * Server-computed deposit amount for a just-created, still-unpaid booking.
 * The PayPal button must never trust a client-supplied amount — this is
 * what createOrder() is actually charging. Currency is read from the
 * booking's own `currency` column, never inferred from locale or the
 * vehicle (which may since have been re-priced).
 */
export async function getBookingDepositQuote(
  bookingId: string,
  accessToken: string
): Promise<BookingDepositQuoteResult> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, total_cents, paid_cents, status, currency, access_token_hash")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.access_token_hash !== hashAccessToken(accessToken)) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.paid_cents > 0) {
    return { ok: false, error: "This booking has already been paid." };
  }

  // getSiteSettings() is React.cache()-deduped per request, so this costs
  // nothing extra even though other actions in the same request also call it.
  const settings = await getSiteSettings();

  const deposit = computeDeposit({
    totalCents: booking.total_cents,
    currency: booking.currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });

  return {
    ok: true,
    bookingTotalCents: deposit.bookingTotalCents,
    currency: deposit.currency,
    depositTier: deposit.depositTier,
    amountDueNowCents: deposit.amountDueNowCents,
    remainingBalanceCents: deposit.remainingBalanceCents,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
  };
}

export type CreatePayPalOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

/**
 * Creates the PayPal order server-side, for a server-recomputed amount —
 * the browser never gets to choose what it's charged. Called from the
 * PayPal button's createOrder callback; the returned order id is what the
 * PayPal SDK renders the approval popup for.
 */
export async function createPayPalOrderForBooking(
  bookingId: string,
  accessToken: string
): Promise<CreatePayPalOrderResult> {
  const supabase = createAdminClient();

  const [{ data: booking }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, total_cents, paid_cents, currency, access_token_hash")
      .eq("id", bookingId)
      .maybeSingle(),
    getSiteSettings(),
  ]);

  if (!booking || booking.access_token_hash !== hashAccessToken(accessToken)) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.paid_cents > 0) {
    return { ok: false, error: "This booking has already been paid." };
  }

  const currentStatus = booking.status as Parameters<typeof canTransition>[0];
  if (!canTransition(currentStatus, "confirmed")) {
    return { ok: false, error: "This booking can no longer be paid online. Please contact support." };
  }

  const deposit = computeDeposit({
    totalCents: booking.total_cents,
    currency: booking.currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });

  let order: { id: string };
  try {
    order = await createPayPalOrder({
      amountEurCents: deposit.amountDueNowCents,
      bookingId: booking.id,
      bookingReference: booking.reference,
    });
  } catch (err) {
    console.error("createPayPalOrderForBooking: PayPal order creation failed", err);
    return { ok: false, error: "We couldn't start the PayPal payment. Please try again." };
  }

  const { error: insertError } = await supabase.from("payment_transactions").insert({
    booking_id: bookingId,
    provider: "paypal",
    provider_ref: order.id,
    amount_cents: deposit.amountDueNowCents,
    currency: "EUR",
    exchange_rate: booking.currency === "EUR" ? null : settings.eurExchangeRate,
    status: "created",
    idempotency_key: order.id,
  });
  if (insertError) {
    console.error("createPayPalOrderForBooking: failed to record payment_transactions row", insertError.message);
    return { ok: false, error: "We couldn't start the PayPal payment. Please try again." };
  }

  return { ok: true, orderId: order.id };
}

export type CaptureBookingPaymentResult = { ok: true } | { ok: false; error: string };

/**
 * Captures the PayPal order server-side and verifies the result before
 * trusting it: capture status, currency, amount (vs. the server's own
 * recomputed deposit, not anything the client reports), and that the order
 * was created for this exact booking (custom_id binding). Only on passing
 * every check does the booking move to "confirmed". The browser is never
 * the source of truth — it only tells the server which order id to look up.
 */
export async function captureBookingPayment(
  bookingId: string,
  accessToken: string,
  orderId: string,
  locale: "en" | "fr"
): Promise<CaptureBookingPaymentResult> {
  const supabase = createAdminClient();

  const [{ data: booking }, { data: transaction }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, total_cents, paid_cents, currency, vehicle_id, access_token_hash")
      .eq("id", bookingId)
      .maybeSingle(),
    supabase
      .from("payment_transactions")
      .select("id, status, amount_cents, exchange_rate")
      .eq("idempotency_key", orderId)
      .maybeSingle(),
  ]);

  if (!booking || booking.access_token_hash !== hashAccessToken(accessToken)) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.paid_cents > 0) {
    // Already processed (e.g. a duplicate onApprove call, or the webhook
    // beat us to it) — idempotent no-op.
    console.log("captureBookingPayment: duplicate capture ignored (booking already paid)", { bookingId, orderId });
    return { ok: true };
  }

  if (!transaction) {
    return { ok: false, error: "This payment session is invalid. Please start over." };
  }
  if (transaction.status === "succeeded") {
    // Already captured (e.g. via a duplicate call or the webhook) — no-op.
    console.log("captureBookingPayment: duplicate capture ignored (transaction already succeeded)", { bookingId, orderId });
    return { ok: true };
  }

  let capture: PayPalCaptureResponse;
  try {
    capture = await capturePayPalOrder(orderId);
  } catch (err) {
    console.error("captureBookingPayment: PayPal capture request failed", { bookingId, orderId, err });
    await supabase.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);
    return { ok: false, error: "We couldn't confirm your payment. Please contact support before retrying." };
  }

  const purchaseUnit = capture.purchase_units?.[0];
  const captureRecord = purchaseUnit?.payments?.captures?.[0];

  const verificationFailure = (reason: string) => {
    console.error("captureBookingPayment verification failed", { bookingId, orderId, reason });
    return reason;
  };

  let failureReason: string | null = null;
  if (capture.status !== "COMPLETED" || !captureRecord || captureRecord.status !== "COMPLETED") {
    failureReason = verificationFailure("capture_not_completed");
  } else if (purchaseUnit?.custom_id !== bookingId) {
    failureReason = verificationFailure("booking_reference_mismatch");
  } else if (captureRecord.amount.currency_code !== "EUR") {
    failureReason = verificationFailure("currency_mismatch");
  }

  const capturedAmountEurCents = captureRecord ? Math.round(parseFloat(captureRecord.amount.value) * 100) : 0;

  if (!failureReason && capturedAmountEurCents < transaction.amount_cents - 5) {
    failureReason = verificationFailure("amount_mismatch");
  }

  if (failureReason) {
    await supabase
      .from("payment_transactions")
      .update({ status: "denied", webhook_payload: capture })
      .eq("id", transaction.id);
    await createNotification(
      "payment_verification_failed",
      { reference: booking.reference, orderId, reason: failureReason },
      `/admin/bookings/${bookingId}`
    );
    return { ok: false, error: "The payment amount did not match the booking total. Please contact support." };
  }

  const currentStatus = booking.status as Parameters<typeof canTransition>[0];
  if (!canTransition(currentStatus, "confirmed")) {
    return { ok: false, error: "This booking can no longer be paid online. Please contact support." };
  }

  const [{ data: vehicle }, { data: customer }, settings] = await Promise.all([
    booking.vehicle_id
      ? supabase.from("vehicles").select("name").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("booking_customers").select("full_name").eq("booking_id", bookingId).maybeSingle(),
    getSiteSettings(),
  ]);
  const deposit = computeDeposit({
    totalCents: booking.total_cents,
    currency: booking.currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });
  const payerEmail = capture.payer?.email_address ?? null;

  await supabase
    .from("payment_transactions")
    .update({
      status: "succeeded",
      capture_id: captureRecord!.id,
      webhook_payload: capture,
    })
    .eq("id", transaction.id);

  const { error: paymentInsertError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    method: "online",
    amount_cents: deposit.depositCents,
    currency: booking.currency,
    status: "recorded",
    note: `PayPal order ${orderId}${payerEmail ? ` (${payerEmail})` : ""}`,
    paid_at: new Date().toISOString(),
  });
  if (paymentInsertError) {
    console.error("captureBookingPayment: failed to record payments row (database write failure)", {
      bookingId,
      orderId,
      error: paymentInsertError.message,
    });
  }

  const { error: bookingUpdateError } = await supabase
    .from("bookings")
    .update({ paid_cents: booking.paid_cents + deposit.depositCents, status: "confirmed" })
    .eq("id", bookingId);
  if (bookingUpdateError) {
    console.error("captureBookingPayment: failed to update booking to confirmed (database write failure)", {
      bookingId,
      orderId,
      error: bookingUpdateError.message,
    });
  }

  await supabase.from("booking_status_history").insert({
    booking_id: bookingId,
    old_status: currentStatus,
    new_status: "confirmed",
    customer_note: "Payment received via PayPal",
  });

  await sendBookingConfirmedEmail(bookingId, locale);

  await createNotification(
    "online_payment_received",
    { reference: booking.reference, customerName: customer?.full_name ?? "", vehicleName: vehicle?.name ?? "" },
    `/admin/bookings/${bookingId}`
  );

  await supabase.from("analytics_events").insert({ event: "booking_paid", vehicle_id: booking.vehicle_id });

  return { ok: true };
}
