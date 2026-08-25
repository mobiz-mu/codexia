"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteBooking } from "@/lib/actions/booking";
import { computeDeposit } from "@/lib/pricing/deposit";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { OPS_STATUS, opsStatusForBlock } from "@/lib/fleet/status-config";
import { businessDay, businessTime } from "@/lib/fleet/movements";
import { manualBookingSchema, readManualBookingForm } from "@/lib/booking/manual-schema";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

/** Statuses that hold a vehicle. Terminal states release it and must not block. */
const HOLDING_STATUSES = [
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
] as const;

export type AvailabilityConflict = {
  kind: "booking" | "block";
  label: string;
  detail: string;
  from: string;
  to: string;
};

/**
 * Conflict windows are shown in Mauritius time, not UTC. The operator typed
 * "09:00" into the form; telling them the clash runs from "05:00" would look
 * like a different booking entirely.
 */
function fmt(iso: string) {
  return `${businessDay(iso)} ${businessTime(iso)}`;
}

/**
 * Explain, in advance, why a vehicle cannot be booked for a window.
 *
 * The database exclusion constraints are the real guarantee and still run on
 * insert — this exists so the operator is told *which* booking or block is in
 * the way and for which dates, instead of being handed a bare rejection.
 */
export async function findAvailabilityConflicts(
  vehicleId: string,
  pickupAt: string,
  returnAt: string
): Promise<AvailabilityConflict[]> {
  const supabase = createAdminClient();
  const startIso = new Date(pickupAt).toISOString();
  const endIso = new Date(returnAt).toISOString();

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, pickup_at, return_at, booking_customers(full_name)")
      .eq("vehicle_id", vehicleId)
      .in("status", HOLDING_STATUSES)
      .lt("pickup_at", endIso)
      .gt("return_at", startIso),
    supabase
      .from("vehicle_blocks")
      .select("id, type, note, period")
      .eq("vehicle_id", vehicleId)
      .filter("period", "ov", `[${startIso},${endIso})`),
  ]);

  const conflicts: AvailabilityConflict[] = [];

  for (const b of (bookings ?? []) as unknown as {
    reference: string;
    status: string;
    pickup_at: string;
    return_at: string;
    booking_customers: { full_name: string } | { full_name: string }[] | null;
  }[]) {
    const customer = Array.isArray(b.booking_customers)
      ? b.booking_customers[0]?.full_name
      : b.booking_customers?.full_name;
    conflicts.push({
      kind: "booking",
      label: `Booking ${b.reference}`,
      detail: customer ? `${customer} · ${b.status.replace(/_/g, " ")}` : b.status.replace(/_/g, " "),
      from: fmt(b.pickup_at),
      to: fmt(b.return_at),
    });
  }

  for (const bl of blocks ?? []) {
    const match = /\[([^,]+),([^)]+)\)/.exec(bl.period as unknown as string);
    conflicts.push({
      kind: "block",
      label: OPS_STATUS[opsStatusForBlock(bl.type)].label,
      detail: bl.note ?? "Vehicle unavailable",
      from: fmt(match?.[1] ?? startIso),
      to: fmt(match?.[2] ?? endIso),
    });
  }

  return conflicts;
}

export type ManualBookingState = {
  status: "idle" | "success" | "error";
  error?: string;
  conflicts?: AvailabilityConflict[];
  bookingId?: string;
  reference?: string;
};

