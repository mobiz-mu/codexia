import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export default function BookingLinkEmail({
  reference,
  myBookingUrl,
}: {
  reference: string;
  myBookingUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your booking link</Preview>
      <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#F8FAF7" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
          <Heading style={{ color: "#1F2937", fontSize: "20px" }}>Your Booking Link</Heading>
          <Text style={{ color: "#1F2937" }}>
            Here is the link to view your booking {reference}:
          </Text>
          <Text style={{ color: "#1F2937" }}>
            <a href={myBookingUrl}>{myBookingUrl}</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
