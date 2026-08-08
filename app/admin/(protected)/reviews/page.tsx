import type { Metadata } from "next";
import { listReviewsAdmin } from "@/lib/actions/admin/reviews";
import { ReviewModerationActions } from "@/components/admin/ReviewModerationActions";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const reviews = await listReviewsAdmin(status);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Reviews</h1>

      <form className="flex gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="hidden">Hidden</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-primary-dark"
        >
          Filter
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-background p-4 shadow-sm transition-colors hover:bg-surface"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">
                {r.name} {r.country ? `· ${r.country}` : ""} · {r.rating}/5
              </p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                  r.status === "approved"
                    ? "bg-action-tint text-action-dark"
                    : r.status === "rejected" || r.status === "hidden"
                      ? "bg-surface text-muted"
                      : "bg-primary-tint text-primary-dark"
                }`}
              >
                {r.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">{r.body}</p>
            {r.admin_reply && <p className="mt-2 rounded bg-surface p-2 text-xs text-muted">Reply: {r.admin_reply}</p>}
            <div className="mt-3">
              <ReviewModerationActions
                reviewId={r.id}
                status={r.status}
                featured={r.featured}
                adminReply={r.admin_reply}
              />
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">No reviews found.</p>
        )}
      </div>
    </div>
  );
}
