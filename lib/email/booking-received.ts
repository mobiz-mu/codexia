import "server-only";
import { sendEmail } from "./send";
import { getTemplateOverride } from "./get-template-override";
import BookingReceived from "@/emails/BookingReceived";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { formatMoney } from "@/lib/pricing/format";
import { buildEmailBrandProps } from "@/lib/email/shared-props";

const SUBJECTS = {
  en: (ref: string) => `Codexia Ltd – Booking Request Received – ${ref}`,
  fr: (ref: string) => `Codexia Ltd – Demande de réservation reçue – ${ref}`,
};

const PAYMENT_LABELS = {
  en: { online: "Online (PayPal)" },
  fr: { online: "En ligne (PayPal)" },
};

export async function sendBookingReceivedEmails(input: {
  locale: "en" | "fr";
  bookingId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  vehicleName: string;
  pickupLocationName: string;
  dropoffLocationName: string;
  pickupAt: Date;
  returnAt: Date;
  paymentMethod: "online";
  totalCents: number;
  currency: string;
  siteUrl: string;
  accessToken: string;
}) {
  const dateFormatter = new Intl.DateTimeFormat(input.locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const settings = await getSiteSettings();
  const myBookingUrl = `${input.siteUrl}/${input.locale}/my-booking/${input.accessToken}`;
  const brand = buildEmailBrandProps(
    settings,
    input.siteUrl,
    `Hi Codexia, I have a question about my booking ${input.reference}.`
  );

  const emailProps = {
    locale: input.locale,
    reference: input.reference,
    customerName: input.customerName,
    vehicleName: input.vehicleName,
    pickupLocationName: input.pickupLocationName,
    dropoffLocationName: input.dropoffLocationName,
    pickupAt: dateFormatter.format(input.pickupAt),
    returnAt: dateFormatter.format(input.returnAt),
    paymentMethodLabel: PAYMENT_LABELS[input.locale][input.paymentMethod],
    totalFormatted: formatMoney(input.totalCents, input.currency, input.locale),
    myBookingUrl,
    ...brand,
  };

  const subject = SUBJECTS[input.locale](input.reference);
  const variables = {
    reference: input.reference,
    customerName: input.customerName,
    vehicleName: input.vehicleName,
    pickupLocationName: input.pickupLocationName,
    dropoffLocationName: input.dropoffLocationName,
    pickupAt: emailProps.pickupAt,
    returnAt: emailProps.returnAt,
    paymentMethodLabel: emailProps.paymentMethodLabel,
    totalFormatted: emailProps.totalFormatted,
    myBookingUrl,
  };

  const customerOverride = await getTemplateOverride("booking_received_customer", input.locale, variables);

  await Promise.all([
    sendEmail({
      templateKey: "booking_received_customer",
      to: input.customerEmail,
      bookingId: input.bookingId,
      ...(customerOverride
        ? { subject: customerOverride.subject, html: customerOverride.html }
        : { subject, react: BookingReceived(emailProps) }),
    }),
    sendEmail({
      templateKey: "booking_received_admin",
      to: settings.email,
      subject: `[Admin] ${subject}`,
      react: BookingReceived(emailProps),
      bookingId: input.bookingId,
    }),
  ]);
}
