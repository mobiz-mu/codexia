import "server-only";
import { sendEmail } from "./send";
import { getTemplateOverride } from "./get-template-override";
import ReviewRequest from "@/emails/ReviewRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildEmailBrandProps, getSiteUrl } from "@/lib/email/shared-props";

const SUBJECTS = {
  en: () => `Codexia Ltd – How was your rental?`,
  fr: () => `Codexia Ltd – Comment s'est passée votre location ?`,
};

/**
 * Fires once per booking, 24h after it reaches "completed" — see
 * app/api/cron/review-requests/route.ts for the dedup/scheduling logic.
 * The review link points at the vehicle's public reviews section; a
 * dedicated tokenized review-submission page is a Phase 2 enhancement.
 */
export async function sendReviewRequestEmail(bookingId: string, locale: "en" | "fr" = "en") {
  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings").select("id, reference, vehicle_id").eq("id", bookingId).single();
  if (!booking) return;

  const [{ data: customer }, { data: vehicle }] = await Promise.all([
    supabase.from("booking_customers").select("full_name, email").eq("booking_id", bookingId).maybeSingle(),
    booking.vehicle_id
      ? supabase.from("vehicles").select("name, slug").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!customer) return;

  const siteUrl = getSiteUrl();
  const reviewUrl = vehicle?.slug
    ? `${siteUrl}/${locale}/fleet/${vehicle.slug}#reviews`
    : `${siteUrl}/${locale}#reviews`;
  const settings = await getSiteSettings();
  const brand = buildEmailBrandProps(
    settings,
    siteUrl,
    `Hi Codexia, I have a question about my booking ${booking.reference}.`
  );

  const emailProps = {
    locale,
    reference: booking.reference,
    customerName: customer.full_name,
    vehicleName: vehicle?.name ?? "",
    reviewUrl,
    ...brand,
  };

  const subject = SUBJECTS[locale]();
  const override = await getTemplateOverride("review_request_customer", locale, {
    reference: emailProps.reference,
    customerName: emailProps.customerName,
    vehicleName: emailProps.vehicleName,
    reviewUrl,
  });

  await sendEmail({
    templateKey: "review_request_customer",
    to: customer.email,
    bookingId,
    ...(override ? { subject: override.subject, html: override.html } : { subject, react: ReviewRequest(emailProps) }),
  });
}
