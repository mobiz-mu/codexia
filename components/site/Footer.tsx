import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Phone, Mail, MessageCircle, AlertTriangle } from "lucide-react";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { NewsletterForm } from "./NewsletterForm";

const CAR_RENTAL_LINKS = [
  { href: "/fleet", labelKey: "fleet" },
  { href: "/book", labelKey: "book" },
  { href: "/services/airport-rental", labelKey: "airportRental" },
  { href: "/categories", labelKey: "categories" },
  { href: "/locations", labelKey: "locations" },
  { href: "/my-booking", labelKey: "manageBooking" },
] as const;

const MAURITIUS_LINKS = [
  { href: "/mauritius", labelKey: "about" },
  { href: "/mauritius/places-to-visit", labelKey: "placesToVisit" },
  { href: "/mauritius/driving-guide", labelKey: "drivingGuide" },
  { href: "/mauritius/airport-guide", labelKey: "airportGuide" },
  { href: "/mauritius/travel-tips", labelKey: "travelTips" },
  { href: "/blog", labelKey: "blog" },
] as const;

const POLICY_SLUGS = [
  "general-rental-conditions",
  "privacy",
  "cookie",
  "cancellation",
  "insurance",
  "payment",
  "fuel",
  "terms-of-use",
] as const;

export async function Footer() {
  const t = await getTranslations("footer");
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-ink text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="flex flex-col gap-4">
          <Image
            src="/logo.svg"
            alt={settings.companyName}
            width={220}
            height={56}
            className="h-10 w-auto brightness-0 invert"
          />
          <p className="text-sm text-white/70">{t("companyBlurb")}</p>
          <ul className="flex flex-col gap-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
              <a href={`tel:${settings.phone.replace(/\s+/g, "")}`} className="hover:text-white">
                {settings.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                {settings.whatsapp}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
              <a href={`mailto:${settings.email}`} className="hover:text-white">
                {settings.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>
                {t("emergencyLabel")}: {settings.emergencyPhone}
              </span>
            </li>
          </ul>
        </div>

        <nav aria-label={t("columns.carRental")}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">
            {t("columns.carRental")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {CAR_RENTAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-white/80 hover:text-white">
                  {t(`links.${link.labelKey}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("columns.mauritius")}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">
            {t("columns.mauritius")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {MAURITIUS_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-white/80 hover:text-white">
                  {t(`links.${link.labelKey}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <nav aria-label={t("columns.policies")}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">
              {t("columns.policies")}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {POLICY_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link href={`/policies/${slug}`} className="text-white/80 hover:text-white">
                    {t(`policyLinks.${slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6">
            <NewsletterForm
              variant="dark"
              labels={{
                heading: t("newsletter.heading"),
                placeholder: t("newsletter.placeholder"),
                submit: t("newsletter.submit"),
                success: t("newsletter.success"),
                error: t("newsletter.error"),
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/60 sm:flex-row sm:px-6 lg:px-8">
          <p>{t("copyright", { year })}</p>
          <div className="flex gap-4">
            <Link href="/sitemap" className="hover:text-white">
              {t("sitemap")}
            </Link>
            <Link href="/accessibility" className="hover:text-white">
              {t("accessibility")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
