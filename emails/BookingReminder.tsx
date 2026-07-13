import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";

export type BookingReminderProps = {
  locale: "en" | "fr";
  reference: string;
  customerName: string;
  vehicleName: string;
  pickupLocationName: string;
  pickupAt: string;
  balanceFormatted: string;
  companyPhone: string;
  companyEmail: string;
  myBookingUrl: string;
};

const COPY = {
  en: {
    preview: "Your Mauritius car rental pickup is coming up",
    subject: "Your Pickup Is Coming Up",
    greeting: (name: string) => `Hi ${name},`,
    intro: "This is a friendly reminder that your car rental pickup is coming up soon:",
    reference: "Reference",
    vehicle: "Vehicle",
    pickup: "Pickup",
    balance: "Remaining balance",
    documents: "Please bring a valid driving licence, ID/passport, and the primary driver's card for the security deposit.",
    manage: "View your booking:",
    contact: "Questions? Contact us:",
  },
  fr: {
    preview: "Votre prise en charge de location de voiture à Maurice approche",
    subject: "Votre prise en charge approche",
    greeting: (name: string) => `Bonjour ${name},`,
    intro: "Ceci est un rappel amical : votre prise en charge de véhicule approche :",
    reference: "Référence",
    vehicle: "Véhicule",
    pickup: "Prise en charge",
    balance: "Solde restant",
    documents: "Merci d'apporter un permis de conduire valide, une pièce d'identité/passeport, et la carte du conducteur principal pour le dépôt de garantie.",
    manage: "Voir votre réservation :",
    contact: "Des questions ? Contactez-nous :",
  },
} as const;

export default function BookingReminder(props: BookingReminderProps) {
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
            {props.balanceFormatted && (
              <Text style={{ margin: "4px 0", color: "#1F2937" }}>
                <strong>{t.balance}:</strong> {props.balanceFormatted}
              </Text>
            )}
          </Section>

          <Text style={{ color: "#6B7280", fontSize: "14px" }}>{t.documents}</Text>

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
