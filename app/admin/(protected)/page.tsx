import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import {
  Car,
  Banknote,
  Scale,
  ShoppingCart,
  Star,
  MailWarning,
  CalendarClock,
  CalendarPlus,
  TrendingUp,
  CheckCircle2,
  BookmarkCheck,
  Wrench,
  Gauge,
  MessageCircleQuestion,
  ShieldAlert,
  FileWarning,
  FileX2,
  CarFront,
  Siren,
  AlertOctagon,
  AlertTriangle,
  ClipboardCheck,
  CircleDashed,
  CircleSlash,
} from "lucide-react";
import { getOverviewStats } from "@/lib/actions/admin/overview";
import { getComplianceDashboardStats, getComplianceAlerts } from "@/lib/actions/admin/compliance";
import { getIncidentDashboardStats, getOpenIncidentsList } from "@/lib/actions/admin/incidents";
import { getFleetWeekStatus } from "@/lib/actions/admin/inspections";
import { needsAttention } from "@/lib/inspections/due";
import { DOCUMENT_TYPE_LABELS } from "@/lib/compliance/schema";
import { INCIDENT_TYPE_LABELS } from "@/lib/incidents/schema";
import { ComplianceStatusBadge } from "@/components/admin/ComplianceStatusBadge";
import { SeverityBadge, RepairStatusBadge } from "@/components/admin/IncidentBadges";
import { formatMoney } from "@/lib/pricing/format";
import { KpiCard, KpiSection } from "@/components/admin/ui/KpiCard";
import { EmptyState } from "@/components/admin/ui/EmptyState";

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

// EUR is the live business currency, always shown as the headline figure.
// Any other currency present (MUR, from bookings created before the
// EUR-pricing migration) is historical and shown as a secondary note rather
// than being added into the EUR total — they are not the same unit.
function primaryAndHistorical(byCurrency: Record<string, number>) {
  const primary = formatMoney(byCurrency.EUR ?? 0, "EUR", "en");
  const historical = Object.entries(byCurrency).filter(([currency, cents]) => currency !== "EUR" && cents !== 0);
  return { primary, historical };
}

function StatValue({ byCurrency }: { byCurrency: Record<string, number> }) {
  const { primary, historical } = primaryAndHistorical(byCurrency);
  return (
    <>
      <p className="mt-0.5 text-xl font-bold text-ink">{primary}</p>
      {historical.length > 0 && (
        <p className="mt-0.5 truncate text-[11px] text-muted">
          + {historical.map(([currency, cents]) => formatMoney(cents, currency, "en")).join(", ")} (historical)
        </p>
      )}
    </>
  );
}

