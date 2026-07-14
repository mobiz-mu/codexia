"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewFormState } from "@/lib/actions/reviews";

const initialState: ReviewFormState = { status: "idle" };

export function ReviewForm({
  targetType,
  targetId,
  labels,
}: {
  targetType: "vehicle" | "post" | "homepage";
  targetId?: string;
  labels: {
    title: string;
    name: string;
    email: string;
    country: string;
    rating: string;
    body: string;
    consent: string;
    submit: string;
    success: string;
  };
}) {
  const [state, formAction, pending] = useActionState(submitReview, initialState);
  const [rating, setRating] = useState(5);

  if (state.status === "success") {
    return (
      <p className="rounded-xl border border-action/30 bg-surface p-4 text-sm text-ink" role="status">
        {labels.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold text-ink">{labels.title}</h3>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId ?? ""} />
      {/* honeypot, hidden from real users via CSS not display:none so basic bots that skip hidden fields still get caught */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          name="name"
          placeholder={labels.name}
          required
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          type="email"
          name="email"
          placeholder={labels.email}
          required
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="country"
          placeholder={labels.country}
          className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="review-rating" className="text-sm text-ink">
          {labels.rating}
        </label>
        <select
          id="review-rating"
          name="rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="rounded-lg border border-border px-2 py-1 text-sm"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <textarea
        name="body"
        placeholder={labels.body}
        required
        rows={3}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />

      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="consent" value="true" required className="mt-0.5" />
        {labels.consent}
      </label>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "..." : labels.submit}
      </button>
    </form>
  );
}
