import type { Metadata } from "next";
import Link from "next/link";
import { Car, Banknote, Scale, ReceiptText, Star, MailWarning, CalendarClock, type LucideIcon } from "lucide-react";
import { getOverviewStats } from "@/lib/actions/admin/overview";
import { formatMoney } from "@/lib/pricing/format";

export const metadata: Metadata = { title: "Overview" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  payment_proof_submitted: "Proof Submitted",
  payment_under_review: "Proof Under Review",
  confirmed: "Confirmed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  vehicle_assigned: "Vehicle Assigned",
  ready_for_pickup: "Ready for Pickup",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  refunded: "Refunded",
  rejected: "Rejected",
};

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Car} label="Active Rentals" value={String(stats.activeRentalsCount)} tone="primary" />
        <StatCard
          icon={Banknote}
          label="Revenue Collected"
          value={formatMoney(stats.revenueCents, "EUR", "en")}
          tone="action"
        />
        <StatCard
          icon={Scale}
          label="Outstanding Balance"
          value={formatMoney(stats.outstandingCents, "EUR", "en")}
          tone="primary"
        />
        <StatCard
          icon={ReceiptText}
          label="Pending Payment Proofs"
          value={String(stats.pendingProofsCount)}
          tone="primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Star} label="Pending Reviews" value={String(stats.pendingReviewsCount)} tone="primary" />
        <StatCard icon={MailWarning} label="Failed Emails" value={String(stats.failedEmailsCount)} tone="primary" />
        <StatCard
          icon={CalendarClock}
          label="Bookings (all time)"
          value={String(Object.values(stats.byStatus).reduce((a, b) => a + b, 0))}
          tone="action"
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Bookings by Status</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-border bg-primary-tint px-3 py-1 text-xs font-medium text-primary-dark"
            >
              {STATUS_LABELS[status] ?? status}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Upcoming Pickups (7 days)</h2>
          <BookingMiniList
            items={stats.upcomingPickups.map((b) => ({
              id: b.id,
              reference: b.reference,
              date: b.pickup_at,
              vehicle: (b.vehicles as { name: string } | null)?.name ?? "—",
            }))}
            empty="No pickups in the next 7 days."
          />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Upcoming Drop-offs (7 days)</h2>
          <BookingMiniList
            items={stats.upcomingDropoffs.map((b) => ({
              id: b.id,
              reference: b.reference,
              date: b.return_at,
              vehicle: (b.vehicles as { name: string } | null)?.name ?? "—",
            }))}
            empty="No drop-offs in the next 7 days."
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent Bookings</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Vehicle</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary-dark hover:underline">
                      {b.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{(b.vehicles as { name: string } | null)?.name ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[b.status] ?? b.status}</td>
                  <td className="px-4 py-2">{formatMoney(b.total_cents, "EUR", "en")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "primary" | "action";
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <span
        className={
          tone === "primary"
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action-tint text-action-dark"
        }
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

function BookingMiniList({
  items,
  empty,
}: {
  items: { id: string; reference: string; date: string; vehicle: string }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:bg-surface"
        >
          <Link href={`/admin/bookings/${item.id}`} className="font-medium text-primary-dark hover:underline">
            {item.reference}
          </Link>{" "}
          — {item.vehicle} — {new Date(item.date).toLocaleString("en-GB")}
        </li>
      ))}
    </ul>
  );
}
