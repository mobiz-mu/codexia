"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContactMessageStatus } from "@/lib/actions/admin/messages";

export function ContactMessageActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(newStatus: "read" | "replied" | "archived") {
    startTransition(async () => {
      await updateContactMessageStatus(id, newStatus);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {status === "new" && (
        <button type="button" disabled={pending} onClick={() => update("read")} className="text-xs text-primary-dark disabled:opacity-60">
          Mark Read
        </button>
      )}
      {status !== "replied" && (
        <button type="button" disabled={pending} onClick={() => update("replied")} className="text-xs text-primary-dark disabled:opacity-60">
          Mark Replied
        </button>
      )}
      {status !== "archived" && (
        <button type="button" disabled={pending} onClick={() => update("archived")} className="text-xs text-muted disabled:opacity-60">
          Archive
        </button>
      )}
    </div>
  );
}
