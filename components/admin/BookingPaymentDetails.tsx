import { formatMoney } from "@/lib/pricing/format";
import { computeDeposit, type DepositTier } from "@/lib/pricing/deposit";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { cn } from "@/lib/utils/cn";

type PaymentTransaction = {
  id: string;
  provider: string;
  provider_ref: string | null;
  capture_id: string | null;
  amount_cents: number;
  currency: string;
  exchange_rate: number | null;
  status: "created" | "pending" | "succeeded" | "failed" | "denied" | "cancelled" | "refunded" | "reversed" | "disputed";
  created_at: string;
  updated_at: string;
};

type Payment = {
  id: string;
  method: "bank_transfer" | "online" | "pay_on_arrival" | "cash";
  amount_cents: number;
  currency: string;
  status: "pending" | "recorded" | "refunded";
  note: string | null;
  paid_at: string | null;
  created_at: string;
};

const TRANSACTION_STATUS_STYLES: Record<PaymentTransaction["status"], string> = {
  succeeded: "bg-action-tint text-action-dark",
  created: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  refunded: "bg-amber-100 text-amber-800",
  reversed: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
  denied: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  disputed: "bg-red-100 text-red-700",
};

const TRANSACTION_STATUS_LABELS: Record<PaymentTransaction["status"], string> = {
  created: "Created",
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  denied: "Denied",
  cancelled: "Cancelled",
  refunded: "Refunded",
  reversed: "Reversed",
  disputed: "Disputed",
};

const NEEDS_ATTENTION_STATUSES = new Set<PaymentTransaction["status"]>(["denied", "refunded", "reversed", "disputed", "failed"]);

const PAYMENT_STATUS_STYLES: Record<Payment["status"], string> = {
  recorded: "bg-action-tint text-action-dark",
  pending: "bg-amber-100 text-amber-800",
  refunded: "bg-amber-100 text-amber-800",
};

const PAYMENT_METHOD_LABELS: Record<Payment["method"], string> = {
  online: "PayPal",
  bank_transfer: "Bank Transfer",
  pay_on_arrival: "Pay on Arrival",
  cash: "Cash",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

const TIER_LABELS: Record<DepositTier, string> = {
  full: "Full payment",
  mid: "€100 deposit tier",
  high: "€200 deposit tier",
};

export async function BookingPaymentDetails({
  paymentTransactions,
  payments,
  bookingTotalCents,
  bookingPaidCents,
  currency,
}: {
  paymentTransactions: PaymentTransaction[];
  payments: Payment[];
  bookingTotalCents: number;
  bookingPaidCents: number;
  currency: string;
}) {
  const recordedPaidCents = payments
    .filter((p) => p.status === "recorded")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const hasMismatch = recordedPaidCents !== bookingPaidCents;

  // Tier is derived from the booking's total against the CURRENT deposit
  // settings — purely an informational label for staff. If settings have
  // changed since this booking was actually paid, this may not exactly
  // match what was charged at the time; the actual charged amount (shown
  // per-transaction below) is always the authoritative figure, never this
  // label.
  const settings = await getSiteSettings();
  const currentTier = computeDeposit({
    totalCents: bookingTotalCents,
    currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });

  if (paymentTransactions.length === 0 && payments.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="mb-3 font-semibold text-ink">Payment Details</h2>
        <p className="text-sm text-muted">No payment records on file for this booking.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Payment Details</h2>
        <span className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary-dark">
          {TIER_LABELS[currentTier.depositTier]}
        </span>
      </div>

      {hasMismatch && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          Recorded payments total {formatMoney(recordedPaidCents, currency, "en")}, but the booking shows{" "}
          {formatMoney(bookingPaidCents, currency, "en")} paid. Please investigate before relying on this figure.
        </p>
      )}

      {paymentTransactions.length > 0 && (
        <div className="flex flex-col gap-3">
          {paymentTransactions.map((tx) => {
            const murEquivalent =
              tx.exchange_rate != null ? Math.round(tx.amount_cents * tx.exchange_rate) : null;
            return (
              <div key={tx.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {tx.provider === "paypal" ? "PayPal" : tx.provider}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      TRANSACTION_STATUS_STYLES[tx.status]
                    )}
                  >
                    {TRANSACTION_STATUS_LABELS[tx.status]}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted">
                  <dt>Order ID</dt>
                  <dd className="text-right text-ink">{tx.provider_ref ?? "—"}</dd>
                  <dt>Capture ID</dt>
                  <dd className="text-right text-ink">{tx.capture_id ?? "—"}</dd>
                  <dt>Amount captured</dt>
                  <dd className="text-right text-ink">{formatMoney(tx.amount_cents, tx.currency, "en")}</dd>
                  <dt>Currency</dt>
                  <dd className="text-right text-ink">{tx.currency}</dd>
                  <dt>Exchange rate</dt>
                  <dd className="text-right text-ink">{tx.exchange_rate != null ? `${tx.exchange_rate} MUR/EUR` : "—"}</dd>
                  <dt>MUR equivalent</dt>
                  <dd className="text-right text-ink">
                    {murEquivalent != null ? formatMoney(murEquivalent, "MUR", "en") : "—"}
                  </dd>
                  <dt>{tx.status === "succeeded" ? "Captured" : "Last updated"}</dt>
                  <dd className="text-right text-ink">{formatDateTime(tx.updated_at)}</dd>
                </dl>
                {NEEDS_ATTENTION_STATUSES.has(tx.status) && (
                  <p className="mt-2 text-xs text-red-700">
                    This transaction needs attention — status is &ldquo;{TRANSACTION_STATUS_LABELS[tx.status]}&rdquo;.
                    Refunds and disputes are managed directly in PayPal.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recorded Payments</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                <span className="text-ink">
                  {PAYMENT_METHOD_LABELS[p.method]} · {formatMoney(p.amount_cents, p.currency, "en")}
                  {p.paid_at && <span className="text-muted"> · {formatDateTime(p.paid_at)}</span>}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    PAYMENT_STATUS_STYLES[p.status]
                  )}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
