"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Copy, Check } from "lucide-react";

export function Confirmation({
  reference,
  accessToken,
}: {
  reference: string;
  accessToken: string;
}) {
  const c = useTranslations("booking.confirmation");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="animate-fade-in-up flex flex-col items-center gap-6 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-action-tint">
        <CheckCircle2 className="h-10 w-10 text-action-dark" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-2xl font-bold text-ink">{c("title")}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-lg font-semibold text-action-dark">
            {c("reference")}: {reference}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={c("copyReference")}
            className="flex items-center gap-1 rounded-full border border-border p-1.5 text-muted transition-colors hover:border-primary hover:text-primary-dark"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-action-dark" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <p className="rounded-lg bg-action-tint/50 px-4 py-3 text-sm text-action-dark">{c("confirmedNotice")}</p>
      <p className="text-sm text-muted">{c("emailNotice")}</p>

      <Link
        href={`/my-booking/${accessToken}`}
        className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface"
      >
        {c("myBookingCta")}
      </Link>
    </div>
  );
}
