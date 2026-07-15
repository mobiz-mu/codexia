"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarCheck,
  CarFront,
  CircleHelp,
  Compass,
  FileText,
  Info,
  MapPinned,
  Menu,
  Plane,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

import { LanguageSwitcher } from "./LanguageSwitcher";

type NavigationIcon = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type DropdownItem = {
  href: string;
  labelKey: string;
  icon: NavigationIcon;
};

type DropdownGroup = {
  key: "vehicles" | "booking" | "mauritius";
  items: DropdownItem[];
};

const BRAND_GRADIENT =
  "bg-gradient-to-r from-[#28a9df] via-[#1599c7] to-[#76b82a]";

const DROPDOWN_GROUPS: DropdownGroup[] = [
  {
    key: "vehicles",
    items: [
      {
        href: "/fleet",
        labelKey: "fleet",
        icon: CarFront,
      },
      {
        href: "/categories",
        labelKey: "categories",
        icon: Compass,
      },
      {
        href: "/services",
        labelKey: "services",
        icon: Sparkles,
      },
      {
        href: "/services/airport-rental",
        labelKey: "airportRental",
        icon: Plane,
      },
    ],
  },
  {
    key: "booking",
    items: [
      {
        href: "/book",
        labelKey: "bookNow",
        icon: CalendarCheck,
      },
      {
        href: "/my-booking",
        labelKey: "manageBooking",
        icon: FileText,
      },
      {
        href: "/faq",
        labelKey: "faq",
        icon: CircleHelp,
      },
    ],
  },
  {
    key: "mauritius",
    items: [
      {
        href: "/mauritius",
        labelKey: "aboutMauritius",
        icon: MapPinned,
      },
      {
        href: "/mauritius/places-to-visit",
        labelKey: "placesToVisit",
        icon: Compass,
      },
      {
        href: "/mauritius/driving-guide",
        labelKey: "drivingGuide",
        icon: CarFront,
      },
      {
        href: "/mauritius/airport-guide",
        labelKey: "airportGuide",
        icon: Plane,
      },
      {
        href: "/mauritius/travel-tips",
        labelKey: "travelTips",
        icon: ShieldCheck,
      },
    ],
  },
];

const DIRECT_LINKS = [
  {
    href: "/about",
    labelKey: "aboutUs",
    icon: Info,
  },
  {
    href: "/blog",
    labelKey: "blog",
    icon: FileText,
  },
  {
    href: "/contact",
    labelKey: "contact",
    icon: MapPinned,
  },
] as const;

const ANNOUNCEMENTS = [
  {
    key: "airportDelivery",
    icon: Plane,
  },
  {
    key: "premiumProtection",
    icon: ShieldCheck,
  },
  {
    key: "easyBooking",
    icon: CalendarCheck,
  },
] as const;

function isPathActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AnimatedPlus({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block h-3 w-3 shrink-0",
        "transition-transform duration-300 ease-out",
        open && "rotate-45"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-[1.5px] w-full",
          "-translate-y-1/2 rounded-full bg-current"
        )}
      />

      <span
        className={cn(
          "absolute left-1/2 top-0 h-full w-[1.5px]",
          "-translate-x-1/2 rounded-full bg-current"
        )}
      />
    </span>
  );
}

function DesktopUnderline({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-1 left-1/2 h-[2px]",
        "-translate-x-1/2 rounded-full",
        BRAND_GRADIENT,
        "transition-all duration-300 ease-out",
        active
          ? "w-7 opacity-100"
          : "w-0 opacity-0 group-hover/nav:w-7 group-hover/nav:opacity-100"
      )}
    />
  );
}

