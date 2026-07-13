"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBlock } from "@/lib/actions/admin/availability";

export function DeleteBlockButton({ blockId }: { blockId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteBlock(blockId);
          router.refresh();
        })
      }
      className="text-xs text-red-600 disabled:opacity-60"
    >
      Remove
    </button>
  );
}
