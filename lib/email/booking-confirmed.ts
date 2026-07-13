import "server-only";
import { randomBytes, createHash } from "crypto";
import { sendEmail } from "./send";
import BookingConfirmed from "@/emails/BookingConfirmed";
import { SITE_DEFAULTS } from "@/lib/config/site";
import { formatMoney } from "@/lib/pricing/format";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBJECTS = {
  en: (ref: string) => `Codexia Ltd – Your Car Rental Booking Is Confirmed – ${ref}`,
  fr: (ref: string) => `Codexia Ltd – Votre réservation de voiture est confirmée – ${ref}`,
};

export async function sendBookingConfirmedEmail(bookingId: string, locale: "en" | "fr") {
  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!booking) return;

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, { data: dropoffLoc }] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", bookingId).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name, currency").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
  ]);

  if (!customer) return;

  // Rotate the access token so Email 2 always carries a working link,
  // even though only the hash from booking creation was ever persisted.
  const accessToken = randomBytes(24).toString("base64url");
  await supabase
    .from("bookings")
    .update({ access_token_hash: createHash("sha256").update(accessToken).digest("hex") })
    .eq("id", bookingId);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const myBookingUrl = `${siteUrl}/${locale}/my-booking/${accessToken}`;

  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  await sendEmail({
    templateKey: "booking_confirmed_customer",
    to: customer.email,
    subject: SUBJECTS[locale](booking.reference),
    bookingId,
    react: BookingConfirmed({
      locale,
      reference: booking.reference,
      customerName: customer.full_name,
      vehicleName: vehicle?.name ?? "",
      pickupLocationName: locale === "fr" ? pickupLoc?.name_fr ?? "" : pickupLoc?.name_en ?? "",
      dropoffLocationName: locale === "fr" ? dropoffLoc?.name_fr ?? "" : dropoffLoc?.name_en ?? "",
      pickupAt: dateFormatter.format(new Date(booking.pickup_at)),
      returnAt: dateFormatter.format(new Date(booking.return_at)),
      balanceFormatted: formatMoney(booking.balance_cents, vehicle?.currency ?? SITE_DEFAULTS.currency, locale),
      companyPhone: SITE_DEFAULTS.phone,
      companyEmail: SITE_DEFAULTS.email,
      myBookingUrl,
    }),
  });
}