export default async function AdminOverviewPage() {
  // Same check the layout already performs (React.cache()-deduped, so this
  // is a cache hit when authenticated — zero extra queries). The layout's
  // own redirect doesn't reliably run before this page's data-fetching
  // starts, so an anonymous visit would otherwise throw the generic "Not
  // authenticated" error out of getOverviewStats() before the layout's
  // redirect resolves. Checking here means the redirect always wins first.
  const user = await getCurrentAdminUser();
  if (!user || user.roles.length === 0) redirect("/admin/login");

  // Weekly inspection status is only fetched for someone allowed to see it,
  // so the dashboard costs no extra queries for a role without the permission.
  const canViewInspections = user.permissions.has("view_inspections");

  const [stats, complianceStats, complianceAlerts, incidentStats, openIncidents, fleetWeek] = await Promise.all([
    getOverviewStats(),
    getComplianceDashboardStats(),
    getComplianceAlerts(10),
    getIncidentDashboardStats(),
    getOpenIncidentsList(10),
    canViewInspections ? getFleetWeekStatus() : Promise.resolve(null),
  ]);

  // Already sorted by operational priority in the resolver, so this is a slice
  // of the worst cases rather than a second ranking.
  const inspectionsNeedingAttention = (fleetWeek?.rows ?? [])
    .filter((row) => needsAttention(row.status))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">Overview</h1>

      <KpiSection title="Bookings" icon={CalendarClock}>
        <KpiCard icon={CalendarPlus} label="Today's Bookings" value={String(stats.todayBookingsCount)} tone="action" />
        <KpiCard icon={Car} label="Active Rentals" value={String(stats.activeRentalsCount)} tone="primary" />
        <KpiCard
          icon={ShoppingCart}
          label="Pending Bookings"
          value={String(stats.unpaidPendingCount)}
          tone={stats.unpaidPendingCount > 0 ? "warning" : "primary"}
        />
        <KpiCard
          icon={CalendarClock}
          label="Bookings (All Time)"
          value={String(Object.values(stats.byStatus).reduce((a, b) => a + b, 0))}
          tone="action"
        />
      </KpiSection>

      <KpiSection title="Fleet" icon={Car}>
        <KpiCard icon={CarFront} label="Total Vehicles" value={String(stats.fleetSize)} tone="primary" />
        <KpiCard icon={CheckCircle2} label="Available" value={String(stats.vehiclesAvailableCount)} tone="primary" />
        <KpiCard icon={BookmarkCheck} label="Reserved" value={String(stats.vehiclesReservedCount)} tone="primary" />
        <KpiCard
          icon={Wrench}
          label="Unavailable / Maintenance"
          value={String(stats.vehiclesMaintenanceCount)}
          tone={stats.vehiclesMaintenanceCount > 0 ? "warning" : "primary"}
        />
        <KpiCard icon={Gauge} label="Fleet Utilisation" value={`${stats.fleetUtilizationPct}%`} tone="action" />
      </KpiSection>

      <div>
        <KpiSection title="Compliance" icon={ShieldAlert}>
          <KpiCard
            icon={FileWarning}
            label="Expiring Within 30 Days"
            value={String(complianceStats.expiringWithin30)}
            tone={complianceStats.expiringWithin30 > 0 ? "warning" : "primary"}
          />
          <KpiCard
            icon={ShieldAlert}
            label="Expiring Within 7 Days"
            value={String(complianceStats.expiringWithin7)}
            tone={complianceStats.expiringWithin7 > 0 ? "danger" : "primary"}
          />
          <KpiCard
            icon={FileX2}
            label="Documents Expired"
            value={String(complianceStats.expired)}
            tone={complianceStats.expired > 0 ? "danger" : "primary"}
          />
          <KpiCard
            icon={CarFront}
            label="Vehicles With a Compliance Issue"
            value={String(complianceStats.vehiclesWithProblem)}
            tone={complianceStats.vehiclesWithProblem > 0 ? "danger" : "primary"}
          />
        </KpiSection>

        {complianceAlerts.length > 0 && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Documents Requiring Attention
            </h3>
            <ul className="flex flex-col divide-y divide-red-200">
              {complianceAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/compliance/${a.id}`} className="font-medium text-ink hover:underline">
                      {a.vehicleName}
                    </Link>
                    <span className="text-muted">
                      {" — "}
                      {a.documentType === "other"
                        ? a.customType ?? "Other"
                        : DOCUMENT_TYPE_LABELS[a.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? a.documentType}
                      {" — expires "}
                      {new Date(a.expiryDate).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <ComplianceStatusBadge status={a.status} daysRemaining={a.daysRemaining} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {canViewInspections && fleetWeek ? (
        <div>
          <KpiSection title="Weekly Inspections" icon={ClipboardCheck}>
            <KpiCard
              icon={CircleDashed}
              label="Due This Week"
              value={String(fleetWeek.counts.due)}
              tone={fleetWeek.counts.due > 0 ? "warning" : "primary"}
            />
            <KpiCard
              icon={AlertOctagon}
              label="Failed"
              value={String(fleetWeek.counts.failed)}
              tone={fleetWeek.counts.failed > 0 ? "danger" : "primary"}
            />
            <KpiCard
              icon={AlertTriangle}
              label="Attention Required"
              value={String(fleetWeek.counts.attention)}
              tone={fleetWeek.counts.attention > 0 ? "warning" : "primary"}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Completed"
              value={String(fleetWeek.counts.completed)}
              tone="primary"
            />
            <KpiCard
              icon={CircleSlash}
              label="Exempt Off Road"
              value={String(fleetWeek.counts.exempt)}
              tone="primary"
            />
          </KpiSection>

          {inspectionsNeedingAttention.length === 0 ? (
            <div className="mt-3 rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-sm text-muted">
                Nothing outstanding for the week ending {fleetWeek.weekEnding}.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Vehicles Needing Attention</h3>
                <Link href="/admin/inspections" className="text-sm font-medium text-primary-dark hover:underline">
                  View all
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {inspectionsNeedingAttention.map((row) => (
                  <li key={row.vehicleId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{row.name}</span>
                      {row.registration ? (
                        <span className="ml-1.5 text-xs text-muted">{row.registration}</span>
                      ) : null}
                      {row.isStaffCar ? (
                        <span className="ml-1.5 rounded px-1 py-px text-[10px] font-bold uppercase text-muted">
                          Staff car
                        </span>
                      ) : null}
                      <div className="text-xs text-muted">
                        {/* Glyph plus word: never colour alone. */}
                        {row.statusGlyph} {row.statusLabel}
                        {row.hasSafetyFailure ? " · safety failure" : ""} · week ending {fleetWeek.weekEnding}
                      </div>
                    </div>
                    <Link
                      href={
                        row.inspectionId
                          ? `/admin/inspections/${row.inspectionId}`
                          : `/admin/inspections/new?vehicleId=${row.vehicleId}`
                      }
                      className="shrink-0 text-sm font-medium text-primary-dark hover:underline"
                      aria-label={
                        row.inspectionId
                          ? `View the inspection for ${row.name}`
                          : `Start an inspection for ${row.name}`
                      }
                    >
                      {row.inspectionId ? "View" : "Start"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div>
        <KpiSection title="Incidents" icon={Siren}>
          <KpiCard
            icon={AlertOctagon}
            label="Open Cases"
            value={String(incidentStats.openCases)}
            tone={incidentStats.openCases > 0 ? "warning" : "primary"}
          />
          <KpiCard
            icon={Wrench}
            label="Vehicles Under Repair"
            value={String(incidentStats.vehiclesUnderRepair)}
            tone={incidentStats.vehiclesUnderRepair > 0 ? "action" : "primary"}
          />
          <KpiCard
            icon={Siren}
            label="Major Incidents"
            value={String(incidentStats.majorIncidents)}
            tone={incidentStats.majorIncidents > 0 ? "danger" : "primary"}
          />
          <KpiCard
            icon={Banknote}
            label="Repair Cost This Month"
            value={formatMoney(incidentStats.repairCostThisMonthCents, "MUR", "en")}
            tone="action"
          />
        </KpiSection>

        {openIncidents.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-background p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Siren className="h-4 w-4" aria-hidden="true" />
              Open Incidents
            </h3>
            <ul className="flex flex-col divide-y divide-border">
              {openIncidents.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/incidents/${i.id}`} className="font-medium text-ink hover:underline">
                      {i.vehicleName}
                    </Link>
                    <span className="text-muted">
                      {" — "}
                      {i.incidentType === "other"
                        ? i.customType ?? "Other"
                        : INCIDENT_TYPE_LABELS[i.incidentType as keyof typeof INCIDENT_TYPE_LABELS] ?? i.incidentType}
                      {" — "}
                      {new Date(i.incidentDate).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SeverityBadge severity={i.severity} />
                    <RepairStatusBadge status={i.repairStatus as Parameters<typeof RepairStatusBadge>[0]["status"]} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <KpiSection title="Finance" icon={Banknote}>
        <KpiCard
          icon={TrendingUp}
          label="Revenue This Month"
          value={<StatValue byCurrency={stats.monthBookingRevenueByCurrency} />}
          tone="action"
        />
        <KpiCard
          icon={Banknote}
          label="Paid This Month"
          value={<StatValue byCurrency={stats.monthRevenueByCurrency} />}
          tone="action"
        />
        <KpiCard
          icon={Scale}
          label="Outstanding Balance"
          value={<StatValue byCurrency={stats.outstandingByCurrency} />}
          tone={Object.values(stats.outstandingByCurrency).some((v) => v > 0) ? "warning" : "primary"}
        />
        <KpiCard
          icon={Banknote}
          label="Revenue Collected (All Time)"
          value={<StatValue byCurrency={stats.revenueByCurrency} />}
          tone="action"
        />
      </KpiSection>

      <KpiSection title="Operations" icon={Gauge}>
        <KpiCard icon={CalendarPlus} label="Today's Revenue" value={<StatValue byCurrency={stats.todayRevenueByCurrency} />} tone="action" />
        <KpiCard icon={MessageCircleQuestion} label="Pending Enquiries" value={String(stats.pendingEnquiriesCount)} tone="primary" />
        <KpiCard icon={Star} label="Pending Reviews" value={String(stats.pendingReviewsCount)} tone="primary" />
        <KpiCard icon={MailWarning} label="Failed Emails" value={String(stats.failedEmailsCount)} tone={stats.failedEmailsCount > 0 ? "danger" : "primary"} />
      </KpiSection>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary-dark">Bookings by Status</h2>
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
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary-dark">Upcoming Pickups (7 days)</h2>
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
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary-dark">Upcoming Drop-offs (7 days)</h2>
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
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary-dark">Recent Bookings</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
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
                  <td className="px-4 py-2">{formatMoney(b.total_cents, b.currency, "en")}</td>
                </tr>
              ))}
              {stats.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    return <EmptyState message={empty} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-border bg-background p-3 text-sm shadow-sm transition-colors hover:bg-surface"
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
