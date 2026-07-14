import { Star } from "lucide-react";

type Review = {
  id: string;
  name: string;
  country: string | null;
  rating: number;
  body: string;
  admin_reply: string | null;
};

export function ReviewsList({ reviews, emptyLabel }: { reviews: Review[]; emptyLabel: string }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-0.5" aria-label={`${review.rating} / 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < review.rating ? "fill-action text-action" : "text-border"}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-ink">{review.body}</p>
          <p className="mt-3 text-xs font-medium text-muted">
            {review.name}
            {review.country ? ` · ${review.country}` : ""}
          </p>
          {review.admin_reply && (
            <p className="mt-2 rounded-lg bg-surface p-2 text-xs text-muted">{review.admin_reply}</p>
          )}
        </div>
      ))}
    </div>
  );
}
