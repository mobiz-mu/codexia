"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LANGUAGE_OPTIONS = {
  en: {
    label: "English",
    flag: "/images/languageswitcher/english.png",
  },
  fr: {
    label: "Français",
    flag: "/images/languageswitcher/france.png",
  },
} as const;

export function LanguageSwitcher({
  compact = false,
}: LanguageSwitcherProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function changeLanguage(
    nextLocale: (typeof routing.locales)[number]
  ) {
    if (nextLocale === locale) {
      return;
    }

    router.replace(pathname, {
      locale: nextLocale,
      scroll: false,
    });
  }

  return (
    <div
      role="group"
      aria-label={t("languageSwitcher")}
      className={cn(
        "flex shrink-0 items-center",
        compact ? "gap-1.5" : "gap-2.5"
      )}
    >
      {routing.locales.map((loc) => {
        const language =
          LANGUAGE_OPTIONS[
            loc as keyof typeof LANGUAGE_OPTIONS
          ];

        if (!language) {
          return null;
        }

        const isActive = locale === loc;

        return (
          <button
            key={loc}
            type="button"
            aria-label={`${t("languageSwitcher")}: ${language.label}`}
            aria-pressed={isActive}
            title={language.label}
            onClick={() => changeLanguage(loc)}
            className={cn(
              "relative flex shrink-0 items-center justify-center",
              "border-0 bg-transparent p-0",
              "transition-all duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-offset-2",
              compact
                ? "focus-visible:ring-white focus-visible:ring-offset-blue-800"
                : "focus-visible:ring-blue-600 focus-visible:ring-offset-white",
              isActive
                ? "scale-110 opacity-100"
                : "opacity-60 hover:scale-105 hover:opacity-100"
            )}
          >
            <Image
              src={language.flag}
              alt={`${language.label} language`}
              width={compact ? 22 : 28}
              height={compact ? 22 : 28}
              sizes={compact ? "22px" : "28px"}
              className={cn(
                "block object-contain",
                compact
                  ? "h-[21px] w-[21px]"
                  : "h-7 w-7"
              )}
            />

            {isActive && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 rounded-full",
                  compact
                    ? "-bottom-1 h-0.5 w-3 bg-white"
                    : "-bottom-1.5 h-0.5 w-3.5 bg-gradient-to-r from-[#075ca8] to-[#15985a]"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
