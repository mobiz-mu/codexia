import type { Metadata } from "next";
import { listNewsletterSubscribers } from "@/lib/actions/admin/newsletter";
import { UnsubscribeButton } from "@/components/admin/UnsubscribeButton";

export const metadata: Metadata = { title: "Newsletter" };

export default async function AdminNewsletterPage() {
  const subscribers = await listNewsletterSubscribers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Newsletter Subscribers</h1>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Locale</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2 uppercase">{s.locale}</td>
                <td className="px-4 py-2">{s.source ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{s.status}</td>
                <td className="px-4 py-2">
                  {s.status === "subscribed" && <UnsubscribeButton id={s.id} />}
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
