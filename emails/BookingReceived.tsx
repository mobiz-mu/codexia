import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

export type BookingReceivedProps = {
  locale: "en" | "fr";
  reference: string;
  customerName: string;
  vehicleName: string;
  pickupLocationName: string;
  dropoffLocationName: string;
  pickupAt: string;
  returnAt: string;
  paymentMethodLabel: string;
  totalFormatted: string;
  companyPhone: string;
  companyEmail: string;
  myBookingUrl: string;
};

const COPY = {
  en: {
    preview: "Booking request received",
    subject: "Booking Request Received",
    greeting: (name: string) => `Hi ${name},`,
    intro: "We've received your booking request. Here's a summary:",
    reference: "Reference",
    vehicle: "Vehicle",
    pickup: "Pickup",
    dropoff: "Drop-off",
    payment: "Payment method",
    total: "Total",
    notice:
      "This booking is not yet confirmed. Our team will review it and follow up with next steps.",
    manage: "View or manage your booking:",
    contact: "Questions? Contact us:",
  },
  fr: {
    preview: "Demande de réservation reçue",
    subject: "Demande de réservation reçue",
    greeting: (name: string) => `Bonjour ${name},`,
    intro: "Nous avons bien reçu votre demande de réservation. Voici un résumé :",
    reference: "Référence",
    vehicle: "Véhicule",
    pickup: "Prise en charge",
    dropoff: "Restitution",
    payment: "Méthode de paiement",
    total: "Total",
    notice:
      "Cette réservation n'est pas encore confirmée. Notre équipe l'examinera et vous contactera pour la suite.",
    manage: "Consulter ou gérer votre réservation :",
    contact: "Des questions ? Contactez-nous :",
  },
} as const;

export default function BookingReceived(props: BookingReceivedProps) {
  const t = COPY[props.locale];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#F8FAF7" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
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
              <strong>{t.payment}:</strong> {props.paymentMethodLabel}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.total}:</strong> {props.totalFormatted}
            </Text>
          </Section>

          <Text style={{ color: "#6B7280", fontSize: "14px" }}>{t.notice}</Text>

          <Hr />

          <Text style={{ color: "#1F2937" }}>
            {t.manage} <a href={props.myBookingUrl}>{props.myBookingUrl}</a>
          </Text>
          <Text style={{ color: "#6B7280", fontSize: "14px" }}>
            {t.contact} {props.companyPhone} · {props.companyEmail}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
