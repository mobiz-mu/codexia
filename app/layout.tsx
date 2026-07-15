import type { Metadata } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
  "https://www.codexia.mu";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Codexia Ltd",
  authors: [{ name: "Codexia Ltd" }],
  creator: "Codexia Ltd",
  publisher: "Codexia Ltd",
  category: "Car Rental",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}