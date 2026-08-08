import { Body, Container, EmailFooter, EmailHeader, Head, Heading, Html, Preview, Text } from "./components";

export default function BookingLinkEmail({
  locale,
  logoUrl,
  reference,
  myBookingUrl,
  whatsappUrl,
  supportEmail,
  siteUrl,
  mapsUrl,
  socials,
}: {
  locale: "en" | "fr";
  logoUrl: string;
  reference: string;
  myBookingUrl: string;
  whatsappUrl: string;
  supportEmail: string;
  siteUrl: string;
  mapsUrl?: string;
  socials?: { facebook?: string; instagram?: string };
}) {
  return (
    <Html>
      <Head />
      <Preview>Your booking link</Preview>
      <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#F8FAF7" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
          <EmailHeader logoUrl={logoUrl} />
          <Heading style={{ color: "#1F2937", fontSize: "20px" }}>Your Booking Link</Heading>
          <Text style={{ color: "#1F2937" }}>
            Here is the link to view your booking {reference}:
          </Text>
          <Text style={{ color: "#1F2937" }}>
            <a href={myBookingUrl}>{myBookingUrl}</a>
          </Text>

          <EmailFooter
            locale={locale}
            supportEmail={supportEmail}
            whatsappUrl={whatsappUrl}
            siteUrl={siteUrl}
            mapsUrl={mapsUrl}
            socials={socials}
          />
        </Container>
      </Body>
    </Html>
  );
}
