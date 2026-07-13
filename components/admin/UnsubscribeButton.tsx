"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unsubscribeNewsletterSubscriber } from "@/lib/actions/admin/newsletter";

export function UnsubscribeButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unsubscribeNewsletterSubscriber(id);
          router.refresh();
        })
      }
      className="text-xs text-red-600 disabled:opacity-60"
    >
      Unsubscribe
    </button>
  );
}
