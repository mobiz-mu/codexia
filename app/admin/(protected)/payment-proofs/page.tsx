import type { Metadata } from "next";
import Link from "next/link";
import { listPendingProofs } from "@/lib/actions/admin/payment-proofs";
import { formatMoney } from "@/lib/pricing/format";
import { PaymentProofActions } from "@/components/admin/PaymentProofActions";

export const metadata: Metadata = { title: "Payment Proofs" };

export default async function AdminPaymentProofsPage() {
  const proofs = await listPendingProofs();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Payment Proofs</h1>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Booking</th>
              <th className="px-4 py-2">Bank</th>
              <th className="px-4 py-2">Transaction Ref</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Proof</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {proofs.map((p) => {
              const url = p.signedUrl;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/admin/bookings/${p.booking_id}`} className="font-medium text-primary-dark">
                      {p.bookings?.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{p.bank_name}</td>
                  <td className="px-4 py-2">{p.transaction_ref}</td>
                  <td className="px-4 py-2">{p.payment_date}</td>
                  <td className="px-4 py-2">
                    {p.bookings ? formatMoney(p.bookings.total_cents, "EUR", "en") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-dark underline">
                        View
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <PaymentProofActions proofId={p.id} />
                  </td>
                </tr>
              );
            })}
            {proofs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No pending payment proofs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
