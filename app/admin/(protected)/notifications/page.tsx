import type { Metadata } from "next";
import Link from "next/link";
import { listNotifications } from "@/lib/actions/admin/notifications";
import { NotificationActions } from "@/components/admin/NotificationActions";

export const metadata: Metadata = { title: "Notifications" };

const TYPE_LABELS: Record<string, string> = {
  new_booking: "New Booking",
  new_payment_proof: "New Payment Proof",
  new_review: "New Review",
  new_contact_message: "New Contact Message",
  new_newsletter_subscriber: "New Newsletter Subscriber",
  failed_email: "Failed Email",
};

export default async function AdminNotificationsPage() {
  const notifications = await listNotifications();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Notifications</h1>

      <div className="flex flex-col gap-2">
        {notifications.map((n) => {
          const payload = n.payload as Record<string, unknown>;
          const content = Object.entries(payload)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ");
          return (
            <div
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${n.read_at ? "border-border bg-background" : "border-primary/30 bg-surface"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">{TYPE_LABELS[n.type] ?? n.type}</p>
                <span className="text-xs text-muted">{new Date(n.created_at).toLocaleString("en-GB")}</span>
              </div>
              <p className="mt-1 text-muted">{content}</p>
              <div className="mt-2 flex items-center justify-between">
                {n.link ? (
                  <Link href={n.link} className="text-xs text-primary-dark">
                    View
                  </Link>
                ) : (
                  <span />
                )}
                <NotificationActions id={n.id} readAt={n.read_at} />
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && <p className="text-center text-muted">No notifications.</p>}
      </div>
    </div>
  );
}
