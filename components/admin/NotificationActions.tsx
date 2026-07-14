"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead, archiveNotification } from "@/lib/actions/admin/notifications";

export function NotificationActions({ id, readAt }: { id: string; readAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {!readAt && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await markNotificationRead(id);
              router.refresh();
            })
          }
          className="text-xs font-medium text-primary-dark hover:underline disabled:pointer-events-none disabled:opacity-60"
        >
          Mark Read
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await archiveNotification(id);
            router.refresh();
          })
        }
        className="text-xs text-muted hover:text-ink disabled:pointer-events-none disabled:opacity-60"
      >
        Archive
      </button>
    </div>
  );
}
