import "server-only";
import { randomBytes, createHash } from "crypto";
import { sendEmail } from "./send";
import { getTemplateOverride } from "./get-template-override";
import BookingReminder from "@/emails/BookingReminder";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { formatMoney } from "@/lib/pricing/format";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBJECTS = {
  en: (ref: string) => `Codexia Ltd – Your Pickup Is Coming Up – ${ref}`,
  fr: (ref: string) => `Codexia Ltd – Votre prise en charge approche – ${ref}`,
};

export async function sendBookingReminderEmail(bookingId: string, locale: "en" | "fr" = "en") {
  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!booking) return;

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, settings] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", bookingId).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name, currency").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    getSiteSettings(),
  ]);

  if (!customer) return;

  // Rotate the access token so the reminder always carries a working link,
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

  const emailProps = {
    locale,
    reference: booking.reference,
    customerName: customer.full_name,
    vehicleName: vehicle?.name ?? "",
    pickupLocationName: locale === "fr" ? pickupLoc?.name_fr ?? "" : pickupLoc?.name_en ?? "",
    pickupAt: dateFormatter.format(new Date(booking.pickup_at)),
    balanceFormatted:
      booking.balance_cents > 0 ? formatMoney(booking.balance_cents, vehicle?.currency ?? settings.currency, locale) : "",
    companyPhone: settings.phone,
    companyEmail: settings.email,
    myBookingUrl,
  };

  const subject = SUBJECTS[locale](booking.reference);
  const override = await getTemplateOverride("booking_reminder_customer", locale, {
    reference: emailProps.reference,
    customerName: emailProps.customerName,
    vehicleName: emailProps.vehicleName,
    pickupLocationName: emailProps.pickupLocationName,
    pickupAt: emailProps.pickupAt,
    balanceFormatted: emailProps.balanceFormatted,
    myBookingUrl,
  });

  await Promise.all([
    sendEmail({
      templateKey: "booking_reminder_customer",
      to: customer.email,
      bookingId,
      ...(override
        ? { subject: override.subject, html: override.html }
        : { subject, react: BookingReminder(emailProps) }),
    }),
    sendEmail({
      templateKey: "booking_reminder_admin",
      to: settings.email,
      subject: `[Admin] ${subject}`,
      react: BookingReminder(emailProps),
      bookingId,
    }),
  ]);
}
