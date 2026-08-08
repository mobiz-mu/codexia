import Image from "next/image";
import {
  AlertTriangle,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/config/get-site-settings";

import { NewsletterForm } from "./NewsletterForm";

const CAR_RENTAL_LINKS = [
  { href: "/fleet", labelKey: "fleet" },
  { href: "/book", labelKey: "book" },
  {
    href: "/services/airport-rental",
    labelKey: "airportRental",
  },
  { href: "/categories", labelKey: "categories" },
  { href: "/locations", labelKey: "locations" },
  {
    href: "/my-booking",
    labelKey: "manageBooking",
  },
] as const;

const MAURITIUS_LINKS = [
  { href: "/mauritius", labelKey: "about" },
  {
    href: "/mauritius/places-to-visit",
    labelKey: "placesToVisit",
  },
  {
    href: "/mauritius/driving-guide",
    labelKey: "drivingGuide",
  },
  {
    href: "/mauritius/airport-guide",
    labelKey: "airportGuide",
  },
  {
    href: "/mauritius/travel-tips",
    labelKey: "travelTips",
  },
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

const BRAND_GRADIENT =
  "bg-gradient-to-r from-[#28a9df] via-[#1599c7] to-[#76b82a]";

export async function Footer() {
  const t = await getTranslations("footer");
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#071c2f] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(40,169,223,0.16),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(118,184,42,0.12),transparent_26%)]"
      />

      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] ${BRAND_GRADIENT}`}
      />

      <div className="relative mx-auto grid max-w-[1380px] grid-cols-1 gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1.2fr] lg:gap-12 lg:px-8 lg:py-14">
        {/* Brand and contact */}
        <div className="flex flex-col items-start gap-5">
         <Link
  href="/"
  aria-label="Codexia Ltd homepage"
  className="inline-flex items-center"
>
  <div
    className="
      relative
      overflow-hidden

      w-[225px]
      h-[50px]

      sm:w-[235px]
      sm:h-[52px]

      lg:w-[250px]
      lg:h-[54px]
    "
  >
    <Image
      src="/images/codexia-logo.png"
      alt="Codexia Ltd car rental in Mauritius"
      fill
      loading="lazy"
      sizes="250px"
      className="object-contain object-center"
      style={{
        transform: "translateY(1px) scale(3.60)",
      }}
    />
  </div>
</Link>
          <p className="max-w-md text-sm leading-6 text-white/70">
            {t("companyBlurb")}
          </p>

          <ul className="flex flex-col gap-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Phone
                  className="h-4 w-4 text-[#38bdf8]"
                  aria-hidden="true"
                />
              </span>

              <a
                href={`tel:${settings.phone.replace(/\s+/g, "")}`}
                className="transition-colors hover:text-white"
              >
                {settings.phone}
              </a>
            </li>

            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <MessageCircle
                  className="h-4 w-4 text-[#76b82a]"
                  aria-hidden="true"
                />
              </span>

              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                {settings.whatsapp}
              </a>
            </li>

            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Mail
                  className="h-4 w-4 text-[#38bdf8]"
                  aria-hidden="true"
                />
              </span>

              <a
                href={`mailto:${settings.email}`}
                className="break-all transition-colors hover:text-white"
              >
                {settings.email}
              </a>
            </li>

            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <AlertTriangle
                  className="h-4 w-4 text-[#76b82a]"
                  aria-hidden="true"
                />
              </span>

              <span>
                {t("emergencyLabel")}:{" "}
                {settings.emergencyPhone}
              </span>
            </li>
          </ul>
        </div>

        {/* Car rental */}
        <nav aria-label={t("columns.carRental")}>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/50">
            {t("columns.carRental")}
          </h2>

          <ul className="flex flex-col gap-3 text-sm">
            {CAR_RENTAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] transition-transform duration-200 group-hover:scale-125"
                  />

                  {t(`links.${link.labelKey}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mauritius */}
        <nav aria-label={t("columns.mauritius")}>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/50">
            {t("columns.mauritius")}
          </h2>

          <ul className="flex flex-col gap-3 text-sm">
            {MAURITIUS_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#76b82a] transition-transform duration-200 group-hover:scale-125"
                  />

                  {t(`links.${link.labelKey}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Policies and newsletter */}
        <div>
          <nav aria-label={t("columns.policies")}>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/50">
              {t("columns.policies")}
            </h2>

            <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              {POLICY_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/policies/${slug}`}
                    className="group inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#38bdf8] to-[#76b82a] transition-transform duration-200 group-hover:scale-125"
                    />

                    {t(`policyLinks.${slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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

      {/* Bottom bar */}
      <div className="relative border-t border-white/10 bg-black/10">
        <div className="mx-auto flex max-w-[1380px] flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-white/55 sm:px-6 md:flex-row md:text-left lg:px-8">
          <p>{t("copyright", { year })}</p>

          <p>
            Designed &amp; Built by{" "}
            <a
              href="https://mobiz.mu"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/80 transition-colors hover:text-white"
            >
              Mobiz.mu
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}