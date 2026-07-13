"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker({ locale }: { locale: string }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event: "pageview",
        path: pathname,
        locale,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, [pathname, locale]);

  return null;
}
