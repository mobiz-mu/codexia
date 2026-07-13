import "server-only";
import { sendEmail } from "./send";
import BookingReceived from "@/emails/BookingReceived";
import { SITE_DEFAULTS } from "@/lib/config/site";
import { formatMoney } from "@/lib/pricing/format";

const SUBJECTS = {
  en: (ref: string) => `Codexia Ltd – Booking Request Received – ${ref}`,
  fr: (ref: string) => `Codexia Ltd – Demande de réservation reçue – ${ref}`,
};

const PAYMENT_LABELS = {
  en: { bank_transfer: "Bank transfer", pay_on_arrival: "Pay on arrival", online: "Online (coming soon)" },
  fr: { bank_transfer: "Virement bancaire", pay_on_arrival: "Paiement à l'arrivée", online: "En ligne (bientôt)" },
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
  paymentMethod: "bank_transfer" | "pay_on_arrival" | "online";
  totalCents: number;
  currency: string;
  siteUrl: string;
  accessToken: string;
}) {
  const dateFormatter = new Intl.DateTimeFormat(input.locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const myBookingUrl = `${input.siteUrl}/${input.locale}/my-booking/${input.accessToken}`;

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
    companyPhone: SITE_DEFAULTS.phone,
    companyEmail: SITE_DEFAULTS.email,
    myBookingUrl,
  };

  const subject = SUBJECTS[input.locale](input.reference);

  await Promise.all([
    sendEmail({
      templateKey: "booking_received_customer",
      to: input.customerEmail,
      subject,
      react: BookingReceived(emailProps),
      bookingId: input.bookingId,
    }),
    sendEmail({
      templateKey: "booking_received_admin",
      to: SITE_DEFAULTS.email,
      subject: `[Admin] ${subject}`,
      react: BookingReceived(emailProps),
      bookingId: input.bookingId,
    }),
  ]);
}