export async function createManualBooking(
  _prev: ManualBookingState,
  formData: FormData
): Promise<ManualBookingState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const { fields, extras } = readManualBookingForm(formData);
  const parsed = manualBookingSchema.safeParse(fields);
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }
  const d = parsed.data;

  const supabase = createAdminClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, category_id, is_staff_car, status")
    .eq("id", d.vehicleId)
    .maybeSingle();
  if (!vehicle) return { status: "error", error: "That vehicle no longer exists." };

  const pickupIso = new Date(d.pickupAt).toISOString();
  const returnIso = new Date(d.returnAt).toISOString();

  // Explain a clash before attempting the insert. The exclusion constraint
  // below is still the guarantee; this is what makes the refusal actionable.
  const conflicts = await findAvailabilityConflicts(d.vehicleId, pickupIso, returnIso);
  if (conflicts.length > 0) {
    return {
      status: "error",
      error: "This vehicle is not available for those dates.",
      conflicts,
    };
  }

  // Same resolver as the public wizard — identical inputs must produce an
  // identical price, so admin never quietly undercuts or overcharges.
  const quote = await quoteBooking({
    vehicleId: d.vehicleId,
    pickupLocationId: d.pickupLocationId,
    dropoffLocationId: d.dropoffLocationId,
    pickupAt: pickupIso,
    returnAt: returnIso,
    extras,
  });
  if (!quote.ok) return { status: "error", error: quote.error };

  const settings = await getSiteSettings();
  const depositAtBooking = computeDeposit({
    totalCents: quote.breakdown.totalCents,
    currency: quote.breakdown.currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });

  const paidCents = (() => {
    const raw = String(d.paidAmount ?? "").trim().replace(",", ".");
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(Math.round(value * 100), quote.breakdown.totalCents);
  })();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      vehicle_id: d.vehicleId,
      category_id: vehicle.category_id,
      pickup_at: pickupIso,
      return_at: returnIso,
      pickup_location_id: d.pickupLocationId,
      dropoff_location_id: d.dropoffLocationId,
      status: d.status,
      source: "admin",
      currency: quote.breakdown.currency,
      pricing: {
        currency: quote.breakdown.currency,
        days: quote.breakdown.days,
        lineItems: quote.breakdown.lineItems,
        totalCents: quote.breakdown.totalCents,
        vehicleDepositCents: quote.breakdown.depositCents,
        rate: quote.breakdown.rate ?? null,
        depositQuoteAtBooking: {
          bookingTotalCents: depositAtBooking.bookingTotalCents,
          depositTier: depositAtBooking.depositTier,
          amountDueNowCents: depositAtBooking.amountDueNowCents,
          remainingBalanceCents: depositAtBooking.remainingBalanceCents,
        },
      },
      total_cents: quote.breakdown.totalCents,
      paid_cents: paidCents,
      passengers: d.passengers,
      special_requests: null,
      internal_notes: d.internalNotes || null,
      payment_method: d.paymentMethod === "unpaid" ? null : d.paymentMethod,
    })
    .select("id, reference")
    .single();

  if (error) {
    if (error.code === "23P01") {
      // Something was booked between the pre-check and the insert.
      const late = await findAvailabilityConflicts(d.vehicleId, pickupIso, returnIso);
      return {
        status: "error",
        error: "This vehicle was taken for those dates a moment ago.",
        conflicts: late,
      };
    }
    console.error("createManualBooking failed", error.message);
    return { status: "error", error: "Could not create the booking. Please try again." };
  }

  const childWrites: PromiseLike<unknown>[] = [
    supabase.from("booking_customers").insert({
      booking_id: booking.id,
      full_name: d.customerName,
      email: d.customerEmail || `no-email+${booking.reference}@codexia.mu`,
      phone: d.customerPhone || "",
      country: d.customerCountry || "",
    }),
    supabase.from("booking_status_history").insert({
      booking_id: booking.id,
      old_status: null,
      new_status: d.status,
      actor_id: user.id,
      internal_note: "Created at the counter (manual booking)",
    }),
  ];

  if (d.driverAge) {
    childWrites.push(
      supabase.from("booking_drivers").insert({
        booking_id: booking.id,
        is_primary: true,
        full_name: d.customerName,
        age: d.driverAge,
        licence_country: d.driverLicenceCountry || "",
        licence_issue_date: d.driverLicenceIssueDate || undefined,
      })
    );
  }

  const extraIds = Object.keys(extras);
  if (extraIds.length > 0) {
    const { data: extraRows } = await supabase
      .from("extras")
      .select("id, price_cents, pricing_mode")
      .in("id", extraIds);
    if (extraRows?.length) {
      childWrites.push(
        supabase.from("booking_extras").insert(
          extraRows.map((e) => ({
            booking_id: booking.id,
            extra_id: e.id,
            quantity: extras[e.id],
            unit_price_cents: e.price_cents,
            pricing_mode: e.pricing_mode,
          }))
        )
      );
    }
  }

  await Promise.all(childWrites);

  revalidatePath("/admin/availability");
  revalidatePath("/admin/bookings");

  return { status: "success", bookingId: booking.id, reference: booking.reference };
}

/** Everything the manual booking form needs, in one round of parallel reads. */
export async function getManualBookingFormData() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();
  const [{ data: vehicles }, { data: locations }, { data: extras }, { data: categories }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, name, brand, model, transmission, internal_registration_ref, category_id, is_staff_car, daily_price_cents")
      .neq("status", "archived")
      .order("name"),
    supabase.from("locations").select("id, name_en").order("display_order"),
    supabase.from("extras").select("id, name_en, price_cents, pricing_mode").eq("active", true).order("display_order"),
    supabase.from("vehicle_categories").select("id, name_en").order("display_order"),
  ]);

  return {
    vehicles: vehicles ?? [],
    locations: locations ?? [],
    extras: extras ?? [],
    categories: categories ?? [],
  };
}
