"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import BookingLinkEmail from "@/emails/BookingLink";
import { SITE_DEFAULTS } from "@/lib/config/site";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getBookingByToken(token: string) {
  const supabase = createAdminClient();
  const tokenHash = hashToken(token);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error || !booking) return null;

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, { data: dropoffLoc }, { data: proofs }] =
    await Promise.all([
      supabase.from("booking_customers").select("*").eq("booking_id", booking.id).maybeSingle(),
      booking.vehicle_id
        ? supabase.from("vehicles").select("name, slug").eq("id", booking.vehicle_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
      supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
      supabase
        .from("payment_proofs")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false }),
    ]);

  return { booking, customer, vehicle, pickupLoc, dropoffLoc, proofs: proofs ?? [] };
}

const resendSchema = z.object({ email: z.email() });

export type ResendLinkState = { status: "idle" | "sent" | "error" };

export async function resendBookingLink(
  _prev: ResendLinkState,
  formData: FormData
): Promise<ResendLinkState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error" };

  const supabase = createAdminClient();

  const { data: customerRows } = await supabase
    .from("booking_customers")
    .select("booking_id")
    .eq("email", parsed.data.email);

  if (customerRows && customerRows.length > 0) {
    const mostRecentBookingId = customerRows[customerRows.length - 1].booking_id;
    const newToken = randomBytes(24).toString("base64url");

    await supabase
      .from("bookings")
      .update({ access_token_hash: hashToken(newToken) })
      .eq("id", mostRecentBookingId);

    const { data: booking } = await supabase
      .from("bookings")
      .select("reference")
      .eq("id", mostRecentBookingId)
      .single();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const myBookingUrl = `${siteUrl}/en/my-booking/${newToken}`;

    await sendEmail({
      templateKey: "booking_link_resend",
      to: parsed.data.email,
      subject: `${SITE_DEFAULTS.companyName} – Your Booking Link`,
      react: BookingLinkEmail({ reference: booking?.reference ?? "", myBookingUrl }),
      bookingId: mostRecentBookingId,
    });
  }

  // Always return success, regardless of whether the email matched a
  // booking, so this endpoint can't be used to enumerate customer emails.
  return { status: "sent" };
}

const uploadProofSchema = z.object({
  bankName: z.string().trim().min(1).max(200),
  transactionRef: z.string().trim().min(1).max(200),
  paymentDate: z.string().min(1),
});

export type UploadProofState = { status: "idle" | "success" | "error"; error?: string };

export async function uploadPaymentProof(
  token: string,
  _prev: UploadProofState,
  formData: FormData
): Promise<UploadProofState> {
  const parsed = uploadProofSchema.safeParse({
    bankName: formData.get("bankName"),
    transactionRef: formData.get("transactionRef"),
    paymentDate: formData.get("paymentDate"),
  });
  if (!parsed.success) return { status: "error", error: "Please fill in all fields." };

  const file = formData.get("proof") as File | null;
  if (!file || file.size === 0) return { status: "error", error: "Please select a file to upload." };
  if (file.size > 10 * 1024 * 1024) return { status: "error", error: "File must be under 10MB." };

  const result = await getBookingByToken(token);
  if (!result) return { status: "error", error: "Booking not found." };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop();
  const path = `${result.booking.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    console.error("uploadPaymentProof storage upload failed", uploadError.message);
    return { status: "error", error: "Upload failed. Please try again." };
  }

  await supabase.from("payment_proofs").insert({
    booking_id: result.booking.id,
    storage_path: path,
    bank_name: parsed.data.bankName,
    transaction_ref: parsed.data.transactionRef,
    payment_date: parsed.data.paymentDate,
  });

  await supabase
    .from("bookings")
    .update({ status: "payment_proof_submitted" })
    .eq("id", result.booking.id)
    .eq("status", "pending");

  await supabase.from("booking_status_history").insert({
    booking_id: result.booking.id,
    old_status: result.booking.status,
    new_status: "payment_proof_submitted",
    customer_note: "Payment proof uploaded by customer",
  });

  return { status: "success" };
}
