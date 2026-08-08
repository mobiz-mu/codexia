import { Body, Button, Container, EmailFooter, EmailHeader, Head, Heading, Html, Preview, Section, Text } from "./components";

export type InvoiceEmailProps = {
  locale: "en" | "fr";
  logoUrl: string;
  invoiceNumber: string;
  customerName: string;
  bookingTotalFormatted: string;
  amountPaidFormatted: string;
  balanceFormatted: string;
  downloadUrl: string;
  supportEmail: string;
  whatsappUrl: string;
  siteUrl: string;
  mapsUrl?: string;
  socials?: { facebook?: string; instagram?: string };
};

const COPY = {
  en: {
    preview: (invoiceNumber: string) => `Invoice ${invoiceNumber} from Codexia Ltd`,
    heading: (invoiceNumber: string) => `Invoice ${invoiceNumber}`,
    greeting: (name: string) => `Hi ${name},`,
    intro: "Please find your invoice from Codexia Ltd below.",
    bookingTotal: "Booking Total",
    amountPaid: "Amount Paid",
    balance: "Remaining Balance",
    download: "Download Invoice (PDF)",
  },
  fr: {
    preview: (invoiceNumber: string) => `Facture ${invoiceNumber} de Codexia Ltd`,
    heading: (invoiceNumber: string) => `Facture ${invoiceNumber}`,
    greeting: (name: string) => `Bonjour ${name},`,
    intro: "Veuillez trouver ci-dessous votre facture de Codexia Ltd.",
    bookingTotal: "Total de la réservation",
    amountPaid: "Montant payé",
    balance: "Solde restant",
    download: "Télécharger la facture (PDF)",
  },
} as const;

export default function InvoiceEmail(props: InvoiceEmailProps) {
  const t = COPY[props.locale];

  return (
    <Html>
      <Head />
      <Preview>{t.preview(props.invoiceNumber)}</Preview>
      <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#F8FAF7" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
          <EmailHeader logoUrl={props.logoUrl} />
          <Heading style={{ color: "#1F2937", fontSize: "20px" }}>{t.heading(props.invoiceNumber)}</Heading>
          <Text style={{ color: "#1F2937" }}>{t.greeting(props.customerName)}</Text>
          <Text style={{ color: "#1F2937" }}>{t.intro}</Text>

          <Section style={{ backgroundColor: "#F8FAF7", padding: "16px", borderRadius: "8px" }}>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.bookingTotal}:</strong> {props.bookingTotalFormatted}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.amountPaid}:</strong> {props.amountPaidFormatted}
            </Text>
            <Text style={{ margin: "4px 0", color: "#1F2937" }}>
              <strong>{t.balance}:</strong> {props.balanceFormatted}
            </Text>
          </Section>

          <Section style={{ marginTop: "24px", textAlign: "center" }}>
            <Button href={props.downloadUrl}>{t.download}</Button>
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
