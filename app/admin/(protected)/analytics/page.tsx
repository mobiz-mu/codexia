import type { Metadata } from "next";
import { getAnalyticsSummary } from "@/lib/actions/admin/analytics";

export const metadata: Metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  const summary = await getAnalyticsSummary();
  const maxDayCount = Math.max(1, ...summary.byDay.map(([, count]) => count));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-sm text-muted">Last 30 days · {summary.totalEvents} events recorded</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted">Book Now Clicks</p>
          <p className="text-2xl font-bold text-ink">{summary.bookNowClicks}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted">Bookings Submitted</p>
          <p className="text-2xl font-bold text-ink">{summary.bookingsSubmitted}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted">Conversion Rate</p>
          <p className="text-2xl font-bold text-ink">{(summary.conversionRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="mb-3 font-semibold text-ink">Events by Day</h2>
        <div className="flex items-end gap-1 overflow-x-auto" style={{ height: 120 }}>
          {summary.byDay.map(([day, count]) => (
            <div key={day} className="flex flex-col items-center gap-1" title={`${day}: ${count}`}>
              <div
                className="w-3 rounded-t bg-primary"
                style={{ height: `${Math.max(4, (count / maxDayCount) * 100)}px` }}
              />
            </div>
          ))}
          {summary.byDay.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-ink">Top Pages</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.topPaths.map(([path, count]) => (
              <li key={path} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span className="truncate">{path}</span>
                <span className="text-muted">{count}</span>
              </li>
            ))}
            {summary.topPaths.length === 0 && <li className="text-muted">No pageviews yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-ink">Most Viewed Vehicles</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.topVehicles.map((v) => (
              <li key={v.id} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span>{v.name}</span>
                <span className="text-muted">{v.count}</span>
              </li>
            ))}
            {summary.topVehicles.length === 0 && <li className="text-muted">No vehicle views yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-ink">Devices</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.byDevice.map(([device, count]) => (
              <li key={device} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span className="capitalize">{device}</span>
                <span className="text-muted">{count}</span>
              </li>
            ))}
            {summary.byDevice.length === 0 && <li className="text-muted">No data yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-ink">Top Referrers</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.topReferrers.map(([host, count]) => (
              <li key={host} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span>{host}</span>
                <span className="text-muted">{count}</span>
              </li>
            ))}
            {summary.topReferrers.length === 0 && <li className="text-muted">No referrer data yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
