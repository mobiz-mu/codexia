import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getBookingByToken } from "@/lib/actions/my-booking";
import { PaymentProofUpload } from "@/components/site/PaymentProofUpload";
import { formatMoney } from "@/lib/pricing/format";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "myBooking.detail" });
  return { title: t("reference") };
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
        <p className="text-muted">{t("notFound")}</p>
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
  const currency = "EUR";

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink">
        {t("reference")}: {booking.reference}
      </h1>

      <div className="mt-6 rounded-xl border border-border p-4 text-sm">
        <p>
          <strong>{t("status")}:</strong> {booking.status}
        </p>
        <p>
          <strong>{t("vehicle")}:</strong> {vehicle?.name ?? "—"}
        </p>
        <p>
          <strong>{t("pickup")}:</strong> {locationName(pickupLoc)} —{" "}
          {dateFormatter.format(new Date(booking.pickup_at))}
        </p>
        <p>
          <strong>{t("dropoff")}:</strong> {locationName(dropoffLoc)} —{" "}
          {dateFormatter.format(new Date(booking.return_at))}
        </p>
        <p>
          <strong>{t("total")}:</strong> {formatMoney(booking.total_cents, currency, locale)}
        </p>
        <p>
          <strong>{t("paid")}:</strong> {formatMoney(booking.paid_cents, currency, locale)}
        </p>
        <p>
          <strong>{t("balance")}:</strong> {formatMoney(balanceCents, currency, locale)}
        </p>
        {customer && (
          <p className="mt-2 text-muted">
            {customer.full_name} · {customer.email}
          </p>
        )}
      </div>

      {proofs.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">{t("proofsUploaded")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {proofs.map((proof) => (
              <li key={proof.id} className="rounded-lg bg-surface p-3">
                {proof.bank_name} · {proof.transaction_ref} —{" "}
                {t(`proofStatus.${proof.status}` as "proofStatus.pending")}
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
