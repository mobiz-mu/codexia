"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-1 text-sm text-muted">
      <span className="sr-only">{t("languageSwitcher")}</span>
      <select
        value={locale}
        onChange={(e) => {
          router.replace(pathname, {
            locale: e.target.value as (typeof routing.locales)[number],
          });
        }}
        className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-sm text-ink"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
