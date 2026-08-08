import { Body, Container, EmailFooter, EmailHeader, Head, Heading, Html, Preview, Section, Text, Button } from "./components";

export type ReviewRequestProps = {
  locale: "en" | "fr";
  logoUrl: string;
  reference: string;
  customerName: string;
  vehicleName: string;
  reviewUrl: string;
  whatsappUrl: string;
  supportEmail: string;
  siteUrl: string;
  mapsUrl?: string;
  socials?: { facebook?: string; instagram?: string };
};

const COPY = {
  en: {
    preview: "How was your Codexia car rental experience?",
    subject: "How was your rental?",
    greeting: (name: string) => `Hi ${name},`,
    intro: (vehicle: string) =>
      `Thanks for renting a ${vehicle} with Codexia. We'd love to hear how it went — it only takes a minute.`,
    cta: "Leave a review",
    outro: "Your feedback helps other travellers choose Codexia with confidence.",
  },
  fr: {
    preview: "Comment s'est passée votre location Codexia ?",
    subject: "Comment s'est passée votre location ?",
    greeting: (name: string) => `Bonjour ${name},`,
    intro: (vehicle: string) =>
      `Merci d'avoir loué une ${vehicle} avec Codexia. Nous aimerions connaître votre avis — cela ne prend qu'une minute.`,
    cta: "Laisser un avis",
    outro: "Votre avis aide d'autres voyageurs à choisir Codexia en toute confiance.",
  },
} as const;

export default function ReviewRequest(props: ReviewRequestProps) {
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
          <Text style={{ color: "#1F2937" }}>{t.intro(props.vehicleName)}</Text>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={props.reviewUrl}>{t.cta}</Button>
          </Section>

          <Text style={{ color: "#6B7280", fontSize: "14px" }}>{t.outro}</Text>

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
