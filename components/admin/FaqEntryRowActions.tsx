"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFaqEntryActive, deleteFaqEntry } from "@/lib/actions/admin/faq";

export function FaqEntryRowActions({ entryId, active }: { entryId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await toggleFaqEntryActive(entryId, !active);
            router.refresh();
          })
        }
        className="text-xs text-primary-dark disabled:opacity-60"
      >
        {active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteFaqEntry(entryId);
            router.refresh();
          })
        }
        className="text-xs text-red-600 disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  );
}
