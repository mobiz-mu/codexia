"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils/cn";

type NavGroup = {
  key: "vehicles" | "booking" | "mauritius" | "company";
  items: { href: string; labelKey: string }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "vehicles",
    items: [
      { href: "/fleet", labelKey: "fleet" },
      { href: "/categories", labelKey: "categories" },
      { href: "/services/airport-rental", labelKey: "airportRental" },
    ],
  },
  {
    key: "booking",
    items: [
      { href: "/book", labelKey: "bookNow" },
      { href: "/my-booking", labelKey: "manageBooking" },
    ],
  },
  {
    key: "mauritius",
    items: [
      { href: "/mauritius", labelKey: "about" },
      { href: "/mauritius/places-to-visit", labelKey: "placesToVisit" },
      { href: "/mauritius/driving-guide", labelKey: "drivingGuide" },
      { href: "/mauritius/airport-guide", labelKey: "airportGuide" },
      { href: "/mauritius/travel-tips", labelKey: "travelTips" },
      { href: "/blog", labelKey: "blog" },
    ],
  },
  {
    key: "company",
    items: [
      { href: "/about", labelKey: "about" },
      { href: "/services", labelKey: "services" },
      { href: "/faq", labelKey: "faq" },
      { href: "/contact", labelKey: "contact" },
    ],
  },
];

export function Header() {
  const t = useTranslations("nav");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Codexia Ltd home">
          <Image src="/logo.svg" alt="Codexia Ltd" width={220} height={56} className="h-10 w-auto" priority />
        </Link>

        <nav ref={navRef} className="hidden items-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={openGroup === group.key}
                onClick={() =>
                  setOpenGroup((cur) => (cur === group.key ? null : group.key))
                }
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface hover:text-primary-dark"
              >
                {t(`${group.key}.label`)}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openGroup === group.key && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
              {openGroup === group.key && (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-background p-2 shadow-lg">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenGroup(null)}
                      className="block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface hover:text-primary-dark"
                    >
                      {t(`${group.key}.${item.labelKey}`)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher />
          <Link
            href="/book"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            {t("bookNowCta")}
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-ink lg:hidden"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 pb-6 lg:hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="border-b border-border py-2">
              <p className="px-1 py-2 text-sm font-semibold text-muted">
                {t(`${group.key}.label`)}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
                >
                  {t(`${group.key}.${item.labelKey}`)}
                </Link>
              ))}
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-4">
            <LanguageSwitcher />
            <Link
              href="/book"
              onClick={() => setMobileOpen(false)}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              {t("bookNowCta")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
