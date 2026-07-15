import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";

// Self-hosted (not next/font/google) so the build never depends on network
// access to fonts.googleapis.com/gstatic.com.
const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Codexia Admin", template: "%s | Codexia Admin" },
  robots: { index: false, follow: false },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-surface text-ink">{children}</body>
    </html>
  );
}
