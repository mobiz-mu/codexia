"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Copy, Check } from "lucide-react";
import type { PaymentMethod } from "../types";

export function Confirmation({
  reference,
  accessToken,
  paymentMethod,
  vehicleName,
  bankDetails,
  whatsappNumber,
}: {
  reference: string;
  accessToken: string;
  paymentMethod: PaymentMethod;
  vehicleName: string;
  bankDetails: { bankName: string; accountName: string; accountNumber: string; swift: string };
  whatsappNumber: string;
}) {
  const c = useTranslations("booking.confirmation");
  const [copied, setCopied] = useState(false);

  const whatsappMessage = `Hi Codexia, I've just submitted booking ${reference} for the ${vehicleName}. I'd like to arrange payment on arrival.`;
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

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

      <p className="rounded-lg bg-surface px-4 py-3 text-sm text-muted">{c("notConfirmedNotice")}</p>
      <p className="text-sm text-muted">{c("emailNotice")}</p>

      {paymentMethod === "bank_transfer" && (
        <div className="w-full rounded-lg border border-border p-4 text-left text-sm">
          <h3 className="mb-2 font-semibold text-ink">{c("bankDetailsTitle")}</h3>
          <p>
            <strong>Bank:</strong> {bankDetails.bankName || "—"}
          </p>
          <p>
            <strong>Account name:</strong> {bankDetails.accountName || "—"}
          </p>
          <p>
            <strong>Account number:</strong> {bankDetails.accountNumber || "—"}
          </p>
          <p>
            <strong>SWIFT:</strong> {bankDetails.swift || "—"}
          </p>
        </div>
      )}

      {paymentMethod === "pay_on_arrival" && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105"
        >
          {c("whatsappCta")}
        </a>
      )}

      <Link
        href={`/my-booking/${accessToken}`}
        className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface"
      >
        {c("myBookingCta")}
      </Link>
    </div>
  );
}
