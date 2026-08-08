import "server-only";
import { randomBytes, createHash } from "crypto";
import { sendEmail } from "./send";
import { getTemplateOverride } from "./get-template-override";
import BookingConfirmed from "@/emails/BookingConfirmed";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { formatMoney } from "@/lib/pricing/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/booking/status-machine";
import { buildEmailBrandProps, getSiteUrl } from "@/lib/email/shared-props";

const SUBJECTS = {
  en: () => "Booking Confirmed",
  fr: () => "Réservation confirmée",
};

export async function sendBookingConfirmedEmail(bookingId: string, locale: "en" | "fr") {
  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!booking) return;

  const [{ data: customer }, { data: vehicle }, { data: pickupLoc }, { data: dropoffLoc }, settings] = await Promise.all([
    supabase.from("booking_customers").select("*").eq("booking_id", bookingId).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.pickup_location_id).maybeSingle(),
    supabase.from("locations").select("name_en, name_fr").eq("id", booking.dropoff_location_id).maybeSingle(),
    getSiteSettings(),
  ]);

  if (!customer) return;

  // Rotate the access token so this email always carries a working link,
  // even though only the hash from booking creation was ever persisted.
  const accessToken = randomBytes(24).toString("base64url");
  await supabase
    .from("bookings")
    .update({ access_token_hash: createHash("sha256").update(accessToken).digest("hex") })
    .eq("id", bookingId);

  const siteUrl = getSiteUrl();
  const myBookingUrl = `${siteUrl}/${locale}/my-booking/${accessToken}`;
  const brand = buildEmailBrandProps(
    settings,
    siteUrl,
    `Hi Codexia, I have a question about my booking ${booking.reference}.`
  );

  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const currency = booking.currency;
  const paymentStatusLabel =
    booking.balance_cents <= 0
      ? locale === "fr"
        ? "Payé intégralement"
        : "Paid in Full"
      : booking.paid_cents > 0
        ? locale === "fr"
          ? "Acompte payé"
          : "Deposit Paid"
        : locale === "fr"
          ? "Non payé"
          : "Unpaid";

  const bookingStatusLabel = BOOKING_STATUS_LABELS[booking.status as BookingStatus] ?? booking.status;

  const emailProps = {
    locale,
    reference: booking.reference,
    customerName: customer.full_name,
    vehicleName: vehicle?.name ?? "",
    pickupLocationName: locale === "fr" ? pickupLoc?.name_fr ?? "" : pickupLoc?.name_en ?? "",
    dropoffLocationName: locale === "fr" ? dropoffLoc?.name_fr ?? "" : dropoffLoc?.name_en ?? "",
    pickupAt: dateFormatter.format(new Date(booking.pickup_at)),
    returnAt: dateFormatter.format(new Date(booking.return_at)),
    bookingTotalFormatted: formatMoney(booking.total_cents, currency, locale),
    amountPaidFormatted: formatMoney(booking.paid_cents, currency, locale),
    balanceFormatted: formatMoney(booking.balance_cents, currency, locale),
    paymentStatusLabel,
    bookingStatusLabel,
    myBookingUrl,
    ...brand,
  };

  const subject = SUBJECTS[locale]();
  const override = await getTemplateOverride("booking_confirmed_customer", locale, {
    reference: emailProps.reference,
    customerName: emailProps.customerName,
    vehicleName: emailProps.vehicleName,
    pickupLocationName: emailProps.pickupLocationName,
    dropoffLocationName: emailProps.dropoffLocationName,
    pickupAt: emailProps.pickupAt,
    returnAt: emailProps.returnAt,
    bookingTotalFormatted: emailProps.bookingTotalFormatted,
    amountPaidFormatted: emailProps.amountPaidFormatted,
    balanceFormatted: emailProps.balanceFormatted,
    paymentStatusLabel: emailProps.paymentStatusLabel,
    bookingStatusLabel: emailProps.bookingStatusLabel,
    myBookingUrl,
  });

  await sendEmail({
    templateKey: "booking_confirmed_customer",
    to: customer.email,
    bookingId,
    ...(override
      ? { subject: override.subject, html: override.html }
      : { subject, react: BookingConfirmed(emailProps) }),
  });
}
