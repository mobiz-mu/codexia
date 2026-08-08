"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/pricing/format";
import { PayPalCheckoutButton, type PayPalApproveDetails } from "@/components/payments/PayPalCheckoutButton";
import {
  getBookingDepositQuote,
  createPayPalOrderForBooking,
  captureBookingPayment,
  type BookingDepositQuoteResult,
} from "@/lib/actions/booking";

type PendingBooking = { bookingId: string; reference: string; accessToken: string };

export function PaymentStep({
  pendingBooking,
  creating,
  createError,
  locale,
  onBack,
  onPaid,
}: {
  pendingBooking: PendingBooking | null;
  creating: boolean;
  createError: string | null;
  locale: "en" | "fr";
  onBack: () => void;
  onPaid: () => void;
}) {
  const t = useTranslations("booking");
  const p = useTranslations("booking.paymentStep");

  const [quote, setQuote] = useState<BookingDepositQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingBooking) return;
    let cancelled = false;
    getBookingDepositQuote(pendingBooking.bookingId, pendingBooking.accessToken).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setQuoteError(result.error);
        return;
      }
      setQuote(result);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingBooking]);

  async function handleApprove(details: PayPalApproveDetails) {
    if (!pendingBooking) return;
    setConfirming(true);
    setPayError(null);

    const result = await captureBookingPayment(
      pendingBooking.bookingId,
      pendingBooking.accessToken,
      details.orderId,
      locale
    );

    setConfirming(false);
    if (!result.ok) {
      setPayError(result.error);
      return;
    }
    onPaid();
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-ink">{p("title")}</h2>

      {creating && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {p("creatingBooking")}
        </div>
      )}

      {createError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {createError}
        </p>
      )}

      {pendingBooking && !quote && !quoteError && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {p("creatingBooking")}
        </div>
      )}

      {quoteError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {quoteError}
        </p>
      )}

      {pendingBooking && quote?.ok && (
        <>
          <div className="rounded-xl border border-border bg-surface p-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{p("totalLabel")}</dt>
                <dd className="font-semibold text-ink">{formatMoney(quote.bookingTotalCents, quote.currency, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{p("payNowLabel")}</dt>
                <dd className="text-lg font-bold text-action-dark">{formatMoney(quote.amountDueNowCents, "EUR", locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{p("remainingLabel")}</dt>
                <dd className="font-semibold text-ink">
                  {formatMoney(quote.remainingBalanceCents, quote.currency, locale)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              {quote.depositTier === "full"
                ? p("fullPaymentNote", { threshold: formatMoney(quote.depositThresholdEurCents, "EUR", locale) })
                : p("depositNote", {
                    amount: formatMoney(
                      quote.depositTier === "mid" ? quote.depositMidTierAmountEurCents : quote.depositHighTierAmountEurCents,
                      "EUR",
                      locale
                    ),
                  })}{" "}
              {p("eurNote")}
            </p>
          </div>

          {confirming ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {p("confirming")}
            </div>
          ) : (
            <PayPalCheckoutButton
              bookingId={pendingBooking.bookingId}
              accessToken={pendingBooking.accessToken}
              onCreateOrder={createPayPalOrderForBooking}
              onApprove={handleApprove}
              onError={setPayError}
            />
          )}

          {payError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
              {payError}
            </p>
          )}
        </>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={creating || confirming}
          className="text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}
