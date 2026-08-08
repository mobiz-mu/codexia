import { Body, Button, Container, EmailFooter, EmailHeader, Head, Heading, Html, Preview, Section, Text } from "./components";

export type BookingConfirmedProps = {
  locale: "en" | "fr";
  logoUrl: string;
  reference: string;
  customerName: string;
  vehicleName: string;
  pickupLocationName: string;
  dropoffLocationName: string;
  pickupAt: string;
  returnAt: string;
  bookingTotalFormatted: string;
  amountPaidFormatted: string;
  balanceFormatted: string;
  paymentStatusLabel: string;
  bookingStatusLabel: string;
  myBookingUrl: string;
  whatsappUrl: string;
  supportEmail: string;
  siteUrl: string;
  mapsUrl?: string;
  socials?: { facebook?: string; instagram?: string };
};

const COPY = {
  en: {
    preview: "Your Codexia booking is confirmed",
    subject: "Booking Confirmed",
    greeting: (name: string) => `Hi ${name},`,
    intro: "Great news — your payment was received and your booking is now confirmed.",
    reference: "Reference",
    vehicle: "Vehicle",
    pickup: "Pickup",
    dropoff: "Drop-off",
    bookingTotal: "Booking Total",
    amountPaid: "Amount Paid",
    balance: "Remaining Balance",
    paymentStatus: "Payment Status",
    bookingStatus: "Booking Status",
    documents:
      "Please bring a valid driving licence, ID/passport, and the primary driver's card for the security deposit.",
    viewBooking: "View Booking",
    contactSupport: "Contact Support",
    whatsapp: "WhatsApp Us",
    contact: "Questions? Contact us:",
  },
  fr: {
    preview: "Votre réservation Codexia est confirmée",
    subject: "Réservation confirmée",
    greeting: (name: string) => `Bonjour ${name},`,
    intro: "Bonne nouvelle — votre paiement a été reçu et votre réservation est maintenant confirmée.",
    reference: "Référence",
    vehicle: "Véhicule",
    pickup: "Prise en charge",
    dropoff: "Restitution",
    bookingTotal: "Total de la réservation",
    amountPaid: "Montant payé",
    balance: "Solde restant",
    paymentStatus: "Statut du paiement",
    bookingStatus: "Statut de la réservation",
    documents:
      "Merci d'apporter un permis de conduire valide, une pièce d'identité/passeport, et la carte du conducteur principal pour le dépôt de garantie.",
    viewBooking: "Voir la réservation",
    contactSupport: "Contacter le support",
    whatsapp: "Nous écrire sur WhatsApp",
    contact: "Des questions ? Contactez-nous :",
  },
} as const;

export default function BookingConfirmed(props: BookingConfirmedProps) {
  const t = COPY[props.locale];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#F8FAF7" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
          <EmailHeader logoUrl={props.logoUrl} />

          <Heading style={{ color: "#1F2937", fontSize: "20px" }}>{t.subject}</Heading>
          <Text style={{ color: "#1F2937" }}>{t.greeting(props.customerName)}</Text>
          <Text style={{ color: "#1F2937" }}>{t.intro}</Text>

          <Section style={{ backgroundColor: "#F8FAF7", padding: "16px", borderRadius: "8px" }}>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.reference}:</strong> {props.reference}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.vehicle}:</strong> {props.vehicleName}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.pickup}:</strong> {props.pickupLocationName} — {props.pickupAt}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.dropoff}:</strong> {props.dropoffLocationName} — {props.returnAt}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.bookingTotal}:</strong> {props.bookingTotalFormatted}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.amountPaid}:</strong> {props.amountPaidFormatted}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.balance}:</strong> {props.balanceFormatted}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.paymentStatus}:</strong> {props.paymentStatusLabel}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.bookingStatus}:</strong> {props.bookingStatusLabel}
            </Text>
          </Section>

          <Text style={{ color: "#6B7280", fontSize: "14px" }}>{t.documents}</Text>

          <Section style={{ marginTop: "24px", textAlign: "center" }}>
            <Button href={props.myBookingUrl} style={{ marginRight: "8px" }}>
              {t.viewBooking}
            </Button>
            <Button href={`mailto:${props.supportEmail}`} style={{ backgroundColor: "#8DB63C", marginRight: "8px" }}>
              {t.contactSupport}
            </Button>
            <Button href={props.whatsappUrl} style={{ backgroundColor: "#25D366" }}>
              {t.whatsapp}
            </Button>
          </Section>

          <EmailFooter
            locale={props.locale}
            supportEmail={props.supportEmail}
            whatsappUrl={props.whatsappUrl}
            siteUrl={props.siteUrl}
            mapsUrl={props.mapsUrl}
            socials={props.socials}
          />
        </Container>
      </Body>
    </Html>
  );
}
