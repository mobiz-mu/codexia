import type { Metadata } from "next";
import { listContactMessages } from "@/lib/actions/admin/messages";
import { ContactMessageActions } from "@/components/admin/ContactMessageActions";

export const metadata: Metadata = { title: "Contact Messages" };

export default async function AdminMessagesPage() {
  const messages = await listContactMessages();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Contact Messages</h1>

      <div className="flex flex-col gap-4">
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">
                {m.name} · {m.email} {m.phone ? `· ${m.phone}` : ""}
              </p>
              <span className="text-xs uppercase text-muted">{m.status}</span>
            </div>
            {m.subject && <p className="mt-1 text-sm font-medium text-ink">{m.subject}</p>}
            <p className="mt-1 text-sm text-muted">{m.message}</p>
            <p className="mt-1 text-xs text-muted">{new Date(m.created_at).toLocaleString("en-GB")}</p>
            <div className="mt-3">
              <ContactMessageActions id={m.id} status={m.status} />
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-muted">No messages yet.</p>}
      </div>
    </div>
  );
}
