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
            className="rounded-full bg-action px-3 py-1 text-xs font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            Approve
          </button>
        )}
        {status !== "rejected" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => moderate("rejected")}
            className="rounded-full border border-border px-3 py-1 text-xs text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
          >
            Reject
          </button>
        )}
        {status !== "hidden" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => moderate("hidden")}
            className="rounded-full border border-border px-3 py-1 text-xs text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
          >
            Hide
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={toggleFeatured}
          className="rounded-full border border-border px-3 py-1 text-xs text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
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
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          disabled={pending}
          onClick={saveReply}
          className="rounded-lg border border-border px-2 py-1 text-xs text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
        >
          Save Reply
        </button>
      </div>
    </div>
  );
}
