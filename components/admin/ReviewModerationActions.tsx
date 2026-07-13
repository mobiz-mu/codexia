"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateReview, toggleReviewFeatured, replyToReview } from "@/lib/actions/admin/reviews";

export function ReviewModerationActions({
  reviewId,
  status,
  featured,
  adminReply,
}: {
  reviewId: string;
  status: string;
  featured: boolean;
  adminReply: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reply, setReply] = useState(adminReply ?? "");

  function moderate(newStatus: "approved" | "rejected" | "hidden") {
    startTransition(async () => {
      await moderateReview(reviewId, newStatus);
      router.refresh();
    });
  }

  function toggleFeatured() {
    startTransition(async () => {
      await toggleReviewFeatured(reviewId, !featured);
      router.refresh();
    });
  }

  function saveReply() {
    startTransition(async () => {
      await replyToReview(reviewId, reply);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => moderate("approved")}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            Approve
          </button>
        )}
        {status !== "rejected" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => moderate("rejected")}
            className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-60"
          >
            Reject
          </button>
        )}
        {status !== "hidden" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => moderate("hidden")}
            className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-60"
          >
            Hide
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={toggleFeatured}
          className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-60"
        >
          {featured ? "Unfeature" : "Feature"}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Admin reply"
          className="rounded-lg border border-border px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={pending}
          onClick={saveReply}
          className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-60"
        >
          Save Reply
        </button>
      </div>
    </div>
  );
}
