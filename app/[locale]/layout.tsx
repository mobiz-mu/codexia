import type { Metadata } from "next";
import localFont from "next/font/local";
import {
  NextIntlClientProvider,
  hasLocale,
} from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";
import { AnalyticsTracker } from "@/components/site/AnalyticsTracker";
import { AnalyticsScripts } from "@/components/site/AnalyticsScripts";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildAlternates } from "@/lib/seo/alternates";

import "../globals.css";

const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const jakarta = localFont({
  src: "../fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const settings = await getSiteSettings();
  const isFrench = locale === "fr";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.codexia.mu";

  const canonicalUrl = `${siteUrl}/${locale}`;

  const title = isFrench
    ? `${settings.companyName} | Location de voiture à Maurice`
    : `${settings.companyName} | Premium Car Rental in Mauritius`;

  const description = isFrench
    ? "Réservez votre voiture de location à Maurice avec Codexia Ltd. Livraison à l'aéroport, kilométrage illimité, assurance et assistance 24h/24."
    : "Book a reliable rental car in Mauritius with Codexia Ltd. Enjoy airport delivery, unlimited mileage, comprehensive insurance and 24/7 assistance.";

  return {
    metadataBase: new URL(siteUrl),

    title: {
      default: title,
      template: `%s | ${settings.companyName}`,
    },

    description,

    keywords: isFrench
      ? [
          "Codexia Ltd",
          "location voiture Maurice",
          "location de voiture à Maurice",
          "location voiture aéroport Maurice",
          "location SUV Maurice",
          "location voiture automatique Maurice",
          "voiture familiale Maurice",
          "location véhicule Maurice",
          "kilométrage illimité Maurice",
          "location voiture aéroport SSR",
        ]
      : [
          "Codexia Ltd",
          "Codexia Mauritius",
          "car rental Mauritius",
          "Mauritius car hire",
          "airport car rental Mauritius",
          "Mauritius airport car hire",
          "SUV rental Mauritius",
          "automatic car rental Mauritius",
          "family car rental Mauritius",
          "premium car rental Mauritius",
          "vehicle rental Mauritius",
          "unlimited mileage car rental Mauritius",
          "SSR Airport car rental",
        ],

    alternates: buildAlternates(locale, "/"),

    openGraph: {
      type: "website",
      locale: isFrench ? "fr_MU" : "en_MU",
      alternateLocale: isFrench ? ["en_MU"] : ["fr_MU"],
      url: canonicalUrl,
      siteName: settings.companyName,
      title,
      description,
      images: [
        {
          url: "/images/og/codexia-og.jpg",
          width: 1200,
          height: 630,
          alt: isFrench
            ? "Codexia Ltd, location de voitures à Maurice"
            : "Codexia Ltd car rental in Mauritius",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/og/codexia-og.jpg"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const settings = await getSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.companyName,
    url: siteUrl,
    logo: `${siteUrl}/images/codexia-logo.png`,
    email: settings.email,
    telephone: settings.phone,
    address: { "@type": "PostalAddress", addressCountry: "MU" },
    sameAs: [settings.socials.facebook, settings.socials.instagram].filter(Boolean),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: settings.phone,
      email: settings.email,
      contactType: "customer support",
      areaServed: "MU",
      availableLanguage: ["English", "French"],
    },
  };

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <AnalyticsScripts />

        <NextIntlClientProvider>
          <AnalyticsTracker locale={locale} />

          <Header />

          <main id="main-content" className="flex-1">
            {children}
          </main>

          <Footer />
          <WhatsAppButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}