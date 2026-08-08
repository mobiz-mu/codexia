import type { Metadata } from "next";
import { listContactMessages } from "@/lib/actions/admin/messages";
import { ContactMessageActions } from "@/components/admin/ContactMessageActions";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Pagination } from "@/components/admin/ui/Pagination";

export const metadata: Metadata = { title: "Contact Messages" };

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
] as const;

const STATUS_TONE: Record<string, string> = {
  new: "bg-primary-tint text-primary-dark",
  read: "bg-surface text-muted",
  replied: "bg-action-tint text-action-dark",
  archived: "bg-surface text-muted",
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { messages, total, page, pageSize } = await listContactMessages(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    qs.set("page", String(targetPage));
    return `/admin/messages?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Contact Messages" />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = (params.status ?? "") === tab.value;
          const qs = new URLSearchParams();
          if (tab.value) qs.set("status", tab.value);
          return (
            <a
              key={tab.value || "all"}
              href={`/admin/messages${qs.toString() ? `?${qs.toString()}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary-tint text-primary-dark"
                  : "border-border text-muted hover:border-primary hover:text-primary-dark"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-border bg-background p-4 shadow-sm transition-colors hover:bg-surface"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">
                {m.name} · {m.email} {m.phone ? `· ${m.phone}` : ""}
              </p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${STATUS_TONE[m.status] ?? "bg-surface text-muted"}`}
              >
                {m.status}
              </span>
            </div>
            {m.subject && <p className="mt-1 text-sm font-medium text-ink">{m.subject}</p>}
            <p className="mt-1 text-sm text-muted">{m.message}</p>
            <p className="mt-1 text-xs text-muted">{new Date(m.created_at).toLocaleString("en-GB")}</p>
            <div className="mt-3">
              <ContactMessageActions id={m.id} status={m.status} />
            </div>
          </div>
        ))}
        {messages.length === 0 && <EmptyState message="No messages found." />}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} itemLabel="message" pageHref={pageHref} />
    </div>
  );
}
