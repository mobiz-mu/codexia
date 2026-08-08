"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import BookingLinkEmail from "@/emails/BookingLink";
import { SITE_DEFAULTS } from "@/lib/config/site";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildEmailBrandProps, getSiteUrl } from "@/lib/email/shared-props";
import { checkRateLimit } from "@/lib/utils/rate-limit";

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

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, { data: dropoffLoc }] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", booking.id).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name, slug").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
  ]);

  return { booking, customer, vehicle, pickupLoc, dropoffLoc };
}

const resendSchema = z.object({ email: z.email() });

export type ResendLinkState = { status: "idle" | "sent" | "error" };

export async function resendBookingLink(
  _prev: ResendLinkState,
  formData: FormData
): Promise<ResendLinkState> {
  const rateLimit = await checkRateLimit("resend_booking_link", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) return { status: "error" };

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

    const [{ data: booking }, settings] = await Promise.all([
      supabase
        .from("bookings")
        .update({ access_token_hash: hashToken(newToken) })
        .eq("id", mostRecentBookingId)
        .select("reference")
        .single(),
      getSiteSettings(),
    ]);

    const siteUrl = getSiteUrl();
    const myBookingUrl = `${siteUrl}/en/my-booking/${newToken}`;
    const brand = buildEmailBrandProps(
      settings,
      siteUrl,
      `Hi Codexia, I have a question about my booking ${booking?.reference ?? ""}.`
    );

    await sendEmail({
      templateKey: "booking_link_resend",
      to: parsed.data.email,
      subject: `${SITE_DEFAULTS.companyName} â€“ Your Booking Link`,
      react: BookingLinkEmail({ locale: "en", reference: booking?.reference ?? "", myBookingUrl, ...brand }),
      bookingId: mostRecentBookingId,
    });
  }

  // Always return success, regardless of whether the email matched a
  // booking, so this endpoint can't be used to enumerate customer emails.
  return { status: "sent" };
}
