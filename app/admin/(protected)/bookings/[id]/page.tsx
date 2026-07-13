import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingDetail } from "@/lib/actions/admin/bookings";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/booking/status-machine";
import { formatMoney } from "@/lib/pricing/format";
import { BookingStatusForm } from "@/components/admin/BookingStatusForm";
import { VehicleReassignForm } from "@/components/admin/VehicleReassignForm";
import { ResendEmailButtons } from "@/components/admin/ResendEmailButtons";
import { createInvoiceFromBookingAndRedirect } from "@/lib/actions/admin/invoices";

export const metadata: Metadata = { title: "Booking Detail" };

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getBookingDetail(id);
  if (!result) notFound();

  const { booking, customer, drivers, extras, statusHistory, proofs, vehicle, pickupLoc, dropoffLoc, availableVehiclesInCategory } =
    result;

  const currency = vehicle?.currency ?? "EUR";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">{booking.reference}</h1>
        <p className="text-muted">
          {BOOKING_STATUS_LABELS[booking.status as BookingStatus] ?? booking.status}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Trip Details</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Vehicle</dt>
              <dd>{vehicle?.name ?? "Unassigned"}</dd>
              <dt className="text-muted">Pickup</dt>
              <dd>
                {pickupLoc?.name_en} — {new Date(booking.pickup_at).toLocaleString("en-GB")}
              </dd>
              <dt className="text-muted">Drop-off</dt>
              <dd>
                {dropoffLoc?.name_en} — {new Date(booking.return_at).toLocaleString("en-GB")}
              </dd>
              <dt className="text-muted">Passengers</dt>
              <dd>{booking.passengers}</dd>
              {booking.flight_number && (
                <>
                  <dt className="text-muted">Flight</dt>
                  <dd>
                    {booking.flight_number} {booking.flight_airline ?? ""}
                  </dd>
                </>
              )}
              {booking.special_requests && (
                <>
                  <dt className="text-muted">Special Requests</dt>
                  <dd>{booking.special_requests}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Customer & Drivers</h2>
            {customer && (
              <p className="text-sm">
                {customer.full_name} · {customer.email} · {customer.phone} · {customer.country}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
              {drivers.map((d) => (
                <li key={d.id}>
                  {d.is_primary ? "Primary" : "Additional"}: {d.full_name}, age {d.age}, licence{" "}
                  {d.licence_country} ({d.licence_issue_date})
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Extras</h2>
            {extras.length === 0 ? (
              <p className="text-sm text-muted">No extras selected.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {extras.map((e) => (
                  <li key={e.id}>
                    {e.extras?.name_en} × {e.quantity} — {formatMoney(e.unit_price_cents * e.quantity, currency, "en")}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Pricing</h2>
            <p className="text-sm">Total: {formatMoney(booking.total_cents, currency, "en")}</p>
            <p className="text-sm">Paid: {formatMoney(booking.paid_cents, currency, "en")}</p>
            <p className="text-sm">Balance: {formatMoney(booking.balance_cents, currency, "en")}</p>
          </section>

          {proofs.length > 0 && (
            <section className="rounded-xl border border-border bg-background p-4">
              <h2 className="mb-3 font-semibold text-ink">Payment Proofs</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {proofs.map((p) => (
                  <li key={p.id}>
                    {p.bank_name} · {p.transaction_ref} · {p.status}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Status History</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {statusHistory.map((h) => (
                <li key={h.id} className="border-b border-border pb-2 last:border-0">
                  <span className="font-medium">{h.new_status}</span>{" "}
                  <span className="text-muted">{new Date(h.at).toLocaleString("en-GB")}</span>
                  {h.internal_note && <p className="text-muted">{h.internal_note}</p>}
                  {h.customer_note && <p className="text-muted">Customer: {h.customer_note}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Update Status</h2>
            <BookingStatusForm bookingId={booking.id} currentStatus={booking.status as BookingStatus} />
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Reassign Vehicle</h2>
            <VehicleReassignForm
              bookingId={booking.id}
              currentVehicleId={booking.vehicle_id}
              options={availableVehiclesInCategory}
            />
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Emails</h2>
            <ResendEmailButtons bookingId={booking.id} />
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 font-semibold text-ink">Invoice</h2>
            <form action={createInvoiceFromBookingAndRedirect.bind(null, booking.id)}>
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
              >
                Create Invoice
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
