import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Car, MapPin, CalendarClock, Receipt } from "lucide-react";
import { getBookingByToken } from "@/lib/actions/my-booking";
import { PaymentProofUpload } from "@/components/site/PaymentProofUpload";
import { formatMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils/cn";

const NEGATIVE_STATUSES = new Set(["cancelled", "no_show", "rejected"]);
const POSITIVE_STATUSES = new Set([
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
  "active",
  "completed",
  "approved",
]);

function statusTone(status: string) {
  if (NEGATIVE_STATUSES.has(status)) return "bg-red-50 text-red-700";
  if (POSITIVE_STATUSES.has(status)) return "bg-action-tint text-action-dark";
  return "bg-primary-tint text-primary-dark";
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "myBooking.detail" });
  return { title: t("reference"), robots: { index: false, follow: false } };
}

export default async function MyBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myBooking.detail");

  const result = await getBookingByToken(token);

  if (!result) {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="rounded-xl border border-border bg-surface p-6 text-muted">{t("notFound")}</p>
      </section>
    );
  }

  const { booking, customer, vehicle, pickupLoc, dropoffLoc, proofs } = result;
  const locationName = (loc: { name_en: string; name_fr: string } | null) =>
    loc ? (locale === "fr" ? loc.name_fr : loc.name_en) : "—";

  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const balanceCents = booking.total_cents - booking.paid_cents;
  const currency = "MUR";

  const statusLabel = t(`statusLabels.${booking.status}` as "statusLabels.pending");

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          {t("reference")}: {booking.reference}
        </h1>
        <span className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", statusTone(booking.status))}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background p-5">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <Car className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <dt className="text-muted">{t("vehicle")}</dt>
            <dd className="ml-auto font-medium text-ink">{vehicle?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <dt className="text-muted">{t("pickup")}</dt>
            <dd className="ml-auto text-right font-medium text-ink">
              {locationName(pickupLoc)}
              <br />
              <span className="font-normal text-muted">{dateFormatter.format(new Date(booking.pickup_at))}</span>
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <dt className="text-muted">{t("dropoff")}</dt>
            <dd className="ml-auto text-right font-medium text-ink">
              {locationName(dropoffLoc)}
              <br />
              <span className="font-normal text-muted">{dateFormatter.format(new Date(booking.return_at))}</span>
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-ink">
              <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("total")}
            </span>
            <span className="font-semibold text-ink">{formatMoney(booking.total_cents, currency, locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">{t("paid")}</span>
            <span className="font-medium text-action-dark">{formatMoney(booking.paid_cents, currency, locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">{t("balance")}</span>
            <span className="font-semibold text-ink">{formatMoney(balanceCents, currency, locale)}</span>
          </div>
        </div>

        {customer && (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
            {customer.full_name} · {customer.email}
          </p>
        )}
      </div>

      {proofs.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">{t("proofsUploaded")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {proofs.map((proof) => (
              <li
                key={proof.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
              >
                <span className="text-ink">
                  {proof.bank_name} · {proof.transaction_ref}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusTone(proof.status))}>
                  {t(`proofStatus.${proof.status}` as "proofStatus.pending")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {booking.status === "pending" && (
        <div className="mt-6">
          <PaymentProofUpload
            token={token}
            labels={{
              title: t("proofTitle"),
              bankName: t("proofBankName"),
              transactionRef: t("proofTransactionRef"),
              date: t("proofDate"),
              file: t("proofFile"),
              submit: t("proofSubmit"),
              submitted: t("proofSubmitted"),
            }}
          />
        </div>
      )}
    </section>
  );
}