function AnnouncementIcon({
  icon: Icon,
}: {
  icon: NavigationIcon;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center",
        "rounded-md bg-white text-[#1599c7]",
        "shadow-[0_3px_12px_rgba(0,0,0,0.12)]"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function Header() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAnnouncement = useTranslations("announcementBar");

  const pathname = usePathname();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (mediaQuery.matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setAnnouncementIndex(
        (current) => (current + 1) % ANNOUNCEMENTS.length
      );
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpenGroup(null);
      setMobileOpen(false);
      setMobileGroup(null);
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        navRef.current &&
        !navRef.current.contains(event.target as Node)
      ) {
        setOpenGroup(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOpenGroup(null);
      setMobileOpen(false);
      setMobileGroup(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isGroupActive = (group: DropdownGroup) =>
    group.items.some((item) =>
      isPathActive(pathname, item.href)
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "transition-shadow duration-300",
        scrolled &&
          "shadow-[0_10px_35px_rgba(15,45,85,0.10)]"
      )}
    >
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-[100]",
          "focus:rounded-full focus:bg-white focus:px-5 focus:py-3",
          "focus:text-sm focus:font-semibold focus:text-slate-950",
          "focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#1599c7]"
        )}
      >
        {tCommon("skipToContent")}
      </a>

      {/* Announcement bar */}
      <div
        className={cn(
          "relative overflow-hidden text-white",
          BRAND_GRADIENT
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 opacity-20",
            "bg-[radial-gradient(circle_at_18%_50%,rgba(255,255,255,0.42),transparent_27%),radial-gradient(circle_at_82%_40%,rgba(255,255,255,0.28),transparent_24%)]"
          )}
        />

        <div
          className={cn(
            "relative mx-auto grid min-h-9 max-w-[1440px]",
            "grid-cols-[70px_1fr_45px] items-center",
            "px-3 sm:grid-cols-[92px_1fr_70px] sm:px-6",
            "lg:min-h-10 lg:grid-cols-[160px_1fr_160px] lg:px-8"
          )}
        >
          <div className="flex items-center lg:hidden">
            <LanguageSwitcher compact />
          </div>

          <div
            className="hidden lg:block"
            aria-hidden="true"
          />

          <div
            className={cn(
              "relative flex min-h-9 items-center justify-center",
              "overflow-hidden lg:min-h-10"
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {ANNOUNCEMENTS.map(
              ({ key, icon: Icon }, index) => (
                <div
                  key={key}
                  className={cn(
                    "absolute inset-x-0 flex items-center justify-center",
                    "gap-2 text-center",
                    "transition-all duration-500 ease-out",
                    index === announcementIndex
                      ? "translate-y-0 opacity-100"
                      : index < announcementIndex
                        ? "-translate-y-4 opacity-0"
                        : "translate-y-4 opacity-0"
                  )}
                >
                  <AnnouncementIcon icon={Icon} />

                  <p
                    className={cn(
                      "text-[10px] font-semibold tracking-[0.01em]",
                      "sm:text-xs lg:text-[12px]"
                    )}
                  >
                    <span className="sm:hidden">
                      {tAnnouncement(`${key}Mobile`)}
                    </span>

                    <span className="hidden sm:inline">
                      {tAnnouncement(key)}
                    </span>
                  </p>
                </div>
              )
            )}
          </div>

          <div
            className="flex justify-end gap-1"
            aria-hidden="true"
          >
            {ANNOUNCEMENTS.map(({ key }, index) => (
              <span
                key={key}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  index === announcementIndex
                    ? "w-4 bg-white"
                    : "w-1 bg-white/45"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="border-b border-slate-200/80 bg-white">
        <div
          className={cn(
            "relative mx-auto flex h-[68px] max-w-[1440px]",
            "items-center justify-between px-4",
            "sm:h-[74px] sm:px-6",
            "lg:h-[80px] lg:px-8"
          )}
        >
          {/* Mobile menu */}
          <button
            type="button"
            aria-label={
              mobileOpen
                ? t("closeNavigation")
                : t("openNavigation")
            }
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() =>
              setMobileOpen((current) => !current)
            }
            className={cn(
              "relative z-20 flex h-10 w-10 items-center justify-center",
              "rounded-full border border-slate-200 bg-white",
              "text-slate-900 shadow-sm",
              "transition-all duration-300",
              "hover:border-[#28a9df]/40 hover:bg-cyan-50",
              "hover:text-[#1599c7]",
              "focus:outline-none focus:ring-2 focus:ring-[#1599c7]",
              "focus:ring-offset-2 lg:hidden"
            )}
          >
            <span className="relative h-5 w-5">
              <Menu
                className={cn(
                  "absolute inset-0 h-5 w-5",
                  "transition-all duration-300",
                  mobileOpen
                    ? "rotate-90 scale-75 opacity-0"
                    : "rotate-0 scale-100 opacity-100"
                )}
                aria-hidden="true"
              />

              <X
                className={cn(
                  "absolute inset-0 h-5 w-5",
                  "transition-all duration-300",
                  mobileOpen
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-90 scale-75 opacity-0"
                )}
                aria-hidden="true"
              />
            </span>
          </button>

          {/* Main logo */}
          <Link
            href="/"
            aria-label={t("homeAriaLabel")}
            className={cn(
              "group flex shrink-0 items-center",
              "absolute left-1/2 -translate-x-1/2",
              "lg:static lg:translate-x-0"
            )}
          >
            <Image
  src="/images/codexia-logo.png"
  alt="Codexia Ltd premium car rental in Mauritius"
  width={260}
  height={92}
  priority
  sizes="(max-width: 639px) 138px, (max-width: 1023px) 148px, 178px"
  style={{
    height: "auto",
  }}
  className={cn(
    "w-[138px] object-contain",
    "transition-transform duration-300",
    "group-hover:scale-[1.02]",
    "sm:w-[148px] lg:w-[178px]"
  )}
/>   
          </Link>

          {/* Desktop navigation */}
          <nav
            ref={navRef}
            aria-label={t("primaryNavigation")}
            className="hidden items-center gap-0.5 lg:flex"
          >
            <Link
              href="/about"
              className={cn(
                "group/nav relative rounded-lg px-3 py-2.5",
                "text-[13px] font-semibold",
                "transition-colors duration-200",
                isPathActive(pathname, "/about")
                  ? "text-[#1599c7]"
                  : "text-slate-700 hover:text-[#1599c7]"
              )}
            >
              {t("aboutUs")}

              <DesktopUnderline
                active={isPathActive(pathname, "/about")}
              />
            </Link>

            {DROPDOWN_GROUPS.map((group) => {
              const active = isGroupActive(group);
              const isOpen = openGroup === group.key;

              return (
                <div
                  key={group.key}
                  className="relative"
                  onMouseEnter={() =>
                    setOpenGroup(group.key)
                  }
                  onMouseLeave={() => setOpenGroup(null)}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenGroup((current) =>
                        current === group.key
                          ? null
                          : group.key
                      )
                    }
                    className={cn(
                      "group/nav relative flex items-center gap-1.5",
                      "rounded-lg px-3 py-2.5",
                      "text-[13px] font-semibold",
                      "transition-colors duration-200",
                      active || isOpen
                        ? "text-[#1599c7]"
                        : "text-slate-700 hover:text-[#1599c7]"
                    )}
                  >
                    {t(`${group.key}.label`)}

                    <AnimatedPlus open={isOpen} />

                    <DesktopUnderline
                      active={active || isOpen}
                    />
                  </button>

                  <div
                    role="menu"
                    className={cn(
                      "absolute left-1/2 top-full z-50",
                      "w-[265px] -translate-x-1/2 pt-3",
                      "transition-all duration-200 ease-out",
                      isOpen
                        ? "visible translate-y-0 opacity-100"
                        : "invisible -translate-y-1.5 opacity-0"
                    )}
                  >
                    <div
                      className={cn(
                        "overflow-hidden rounded-2xl",
                        "border border-slate-200/90 bg-white",
                        "p-1.5",
                        "shadow-[0_18px_48px_rgba(17,47,84,0.16)]"
                      )}
                    >
                      <div className="grid gap-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const itemActive = isPathActive(
                            pathname,
                            item.href
                          );

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              onClick={() =>
                                setOpenGroup(null)
                              }
                              className={cn(
                                "group/item flex min-h-11 items-center gap-2.5",
                                "rounded-xl px-2.5 py-2",
                                "transition-all duration-200",
                                itemActive
                                  ? "bg-cyan-50 text-[#1599c7]"
                                  : "text-slate-800 hover:bg-slate-50 hover:text-[#1599c7]"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center",
                                  "rounded-lg border bg-white",
                                  "transition-all duration-200",
                                  itemActive
                                    ? "border-cyan-200 text-[#1599c7]"
                                    : "border-slate-200 text-slate-500 group-hover/item:border-cyan-200 group-hover/item:text-[#1599c7]"
                                )}
                              >
                                <Icon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </span>

                              <span className="text-[13px] font-semibold">
                                {t(
                                  `${group.key}.${item.labelKey}`
                                )}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Link
              href="/blog"
              className={cn(
                "group/nav relative rounded-lg px-3 py-2.5",
                "text-[13px] font-semibold",
                "transition-colors duration-200",
                isPathActive(pathname, "/blog")
                  ? "text-[#1599c7]"
                  : "text-slate-700 hover:text-[#1599c7]"
              )}
            >
              {t("blog")}

              <DesktopUnderline
                active={isPathActive(pathname, "/blog")}
              />
            </Link>

            <Link
              href="/contact"
              className={cn(
                "group/nav relative rounded-lg px-3 py-2.5",
                "text-[13px] font-semibold",
                "transition-colors duration-200",
                isPathActive(pathname, "/contact")
                  ? "text-[#1599c7]"
                  : "text-slate-700 hover:text-[#1599c7]"
              )}
            >
              {t("contact")}

              <DesktopUnderline
                active={isPathActive(pathname, "/contact")}
              />
            </Link>
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />

            <Link
              href="/book"
              className={cn(
                "group relative inline-flex min-h-10 items-center",
                "justify-center overflow-hidden rounded-full",
                BRAND_GRADIENT,
                "px-5 py-2 text-[13px] font-bold text-white",
                "shadow-[0_9px_24px_rgba(21,153,199,0.24)]",
                "transition-all duration-300",
                "hover:-translate-y-0.5",
                "hover:shadow-[0_13px_28px_rgba(21,153,199,0.30)]",
                "focus:outline-none focus:ring-2 focus:ring-[#1599c7]",
                "focus:ring-offset-2"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 -left-1/2 w-1/3",
                  "skew-x-[-22deg] bg-white/25 blur-sm",
                  "transition-transform duration-700",
                  "group-hover:translate-x-[420%]"
                )}
              />

              <span className="relative">
                {t("bookNowCta")}
              </span>
            </Link>
          </div>

          <div
            className="h-10 w-10 lg:hidden"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Mobile backdrop */}
      <button
        type="button"
        tabIndex={mobileOpen ? 0 : -1}
        aria-label={t("closeNavigation")}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-0 top-[104px] z-30 bg-slate-950/35",
          "backdrop-blur-[3px] transition-opacity duration-300",
          "lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      />

      {/* Mobile menu */}
      <div
        id="mobile-navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[104px] z-40",
          "overflow-hidden lg:hidden",
          "transition-all duration-400 ease-out",
          mobileOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        )}
      >
        <div
          className={cn(
            "h-full overflow-y-auto overscroll-contain bg-white",
            "px-3 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3",
            "shadow-[0_24px_70px_rgba(15,35,60,0.22)]",
            "sm:px-5"
          )}
        >
          <nav
            aria-label={t("mobileNavigation")}
            className="mx-auto max-w-lg"
          >
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-2.5",
                "rounded-xl border px-3 py-2",
                "text-sm font-semibold",
                "transition-colors duration-200",
                isPathActive(pathname, "/about")
                  ? "border-cyan-200 bg-cyan-50 text-[#1599c7]"
                  : "border-slate-200 text-slate-800"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center",
                  "rounded-lg border border-slate-200 bg-white",
                  "text-[#1599c7]"
                )}
              >
                <Info
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </span>

              {t("aboutUs")}
            </Link>

            <div className="mt-2 space-y-1.5">
              {DROPDOWN_GROUPS.map((group) => {
                const isExpanded =
                  mobileGroup === group.key;

                const active = isGroupActive(group);

                return (
                  <div
                    key={group.key}
                    className={cn(
                      "overflow-hidden rounded-xl border",
                      active
                        ? "border-cyan-200 bg-cyan-50/40"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setMobileGroup((current) =>
                          current === group.key
                            ? null
                            : group.key
                        )
                      }
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between",
                        "px-3 text-left",
                        "text-sm font-semibold text-slate-900"
                      )}
                    >
                      <span>{t(`${group.key}.label`)}</span>

                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center",
                          "rounded-full bg-slate-100 text-slate-600",
                          "transition-colors duration-300",
                          isExpanded &&
                            "bg-cyan-100 text-[#1599c7]"
                        )}
                      >
                        <AnimatedPlus open={isExpanded} />
                      </span>
                    </button>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-out",
                        isExpanded
                          ? "grid-rows-[1fr]"
                          : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-0.5 border-t border-slate-200/80 p-1.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;

                            const itemActive = isPathActive(
                              pathname,
                              item.href
                            );

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() =>
                                  setMobileOpen(false)
                                }
                                className={cn(
                                  "flex min-h-10 items-center gap-2.5",
                                  "rounded-lg px-2.5 py-1.5",
                                  "text-[13px] font-semibold",
                                  "transition-colors duration-200",
                                  itemActive
                                    ? "bg-white text-[#1599c7] shadow-sm"
                                    : "text-slate-700 hover:bg-white"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center",
                                    "rounded-md border border-slate-200 bg-white",
                                    itemActive
                                      ? "text-[#1599c7]"
                                      : "text-slate-500"
                                  )}
                                >
                                  <Icon
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </span>

                                {t(
                                  `${group.key}.${item.labelKey}`
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DIRECT_LINKS.filter(
                (item) => item.href !== "/about"
              ).map((item) => {
                const Icon = item.icon;

                const active = isPathActive(
                  pathname,
                  item.href
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2",
                      "rounded-xl border px-2",
                      "text-[13px] font-semibold",
                      "transition-colors",
                      active
                        ? "border-cyan-200 bg-cyan-50 text-[#1599c7]"
                        : "border-slate-200 bg-white text-slate-800"
                    )}
                  >
                    <Icon
                      className="h-4 w-4"
                      aria-hidden="true"
                    />

                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/book"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "mt-3 flex min-h-12 w-full items-center justify-center",
                "rounded-xl px-5",
                BRAND_GRADIENT,
                "text-sm font-bold text-white",
                "shadow-[0_12px_26px_rgba(21,153,199,0.24)]",
                "transition-transform active:scale-[0.98]"
              )}
            >
              <CalendarCheck
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />

              {t("bookNowCta")}
            </Link>

            <p className="mt-3 text-center text-[11px] leading-4 text-slate-500">
              {t("mobileMenuTrust")}
            </p>
          </nav>
        </div>
      </div>
    </header>
  );
}