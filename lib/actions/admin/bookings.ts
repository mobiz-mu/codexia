"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { canTransition, type BookingStatus } from "@/lib/booking/status-machine";
import type { Database } from "@/lib/supabase/types";

type BookingStatusColumn = Database["public"]["Tables"]["bookings"]["Row"]["status"];
import { sendBookingConfirmedEmail } from "@/lib/email/booking-confirmed";
import { sendBookingReceivedEmails } from "@/lib/email/booking-received";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listBookings(filters?: { status?: string; search?: string }) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();
  let query = supabase
    .from("bookings")
    .select("*, vehicles(name), booking_customers(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters?.status) {
    query = query.eq("status", filters.status as BookingStatusColumn);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listBookings failed", error.message);
    return [];
  }

  type Row = {
    id: string;
    reference: string;
    status: string;
    total_cents: number;
    pickup_at: string;
    return_at: string;
    created_at: string;
    vehicles: { name: string } | null;
    booking_customers: { full_name: string; email: string } | null;
  };

  let rows = (data ?? []) as unknown as Row[];

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(term) ||
        r.booking_customers?.full_name.toLowerCase().includes(term) ||
        r.booking_customers?.email.toLowerCase().includes(term)
    );
  }

  return rows;
}

export async function getBookingDetail(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!booking) return null;

  const [
    { data: customer },
    { data: drivers },
    { data: extras },
    { data: statusHistory },
    { data: proofs },
    { data: vehicle },
    { data: pickupLoc },
    { data: dropoffLoc },
    { data: vehicles },
  ] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", id).maybeSingle(),
    supabase.from("booking_drivers").select("*").eq("booking_id", id),
    supabase.from("booking_extras").select("*, extras(name_en)").eq("booking_id", id),
    supabase.from("booking_status_history").select("*").eq("booking_id", id).order("at", { ascending: false }),
    supabase.from("payment_proofs").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
    booking.vehicle_id
      ? supabase.from("vehicles").select("*").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
    supabase.from("vehicles").select("id, name, status").eq("category_id", booking.category_id).eq("status", "active"),
  ]);

  return {
    booking,
    customer,
    drivers: drivers ?? [],
    extras: (extras ?? []) as unknown as { id: string; quantity: number; unit_price_cents: number; extras: { name_en: string } | null }[],
    statusHistory: statusHistory ?? [],
    proofs: proofs ?? [],
    vehicle,
    pickupLoc,
    dropoffLoc,
    availableVehiclesInCategory: vehicles ?? [],
  };
}

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

export async function updateBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  note: string,
  locale: "en" | "fr" = "en"
): Promise<UpdateStatusResult> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };

  const currentStatus = booking.status as BookingStatus;
  if (!canTransition(currentStatus, newStatus)) {
    return { ok: false, error: `Cannot move a booking from "${currentStatus}" to "${newStatus}".` };
  }

  const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", bookingId);
  if (error) {
    console.error("updateBookingStatus failed", error.message);
    return { ok: false, error: "Failed to update status." };
  }

  await supabase.from("booking_status_history").insert({
    booking_id: bookingId,
    old_status: currentStatus,
    new_status: newStatus,
    actor_id: user.id,
    internal_note: note || null,
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "booking_status_change",
    entity: "bookings",
    entity_id: bookingId,
    diff: { from: currentStatus, to: newStatus },
  });

  if (newStatus === "confirmed") {
    await sendBookingConfirmedEmail(bookingId, locale);
  }

  return { ok: true };
}

export async function reassignVehicle(bookingId: string, vehicleId: string): Promise<UpdateStatusResult> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();
  const { error } = await supabase.from("bookings").update({ vehicle_id: vehicleId }).eq("id", bookingId);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "That vehicle is already booked for these dates." };
    }
    console.error("reassignVehicle failed", error.message);
    return { ok: false, error: "Failed to reassign vehicle." };
  }

  await supabase.from("booking_status_history").insert({
    booking_id: bookingId,
    old_status: null,
    new_status: "vehicle_assigned",
    actor_id: user.id,
    internal_note: "Vehicle reassigned",
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "booking_vehicle_reassigned",
    entity: "bookings",
    entity_id: bookingId,
    diff: { vehicle_id: vehicleId },
  });

  return { ok: true };
}

export async function resendBookingEmail(
  bookingId: string,
  type: "received" | "confirmed",
  locale: "en" | "fr" = "en"
): Promise<UpdateStatusResult> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_bookings");

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };

  if (type === "confirmed") {
    await sendBookingConfirmedEmail(bookingId, locale);
    return { ok: true };
  }

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, { data: dropoffLoc }] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", bookingId).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name, currency").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
  ]);

  if (!customer) return { ok: false, error: "Customer details not found" };

  // access token was only ever stored hashed, so resending Email 1 needs a
  // fresh token+link just like Email 2 does.
  const { randomBytes, createHash } = await import("crypto");
  const accessToken = randomBytes(24).toString("base64url");
  await supabase
    .from("bookings")
    .update({ access_token_hash: createHash("sha256").update(accessToken).digest("hex") })
    .eq("id", bookingId);

  await sendBookingReceivedEmails({
    locale,
    bookingId,
    reference: booking.reference,
    customerName: customer.full_name,
    customerEmail: customer.email,
    vehicleName: vehicle?.name ?? "",
    pickupLocationName: locale === "fr" ? pickupLoc?.name_fr ?? "" : pickupLoc?.name_en ?? "",
    dropoffLocationName: locale === "fr" ? dropoffLoc?.name_fr ?? "" : dropoffLoc?.name_en ?? "",
    pickupAt: new Date(booking.pickup_at),
    returnAt: new Date(booking.return_at),
    paymentMethod: booking.payment_method ?? "bank_transfer",
    totalCents: booking.total_cents,
    currency: vehicle?.currency ?? "EUR",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    accessToken,
  });

  return { ok: true };
}
